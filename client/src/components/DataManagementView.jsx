import { useState, useEffect, useCallback } from 'react'
import {
  PERSON_COLLECTIONS,
  countPersonData,
  softDeletePersonData,
  restorePersonData,
  hardDeletePersonData,
} from '../lib/firestore'

const PEOPLE = [
  { id: 'dad', label: 'Dad' },
  { id: 'mom', label: 'Mom' },
]

const COLLECTION_LABELS = {
  medications: 'Medications',
  appointments: 'Appointments',
  tasks: 'Tasks',
  careTeam: 'Care Team',
  hospitalStays: 'Hospital Stays',
}

export default function DataManagementView() {
  const [person, setPerson] = useState('dad')
  const [counts, setCounts] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const [confirmText, setConfirmText] = useState('')

  const personLabel = PEOPLE.find(p => p.id === person)?.label ?? person

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setCounts(await countPersonData(person))
    } catch (err) {
      console.error('countPersonData error:', err)
      setMessage({ type: 'error', text: 'Could not load data counts.' })
    } finally {
      setLoading(false)
    }
  }, [person])

  useEffect(() => { refresh() }, [refresh])

  function onPersonChange(newPerson) {
    setPerson(newPerson)
    setMessage(null)
    setConfirmText('')
  }

  const totals = counts
    ? Object.values(counts).reduce(
        (acc, c) => ({ active: acc.active + c.active, deleted: acc.deleted + c.deleted }),
        { active: 0, deleted: 0 }
      )
    : { active: 0, deleted: 0 }

  async function run(label, fn, successText) {
    setBusy(true)
    setMessage(null)
    try {
      await fn(person)
      await refresh()
      setMessage({ type: 'ok', text: successText })
    } catch (err) {
      console.error(`${label} error:`, err)
      setMessage({ type: 'error', text: `${label} failed. Nothing may have been changed.` })
    } finally {
      setBusy(false)
      setConfirmText('')
    }
  }

  function onSoftDelete() {
    if (!window.confirm(`Soft delete all of ${personLabel}’s data (${totals.active} active records)? This hides it everywhere but can be restored from this screen.`)) return
    run(‘Soft delete’, softDeletePersonData, ‘Soft deleted. Records are hidden but recoverable below.’)
  }

  function onRestore() {
    run(‘Restore’, restorePersonData, ‘Restored. Records are visible in the app again.’)
  }

  function onHardDelete() {
    if (confirmText !== ‘DELETE’) return
    if (!window.confirm(`Permanently delete ALL of ${personLabel}’s data (${totals.active + totals.deleted} records)? This CANNOT be undone.`)) return
    run(‘Hard delete’, hardDeletePersonData, `Permanently deleted all of ${personLabel}’s data.`)
  }

  return (
    <div className="page">
      <h2 style={{ margin: '0 0 12px', fontSize: 20, fontWeight: 700 }}>Manage Data</h2>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {PEOPLE.map(p => (
          <button
            key={p.id}
            onClick={() => onPersonChange(p.id)}
            style={{
              fontFamily: 'var(--ff)',
              fontSize: 13,
              fontWeight: 600,
              padding: '6px 18px',
              borderRadius: 20,
              border: '1px solid var(--border2)',
              background: person === p.id ? 'var(--accent)' : 'transparent',
              color: person === p.id ? '#fff' : 'var(--text2)',
              cursor: 'pointer',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <p style={{ margin: '0 0 24px', color: 'var(--text2)', fontSize: 14, maxWidth: 560 }}>
        Soft delete hides every record tagged to {personLabel} across medications, appointments, tasks,
        care team, and hospital stays &mdash; it can be undone here. Hard delete removes those
        records permanently and cannot be undone.
      </p>

      {loading ? (
        <p style={{ color: 'var(--text2)', fontSize: 14 }}>Loading&hellip;</p>
      ) : (
        <>
          <div
            style={{
              border: '1px solid var(--border)',
              borderRadius: 10,
              overflow: 'hidden',
              maxWidth: 560,
              marginBottom: 24,
            }}
          >
            {PERSON_COLLECTIONS.map((name, i) => {
              const c = counts?.[name] || { active: 0, deleted: 0 }
              return (
                <div
                  key={name}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '11px 16px',
                    fontSize: 14,
                    borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                  }}
                >
                  <span>{COLLECTION_LABELS[name] || name}</span>
                  <span style={{ color: 'var(--text2)' }}>
                    {c.active} active
                    {c.deleted > 0 && (
                      <span style={{ color: 'var(--red)' }}> &middot; {c.deleted} soft-deleted</span>
                    )}
                  </span>
                </div>
              )
            })}
          </div>

          {message && (
            <p
              style={{
                fontSize: 13,
                marginBottom: 18,
                color: message.type === 'error' ? 'var(--red)' : 'var(--text)',
              }}
            >
              {message.text}
            </p>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 32 }}>
            <button
              className="btn-ghost"
              disabled={busy || totals.active === 0}
              onClick={onSoftDelete}
            >
              Soft delete all ({totals.active})
            </button>
            <button
              className="btn-ghost"
              disabled={busy || totals.deleted === 0}
              onClick={onRestore}
            >
              Restore soft-deleted ({totals.deleted})
            </button>
          </div>

          <div
            style={{
              border: '1px solid var(--red-border)',
              background: 'var(--red-dim)',
              borderRadius: 10,
              padding: 18,
              maxWidth: 560,
            }}
          >
            <div style={{ fontWeight: 700, color: 'var(--red)', marginBottom: 6 }}>
              Danger zone
            </div>
            <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text2)' }}>
              Permanently delete all {totals.active + totals.deleted} of {personLabel}&rsquo;s records
              (including soft-deleted). This cannot be undone. Type{' '}
              <strong>DELETE</strong> to enable the button.
            </p>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                placeholder="DELETE"
                disabled={busy || totals.active + totals.deleted === 0}
                style={{
                  fontFamily: 'var(--ff)',
                  fontSize: 13,
                  padding: '8px 12px',
                  borderRadius: 7,
                  border: '1px solid var(--border2)',
                  background: 'transparent',
                  color: 'var(--text)',
                }}
              />
              <button
                onClick={onHardDelete}
                disabled={busy || confirmText !== 'DELETE' || totals.active + totals.deleted === 0}
                style={{
                  fontFamily: 'var(--ff)',
                  fontSize: 13,
                  fontWeight: 600,
                  padding: '8px 20px',
                  borderRadius: 7,
                  border: 'none',
                  background: 'var(--red)',
                  color: '#fff',
                  cursor: confirmText === 'DELETE' && !busy ? 'pointer' : 'not-allowed',
                  opacity: confirmText === 'DELETE' && !busy ? 1 : 0.5,
                }}
              >
                Permanently delete everything
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
