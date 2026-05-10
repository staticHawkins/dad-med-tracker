import { useState, useRef } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../../firebase'
import { addDoctorNote, addTestResult, addStayTeamMember } from '../../lib/firestore'
import { uploadStayDocument } from '../../lib/storageUtils'
import { extractTextFromPdf } from '../../lib/pdfUtils'
import { todayStr } from '../../lib/medUtils'
import { generateTreatmentSummary } from '../../lib/treatmentPlan'

const NOTE_TYPES = ['Progress Note', 'Consult Note', 'Discharge Summary', 'H&P', 'Operative Note', 'Nursing Note', 'Social Work Note', 'Other']

function statusIcon(status) {
  if (status === 'pending') return <span className="bulk-status bulk-status--pending">○</span>
  if (status === 'processing') return <span className="bulk-status bulk-status--processing">◌</span>
  if (status === 'done') return <span className="bulk-status bulk-status--done">✓</span>
  if (status === 'error') return <span className="bulk-status bulk-status--error">✕</span>
  return null
}

function statusLabel(status) {
  if (status === 'pending') return 'Pending'
  if (status === 'processing') return 'Processing…'
  if (status === 'done') return 'Saved'
  if (status === 'error') return 'Failed'
  return ''
}

export default function BulkUploadModal({ stayId, stay, type, onClose, onSaved }) {
  const isNote = type === 'note'
  const [items, setItems] = useState([])
  const [processing, setProcessing] = useState(false)
  const [done, setDone] = useState(false)
  const fileInputRef = useRef(null)

  function handleFileSelect(e) {
    const newFiles = Array.from(e.target.files || [])
    setItems(prev => [
      ...prev,
      ...newFiles.map(file => ({
        id: Math.random().toString(36).slice(2),
        file,
        status: 'pending',
        errorMsg: null,
      }))
    ])
    e.target.value = ''
  }

  function removeItem(id) {
    setItems(prev => prev.filter(i => i.id !== id))
  }

  function updateItem(id, patch) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i))
  }

  async function processItem(item, addedTeamNames) {
    const text = await extractTextFromPdf(item.file)
    const fn = httpsCallable(functions, 'askClaude')

    let date = todayStr()
    let author = '', role = '', noteType = NOTE_TYPES[0], testName = item.file.name.replace(/\.pdf$/i, '')
    let interpretation = '', labValues = []

    if (text) {
      const systemContext = isNote
        ? `You are helping a family understand their father's clinical notes from his hospital care team.

First, extract the following metadata and output each on its own line at the very top:
AUTHOR: <provider name — if not found, omit>
ROLE: <their role or specialty in 3-5 words — if not found, omit>
DATE: <service or note date in YYYY-MM-DD format — if not found, omit>
TYPE: <note type from: Progress Note, Consult Note, Discharge Summary, H&P, Operative Note, Nursing Note, Social Work Note, Other — pick best match>

Then translate the note into plain English. Write 3-5 bullet points starting with a dash (-). No markdown headers, no bold, no medical jargon.`
        : `You are helping a family understand medical test results for their father.

First, output the following metadata on their own lines:
TEST_NAME: <name of the test or report, e.g., CBC Panel, CT Chest — if not found, use the file title>
DATE: <result date in YYYY-MM-DD format — if not found, omit>

If this is a quantitative lab report (CBC, BMP, CMP, metabolic panel, liver function, renal function, lipid panel, thyroid, coagulation, urinalysis), also output exactly one line:
LAB_VALUES: [{"name":"HGB","value":7.1,"unit":"g/dL","refLow":12,"refHigh":17,"flag":"L"},...]
Use flag values: "N" = normal, "H" = high, "L" = low, "C" = critical. Only include numeric values with known reference ranges. If not a quantitative lab, omit this line entirely.

Then explain the key findings in plain English. Write 3-5 bullet points starting with a dash (-). Flag anything outside normal range and explain what it means. No medical jargon.`

      const { data } = await fn({ messages: [{ role: 'user', content: text }], systemContext })
      const lines = data.content.split('\n')
      let rest = lines
      const metaKeys = ['AUTHOR:', 'ROLE:', 'DATE:', 'TYPE:', 'TEST_NAME:', 'LAB_VALUES:']
      const contentLines = []
      for (const line of lines) {
        if (line.startsWith('AUTHOR:')) author = line.replace('AUTHOR:', '').trim()
        else if (line.startsWith('ROLE:')) role = line.replace('ROLE:', '').trim()
        else if (line.startsWith('DATE:')) {
          const val = line.replace('DATE:', '').trim()
          if (/^\d{4}-\d{2}-\d{2}$/.test(val)) date = val
        } else if (line.startsWith('TYPE:')) {
          const val = line.replace('TYPE:', '').trim()
          if (NOTE_TYPES.includes(val)) noteType = val
        } else if (line.startsWith('TEST_NAME:')) {
          testName = line.replace('TEST_NAME:', '').trim() || testName
        } else if (line.startsWith('LAB_VALUES:')) {
          try { labValues = JSON.parse(line.replace('LAB_VALUES:', '').trim()) } catch {}
        } else if (!metaKeys.some(k => line.startsWith(k))) {
          contentLines.push(line)
        }
      }
      interpretation = contentLines.join('\n').replace(/^[\s\-*_]+\n/, '').trimStart()
    }

    const meta = await uploadStayDocument(item.file, stayId)
    const base = {
      date,
      pdfUrl: meta.url,
      storagePath: meta.storagePath,
      fileName: meta.name,
      extractedText: text || '',
      interpretation,
    }

    let savedEntry
    if (isNote) {
      savedEntry = await addDoctorNote(stayId, { ...base, author, noteType })
      if (author && !addedTeamNames.has(author.toLowerCase())) {
        addedTeamNames.add(author.toLowerCase())
        addStayTeamMember(stayId, { name: author, role })
      }
    } else {
      savedEntry = await addTestResult(stayId, { ...base, testName, labValues })
    }

    return savedEntry
  }

  async function handleUploadAll() {
    if (processing || items.filter(i => i.status === 'pending').length === 0) return
    setProcessing(true)

    const savedNotes = [...(stay?.doctorNotes || [])]
    const savedResults = [...(stay?.testResults || [])]
    const addedTeamNames = new Set((stay?.stayTeam || []).map(m => m.name.toLowerCase()))

    for (const item of items) {
      if (item.status !== 'pending') continue
      updateItem(item.id, { status: 'processing' })
      try {
        const saved = await processItem(item, addedTeamNames)
        if (isNote) savedNotes.push(saved)
        else savedResults.push(saved)
        updateItem(item.id, { status: 'done' })
      } catch {
        updateItem(item.id, { status: 'error', errorMsg: 'Upload failed' })
      }
    }

    onSaved?.()
    generateTreatmentSummary(stayId, savedNotes, savedResults)
    setProcessing(false)
    setDone(true)
  }

  const pendingCount = items.filter(i => i.status === 'pending').length
  const doneCount = items.filter(i => i.status === 'done').length
  const hasErrors = items.some(i => i.status === 'error')

  return (
    <div className="right-panel-bg" onClick={e => e.target === e.currentTarget && !processing && onClose()}>
      <div className="right-panel" role="dialog" aria-modal="true">
        <div className="right-panel-header">
          <span className="sheet-title">Bulk Upload — {isNote ? 'Doctor Notes' : 'Test Results'}</span>
          <button className="note-close-btn" onClick={onClose} disabled={processing} aria-label="Close">✕</button>
        </div>

        <div className="right-panel-body">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            multiple
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />

          {items.length === 0 ? (
            <button className="bulk-dropzone" onClick={() => fileInputRef.current?.click()}>
              <span className="bulk-dropzone-icon">⊕</span>
              <span className="bulk-dropzone-label">Choose PDFs…</span>
              <span className="bulk-dropzone-hint">You can select multiple files at once</span>
            </button>
          ) : (
            <>
              <div className="bulk-file-list">
                {items.map(item => (
                  <div key={item.id} className={`bulk-file-row bulk-file-row--${item.status}`}>
                    {statusIcon(item.status)}
                    <span className="bulk-file-name">{item.file.name}</span>
                    <span className="bulk-file-status-label">{statusLabel(item.status)}</span>
                    {item.status === 'pending' && !processing && (
                      <button className="bulk-file-remove" onClick={() => removeItem(item.id)} aria-label="Remove">✕</button>
                    )}
                  </div>
                ))}
              </div>

              {!done && (
                <button
                  className="bulk-add-more"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={processing}
                >
                  + Add more files
                </button>
              )}
            </>
          )}

          {done && (
            <div className="bulk-done-msg">
              {hasErrors
                ? `${doneCount} of ${items.length} files uploaded. Some failed — you can retry individually.`
                : `All ${doneCount} file${doneCount !== 1 ? 's' : ''} uploaded. Treatment plan updating in the background.`}
            </div>
          )}

          <div style={{ marginTop: 24, display: 'flex', gap: 10 }}>
            {done ? (
              <button className="btn-add" onClick={onClose}>Done</button>
            ) : (
              <>
                <button
                  className="btn-add"
                  onClick={handleUploadAll}
                  disabled={processing || pendingCount === 0}
                >
                  {processing ? 'Uploading…' : `Upload ${pendingCount > 0 ? pendingCount : ''} file${pendingCount !== 1 ? 's' : ''}`}
                </button>
                <button className="btn-ghost" onClick={onClose} disabled={processing}>Cancel</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
