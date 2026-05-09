import { useState, useRef } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../../firebase'
import { addDoctorNote, addTestResult, saveTreatmentSummary } from '../../lib/firestore'
import { uploadStayDocument } from '../../lib/storageUtils'
import { extractTextFromPdf } from '../../lib/pdfUtils'
import { todayStr } from '../../lib/medUtils'

const NOTE_TYPES = ['Progress Note', 'Consult Note', 'Discharge Summary', 'H&P', 'Operative Note', 'Nursing Note', 'Social Work Note', 'Other']

async function generateTreatmentSummary(stayId, allNotes, allResults) {
  if (allNotes.length === 0 && allResults.length === 0) return
  try {
    const fn = httpsCallable(functions, 'askClaude')

    const notesText = allNotes
      .slice().sort((a, b) => b.date.localeCompare(a.date))
      .map(n => `[${n.date}] ${[n.noteType, n.author].filter(Boolean).join(' · ')}\n${n.extractedText || n.interpretation || ''}`)
      .join('\n\n---\n\n')

    const resultsText = allResults
      .slice().sort((a, b) => b.date.localeCompare(a.date))
      .map(r => `[${r.date}] ${r.testName || 'Test Result'}\n${r.extractedText || r.interpretation || ''}`)
      .join('\n\n---\n\n')

    const userContent = [
      allNotes.length > 0 && `DOCTOR NOTES:\n${notesText}`,
      allResults.length > 0 && `TEST RESULTS:\n${resultsText}`,
    ].filter(Boolean).join('\n\n')

    const systemContext = `You are a medical care coordinator summarizing a patient's ongoing hospital treatment for their family. Based on the doctor notes and test results provided, write a structured treatment summary with exactly these 4 labeled sections:

CURRENT REGIMEN
Describe the active treatments, drugs, and therapies currently in use.

RECENT DECISIONS
Summarize the key clinical decisions or changes made at the most recent visits.

ACTIVE CONCERNS
List the symptoms, lab values, or conditions the care team flagged to watch closely.

NEXT STEPS
Describe upcoming tests, treatments, decisions, or follow-up actions the doctors mentioned.

Write each section as 2-4 plain English sentences. No medical jargon. No markdown, no bullet points, no bold text. Use exactly the section labels above on their own line before each section's text.`

    const { data } = await fn({
      messages: [{ role: 'user', content: userContent }],
      systemContext,
    })
    await saveTreatmentSummary(stayId, data.content)
  } catch {
    // Silent — treatment summary is best-effort
  }
}

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
  const [interpreting, setInterpreting] = useState(false)
  const [interpretError, setInterpretError] = useState(null)
  const [showRaw, setShowRaw] = useState(false)
  const [saving, setSaving] = useState(false)
  const [fileObj, setFileObj] = useState(null)
  const fileInputRef = useRef(null)

  async function handleFileSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileObj(file)
    setFileName(file.name)
    setInterpretation('')
    setInterpretError(null)
    setNeedsFallback(false)
    setExtractedText('')
    setFallbackText('')
    setShowRaw(false)

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

First, look for the author or provider name in the note — check for labels like "Attending:", "Provider:", "Author:", "Signed by:", "Dictated by:", or a signature block. If you find a name, output it on the very first line in exactly this format:
AUTHOR: <name>

Then on a new line, translate the note into plain English. Focus on: what the doctor observed or assessed, any key decisions made, current treatment status, and what to expect next. Write 3-5 clear bullet points, each starting with a dash (-). No markdown headers, no bold text, no medical jargon.`
        : `You are helping a family understand medical test results for their father. Extract and explain the key findings from this report in plain English. Flag anything outside normal range and explain what it means clinically. Write 3-5 clear bullet points, each starting with a dash (-). No markdown headers, no bold text, no medical jargon.`
      const { data } = await fn({
        messages: [{ role: 'user', content: text }],
        systemContext,
      })
      if (isNote) {
        const lines = data.content.split('\n')
        if (lines[0].startsWith('AUTHOR:')) {
          const extracted = lines[0].replace('AUTHOR:', '').trim()
          if (extracted) setAuthor(extracted)
          setInterpretation(lines.slice(1).join('\n').trimStart())
        } else {
          setInterpretation(data.content)
        }
      } else {
        setInterpretation(data.content)
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
      } else {
        savedEntry = await addTestResult(stayId, { ...base, testName: testName.trim() })
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
              className="btn-primary"
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
