import { useState, useEffect } from 'react'
import { parseSection } from '../../lib/noteUtils'

const SECTIONS = ['Impression', 'Plan', 'Problem List']

export default function ClinicalNoteModal({ note, onClose }) {
  const [fullOpen, setFullOpen] = useState(false)

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const date = note.date
    ? new Date(note.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : ''

  return (
    <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal note-modal">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ marginBottom: 4 }}>{note.noteName}</h2>
            <div className="note-meta">{note.author}{date ? ` · ${date}` : ''}</div>
          </div>
          <button className="note-close-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {SECTIONS.map(name => {
          const text = parseSection(note.textContent || '', name)
          return (
            <div key={name} className="note-key-section">
              <div className="note-key-label">{name}</div>
              {text
                ? <div className="note-key-text">{text}</div>
                : <div className="expand-empty">Not documented</div>}
            </div>
          )
        })}

        <button className="note-full-toggle" onClick={() => setFullOpen(o => !o)}>
          {fullOpen ? '▲ Hide full note' : '▶ Show full note'}
        </button>
        {fullOpen && (
          <div className="note-full-text">{note.textContent}</div>
        )}
      </div>
    </div>
  )
}
