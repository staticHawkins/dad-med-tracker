import { useState, useRef } from 'react'
import { addDoctorNote, addTestResult, addStayTeamMember } from '../../lib/firestore'
import { uploadStayDocument } from '../../lib/storageUtils'
import { extractTextFromPdf } from '../../lib/pdfUtils'
import { todayStr } from '../../lib/medUtils'
import { generateTreatmentSummary } from '../../lib/treatmentPlan'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../../firebase'

const NOTE_TYPES = ['Progress Note', 'Consult Note', 'Discharge Summary', 'H&P', 'Operative Note', 'Nursing Note', 'Social Work Note', 'Other']

export default function AddDocumentModal({ stayId, stay, type, onClose, onSaved }) {
  const isNote = type === 'note'
  const [date, setDate] = useState(todayStr())
  const [author, setAuthor] = useState('')
  const [noteType, setNoteType] = useState(NOTE_TYPES[0])
  const [testName, setTestName] = useState('')
  const [fileName, setFileName] = useState('')
  const [extractedText, setExtractedText] = useState('')
  const [fallbackText, setFallbackText] = useState('')
  const [needsFallback, setNeedsFallback] = useState(false)
  const [interpretation, setInterpretation] = useState('')
  const [labValues, setLabValues] = useState([])
  const [interpreting, setInterpreting] = useState(false)
  const [interpretError, setInterpretError] = useState(null)
  const [showRaw, setShowRaw] = useState(false)
  const [extractedRole, setExtractedRole] = useState('')
  const [saving, setSaving] = useState(false)
  const [fileObj, setFileObj] = useState(null)
  const fileInputRef = useRef(null)

  async function handleFileSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileObj(file)
    setFileName(file.name)
    setInterpretation('')
    setLabValues([])
    setInterpretError(null)
    setNeedsFallback(false)
    setExtractedText('')
    setFallbackText('')
    setShowRaw(false)
    setExtractedRole('')
    setDate(todayStr())

    const text = await extractTextFromPdf(file)
    if (!text) {
      setNeedsFallback(true)
      return
    }
    setExtractedText(text)
    await callInterpret(text)
  }

  async function callInterpret(text) {
    if (!text.trim()) return
    setInterpreting(true)
    setInterpretError(null)
    try {
      const fn = httpsCallable(functions, 'askClaude')
      const systemContext = isNote
        ? `You are helping a family understand their father's clinical notes from his hospital care team.

First, extract the following metadata from the note and output each on its own line at the very top:
AUTHOR: <provider name from signature, "Attending:", "Provider:", "Signed by:", or "Dictated by:" — if not found, omit this line>
ROLE: <their role or specialty in 3-5 words max, e.g., Attending Nephrologist, Resident, Oncologist — if not found, omit this line>
DATE: <service or note date in YYYY-MM-DD format — look for "Service date:", "Signed", or a date in the header — if not found, omit this line>

Then on a new line, translate the note into plain English. Focus on: what the doctor observed or assessed, any key decisions made, current treatment status, and what to expect next. Write 3-5 clear bullet points, each starting with a dash (-). No markdown headers, no bold text, no medical jargon.`
        : `You are helping a family understand medical test results for their father.

First, output the following metadata on their own lines:
TEST_NAME: <name of the test or report, e.g., CBC Panel, CT Chest — if not found, use the file title>
DATE: <result date in YYYY-MM-DD format — if not found, omit>

If this is a quantitative lab report (CBC, BMP, CMP, metabolic panel, liver function, renal function, lipid panel, thyroid, coagulation, urinalysis), also output exactly one line:
LAB_VALUES: [{"name":"HGB","value":7.1,"unit":"g/dL","refLow":12,"refHigh":17,"flag":"L"},...]
Use flag values: "N" = normal, "H" = high, "L" = low, "C" = critical. Only include numeric values with known reference ranges. If not a quantitative lab, omit this line entirely.

Then explain the key findings in plain English. Write 3-5 clear bullet points, each starting with a dash (-). Flag anything outside normal range and explain what it means. No markdown headers, no bold text, no medical jargon.`
      const { data } = await fn({
        messages: [{ role: 'user', content: text }],
        systemContext,
      })
      if (isNote) {
        const lines = data.content.split('\n')
        let rest = lines
        const metaKeys = ['AUTHOR:', 'ROLE:', 'DATE:']
        while (rest.length > 0 && metaKeys.some(k => rest[0]?.startsWith(k))) {
          const line = rest[0]
          if (line.startsWith('AUTHOR:')) {
            const val = line.replace('AUTHOR:', '').trim()
            if (val) setAuthor(val)
          } else if (line.startsWith('ROLE:')) {
            const val = line.replace('ROLE:', '').trim()
            if (val) setExtractedRole(val)
          } else if (line.startsWith('DATE:')) {
            const val = line.replace('DATE:', '').trim()
            if (val && /^\d{4}-\d{2}-\d{2}$/.test(val)) setDate(val)
          }
          rest = rest.slice(1)
        }
        setInterpretation(rest.join('\n').trimStart())
      } else {
        const lines = data.content.split('\n')
        const testMetaKeys = ['TEST_NAME:', 'DATE:', 'LAB_VALUES:']
        const contentLines = []
        for (const line of lines) {
          if (line.startsWith('TEST_NAME:')) {
            const val = line.replace('TEST_NAME:', '').trim()
            if (val && !testName) setTestName(val)
          } else if (line.startsWith('DATE:')) {
            const val = line.replace('DATE:', '').trim()
            if (val && /^\d{4}-\d{2}-\d{2}$/.test(val)) setDate(val)
          } else if (line.startsWith('LAB_VALUES:')) {
            try { setLabValues(JSON.parse(line.replace('LAB_VALUES:', '').trim())) } catch {}
          } else if (!testMetaKeys.some(k => line.startsWith(k))) {
            contentLines.push(line)
          }
        }
        setInterpretation(contentLines.join('\n').replace(/^[\s\-*_]+\n/, '').trimStart())
      }
    } catch {
      setInterpretError('Could not interpret this document. You can still save it without an interpretation.')
    } finally {
      setInterpreting(false)
    }
  }

  async function handleSave() {
    if (!fileObj) return
    const textToSave = needsFallback ? fallbackText : extractedText
    setSaving(true)
    try {
      const meta = await uploadStayDocument(fileObj, stayId)
      const base = {
        date,
        pdfUrl: meta.url,
        storagePath: meta.storagePath,
        fileName: meta.name,
        extractedText: textToSave,
        interpretation,
      }
      let savedEntry
      if (isNote) {
        savedEntry = await addDoctorNote(stayId, { ...base, author: author.trim(), noteType })
        const trimmedAuthor = author.trim()
        if (trimmedAuthor) {
          const existing = stay?.stayTeam || []
          const alreadyAdded = existing.some(m => m.name.toLowerCase() === trimmedAuthor.toLowerCase())
          if (!alreadyAdded) {
            addStayTeamMember(stayId, { name: trimmedAuthor, role: extractedRole })
          }
        }
      } else {
        savedEntry = await addTestResult(stayId, { ...base, testName: testName.trim(), labValues })
      }

      // Fire-and-forget: regenerate treatment summary with updated documents
      const allNotes = isNote
        ? [...(stay?.doctorNotes || []), savedEntry]
        : (stay?.doctorNotes || [])
      const allResults = !isNote
        ? [...(stay?.testResults || []), savedEntry]
        : (stay?.testResults || [])
      onSaved?.()
      generateTreatmentSummary(stayId, allNotes, allResults)

      onClose()
    } finally {
      setSaving(false)
    }
  }

  const sourceText = needsFallback ? fallbackText : extractedText
  const canSave = fileObj && !interpreting && !saving

  return (
    <div className="right-panel-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="right-panel" role="dialog" aria-modal="true">
        <div className="right-panel-header">
          <span className="sheet-title">{isNote ? 'Add Doctor Note' : 'Add Test Result'}</span>
          <button className="note-close-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="right-panel-body">
          <div className="fr">
            <label>Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>

          {isNote ? (
            <>
              <div className="fr">
                <label>Author</label>
                <input
                  type="text"
                  placeholder="e.g., Dr. Smith"
                  value={author}
                  onChange={e => setAuthor(e.target.value)}
                />
              </div>
              <div className="fr">
                <label>Note type</label>
                <select value={noteType} onChange={e => setNoteType(e.target.value)}>
                  {NOTE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </>
          ) : (
            <div className="fr">
              <label>Test / report name</label>
              <input
                type="text"
                placeholder="e.g., CBC Panel, CT Chest, Metabolic Panel"
                value={testName}
                onChange={e => setTestName(e.target.value)}
              />
            </div>
          )}

          <div className="fr">
            <label>PDF file</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            <button
              className={`doc-upload-btn${fileName ? ' doc-upload-btn--loaded' : ''}`}
              onClick={() => fileInputRef.current?.click()}
            >
              {fileName ? `${fileName}` : 'Choose PDF…'}
              {fileName && (
                <span className="doc-upload-change">· Change</span>
              )}
            </button>
          </div>

          {needsFallback && (
            <div className="fr">
              <label>Paste note text</label>
              <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6, marginTop: 0 }}>
                The PDF couldn't be read automatically (it may be a scanned image). Paste the text below to get an AI interpretation.
              </p>
              <textarea
                rows={6}
                placeholder="Paste the note text from the portal here…"
                value={fallbackText}
                onChange={e => setFallbackText(e.target.value)}
                style={{ resize: 'none' }}
              />
              {fallbackText.trim().length > 30 && !interpretation && !interpreting && (
                <button
                  className="btn-ghost"
                  style={{ marginTop: 6, fontSize: 13 }}
                  onClick={() => callInterpret(fallbackText)}
                >
                  Interpret
                </button>
              )}
            </div>
          )}

          {interpreting && (
            <div className="daily-log-ai-loading" style={{ marginTop: 8 }}>Interpreting document…</div>
          )}

          {interpretError && (
            <div className="daily-log-ai-error" style={{ marginTop: 8 }}>{interpretError}</div>
          )}

          {labValues.length > 0 && !interpreting && (
            <div className="lab-preview">
              <div className="lab-preview-title">Extracted values</div>
              {labValues.map((lv, i) => {
                const color = lv.flag === 'N' ? '#4caf80' : lv.flag === 'C' ? '#c0605a' : '#d4872a'
                const flagLabel = { N: 'Normal', H: 'High', L: 'Low', C: 'Critical' }[lv.flag] || ''
                const hasRange = lv.refLow != null && lv.refHigh != null
                let dotPct = null, greenLeft = 30, greenRight = 70
                if (hasRange) {
                  const range = lv.refHigh - lv.refLow || 1
                  const buffer = range * 0.75
                  const scaleMin = lv.refLow - buffer
                  const scaleMax = lv.refHigh + buffer
                  const total = scaleMax - scaleMin
                  dotPct = Math.min(97, Math.max(3, ((lv.value - scaleMin) / total) * 100))
                  greenLeft = ((lv.refLow - scaleMin) / total) * 100
                  greenRight = ((lv.refHigh - scaleMin) / total) * 100
                }
                return (
                  <div key={i} className="lab-preview-row">
                    <div className="lab-preview-meta">
                      <span className="lab-preview-name">{lv.name}</span>
                      <span className="lab-preview-val" style={{ color }}>{lv.value} {lv.unit}</span>
                      <span className="lab-preview-flag" style={{ color }}>{flagLabel}</span>
                    </div>
                    {dotPct != null && (
                      <div className="lab-preview-bar-track">
                        <div className="lab-preview-bar-normal" style={{ left: `${greenLeft}%`, right: `${100 - greenRight}%` }} />
                        <div className="lab-preview-bar-dot" style={{ left: `${dotPct}%`, background: color }} />
                        <span className="lab-preview-bar-label" style={{ left: `${greenLeft}%` }}>{lv.refLow}</span>
                        <span className="lab-preview-bar-label lab-preview-bar-label--right" style={{ left: `${greenRight}%` }}>{lv.refHigh}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {interpretation && !interpreting && (
            <div className="daily-log-ai-section" style={{ marginTop: 8, marginBottom: 0 }}>
              <div className="daily-log-ai-header">
                <span className="daily-log-ai-label">⊙ AI interpretation</span>
                {sourceText && (
                  <button
                    className="daily-log-ai-btn"
                    onClick={() => setShowRaw(v => !v)}
                    style={{ fontSize: 11 }}
                  >
                    {showRaw ? 'Hide raw text' : 'Show raw text'}
                  </button>
                )}
              </div>
              <div className="daily-log-ai-result" style={{ whiteSpace: 'pre-wrap' }}>{interpretation}</div>
              {showRaw && sourceText && (
                <div className="doc-raw-text">{sourceText}</div>
              )}
            </div>
          )}

          <div style={{ marginTop: 24, display: 'flex', gap: 10 }}>
            <button
              className="btn-add"
              onClick={handleSave}
              disabled={!canSave}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}
