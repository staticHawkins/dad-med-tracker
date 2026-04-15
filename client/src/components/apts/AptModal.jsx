import { useState, useEffect, useRef } from 'react'
import { saveApt } from '../../lib/firestore'
import { useSpecialties, specialtyLabel } from '../../hooks/useSpecialties'

const EMPTY = {
  title: '', dateTime: '', type: '', doctor: '', location: '', covering: '',
  prep: '', postNotes: ''
}

export default function AptModal({ apts, careTeam = [], editId, onClose }) {
  const specialties = useSpecialties()
  const [form, setForm] = useState(EMPTY)
  const [saveStatus, setSaveStatus] = useState('idle') // idle | saving | saved | error
  const [creating, setCreating] = useState(false)
  const saveTimer = useRef(null)
  const savedTimer = useRef(null)
  const isDirty = useRef(false)
  const lastForm = useRef(null)
  const dragStartY = useRef(null)

  const isEditing = !!editId
  const isOpen = editId !== undefined

  useEffect(() => {
    isDirty.current = false
    if (!editId) { setForm(EMPTY); return }
    const a = apts.find(x => x.id === editId)
    if (a) setForm({
      title: a.title || '', dateTime: a.dateTime || '', type: a.type || '',
      doctor: a.doctor || '', location: a.location || '', covering: a.covering || '',
      prep: a.prep || '', postNotes: a.postNotes || ''
    })
  }, [editId])

  useEffect(() => {
    if (!isEditing || !isDirty.current) return
    if (!form.title.trim() || !form.dateTime) return
    lastForm.current = form
    setSaveStatus('saving')
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      try {
        await saveApt(form, editId)
        setSaveStatus('saved')
        clearTimeout(savedTimer.current)
        savedTimer.current = setTimeout(() => setSaveStatus('idle'), 2500)
      } catch {
        setSaveStatus('error')
      }
    }, 600)
    return () => clearTimeout(saveTimer.current)
  }, [form])

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function set(field) {
    return e => {
      isDirty.current = true
      setForm(f => ({ ...f, [field]: e.target.value }))
    }
  }

  async function retryWrite() {
    if (!lastForm.current) return
    setSaveStatus('saving')
    try {
      await saveApt(lastForm.current, editId)
      setSaveStatus('saved')
      clearTimeout(savedTimer.current)
      savedTimer.current = setTimeout(() => setSaveStatus('idle'), 2500)
    } catch {
      setSaveStatus('error')
    }
  }

  async function handleCreate() {
    if (!form.title.trim()) { alert('Please enter the appointment title.'); return }
    if (!form.dateTime)     { alert('Please enter the date and time.'); return }
    setCreating(true)
    try {
      await saveApt(form, null)
      onClose()
    } catch { alert('Failed to save. Check your connection.') }
    setCreating(false)
  }

  const sheetRef = useRef(null)

  function onTouchStart(e) {
    dragStartY.current = e.touches[0].clientY
  }
  function onTouchMove(e) {
    if (dragStartY.current === null || !sheetRef.current) return
    const delta = e.touches[0].clientY - dragStartY.current
    if (delta > 0) sheetRef.current.style.transform = `translateY(${delta}px)`
  }
  function onTouchEnd(e) {
    if (dragStartY.current === null) return
    const delta = e.changedTouches[0].clientY - dragStartY.current
    dragStartY.current = null
    if (sheetRef.current) sheetRef.current.style.transform = ''
    if (delta > 80) onClose()
  }

  return (
    <>
      {isOpen && (
        <div className="sheet-backdrop" onClick={onClose} />
      )}
      <div
        ref={sheetRef}
        className={`edit-sheet${isOpen ? ' open' : ''}`}
        role="dialog"
        aria-modal="true"
      >
        <div
          className="sheet-handle"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        />
        <div
          className="sheet-header"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <span className="sheet-title">{isEditing ? 'Edit appointment' : 'Add appointment'}</span>
          <div className="sheet-header-right">
            {saveStatus !== 'idle' && (
              <span
                className={`autosave-pill ${saveStatus}`}
                onClick={saveStatus === 'error' ? retryWrite : undefined}
              >
                <span className="autosave-pill-dot" />
                {saveStatus === 'saving' && 'Saving…'}
                {saveStatus === 'saved'  && 'Saved'}
                {saveStatus === 'error'  && 'Not saved · Retry'}
              </span>
            )}
            <button className="note-close-btn" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>

        <div className="sheet-body">
          <div className="sheet-section">Appointment details</div>
          <div className="fr">
            <label>Title <span className="req">*</span></label>
            <input autoFocus={isOpen} value={form.title} onChange={set('title')} placeholder="e.g. Cardiology follow-up" />
          </div>
          <div className="f2">
            <div className="fr">
              <label>Date &amp; time <span className="req">*</span></label>
              <input type="datetime-local" value={form.dateTime} onChange={set('dateTime')} />
            </div>
            <div className="fr">
              <label>Type</label>
              <select value={form.type} onChange={set('type')}>
                <option value="">Select type…</option>
                <option value="checkup">Checkup</option>
                <option value="specialist">Specialist</option>
                <option value="lab">Lab / blood work</option>
                <option value="imaging">Imaging</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="sheet-section">Provider &amp; location</div>
          <div className="fr">
            <label>Doctor / provider</label>
            <select value={form.doctor} onChange={set('doctor')}>
              <option value="">No doctor</option>
              {careTeam.map(dr => (
                <option key={dr.id} value={dr.name}>{dr.name}{dr.specialty ? ` · ${specialtyLabel(specialties, dr.specialty)}` : ''}</option>
              ))}
            </select>
          </div>
          <div className="f2">
            <div className="fr">
              <label>Location</label>
              <input value={form.location} onChange={set('location')} placeholder="Clinic or hospital" />
            </div>
            <div className="fr">
              <label>Covering</label>
              <div className="assignee-pills covering-pills">
                {[{v:'fanuel',l:'Fanuel'},{v:'saron',l:'Saron'}].map(({v,l}) => {
                  const selected = form.covering === v
                  return (
                    <button key={v} type="button"
                      className={`assignee-pill${selected ? ' selected' : ''}`}
                      onClick={() => { isDirty.current = true; setForm(f => ({ ...f, covering: f.covering === v ? '' : v })) }}
                    >
                      {selected && <span className="assignee-pill-dot" />}
                      {l}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="sheet-section">Prep instructions &amp; questions</div>
          <div className="fr">
            <textarea value={form.prep} onChange={set('prep')} placeholder="Pre-visit instructions, questions to ask…" style={{ minHeight: 80 }} />
          </div>

          <div className="sheet-section">Post appointment notes</div>
          <div className="fr">
            <textarea value={form.postNotes} onChange={set('postNotes')} placeholder="Follow-up notes from the visit…" style={{ minHeight: 80 }} />
          </div>

          {!isEditing && (
            <div className="mf">
              <button className="btn-cx" onClick={onClose}>Cancel</button>
              <button className="btn-sv" onClick={handleCreate} disabled={creating}>
                {creating ? 'Adding…' : 'Add appointment'}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
