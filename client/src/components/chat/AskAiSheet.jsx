import { useState, useRef, useEffect } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../../firebase'
import { st, pillsNow, freqLabel } from '../../lib/medUtils'
import { aptStatus, fmtAptDateBlock, fmtAptTime } from '../../lib/aptUtils'

function getTaskStatus(task) {
  return task.status || (task.done ? 'done' : 'todo')
}

function buildSuggestions(meds, apts, tasks) {
  const suggestions = []

  const sorted = [...apts].sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime))
  const nextApt = sorted.find(a => aptStatus(a) !== 'past')
  if (nextApt?.doctor) {
    const db = fmtAptDateBlock(nextApt.dateTime)
    suggestions.push({
      icon: '📅',
      text: `What should I tell ${nextApt.doctor} before ${db.month} ${db.day}?`
    })
  }

  const atRisk = meds.filter(m => st(m) !== 'ok')
  if (atRisk.length > 0) {
    suggestions.push({ icon: '+', text: 'Any interactions between current meds?' })
  }

  suggestions.push({ icon: '✓', text: 'Summarize this week for the care team' })

  return suggestions.slice(0, 3)
}

function buildSystemContext(meds, apts, tasks, careTeam) {
  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })

  const medsSection = meds.length === 0 ? 'No medications on file.' : meds.map(m => {
    const { daysToZero, rem } = pillsNow(m)
    const status = st(m)
    const label = freqLabel(m)
    const days = daysToZero < 999 ? `${daysToZero} days left` : 'as-needed'
    return `- ${m.name}${m.dose ? ` ${m.dose}` : ''}${label ? `, ${label}` : ''}: ${rem} pills, ${days} [${status}]`
  }).join('\n')

  const sorted = [...apts].sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime))
  const upcoming = sorted.filter(a => aptStatus(a) !== 'past')
  const aptsSection = upcoming.length === 0 ? 'No upcoming appointments.' : upcoming.slice(0, 8).map(a => {
    const db = fmtAptDateBlock(a.dateTime)
    const time = fmtAptTime(a.dateTime)
    const when = `${db.month} ${db.day}${time ? ` at ${time}` : ''}`
    const dr = a.doctor ? ` with ${a.doctor}` : ''
    const loc = a.location ? ` at ${a.location}` : ''
    return `- ${when}: ${a.title}${dr}${loc}`
  }).join('\n')

  const openTasks = tasks.filter(t => getTaskStatus(t) !== 'done')
  const tasksSection = openTasks.length === 0 ? 'No open tasks.' : openTasks.map(t => {
    const s = getTaskStatus(t)
    const due = t.dueDate ? ` — due ${t.dueDate}` : ''
    return `- [${s}] ${t.title}${due}`
  }).join('\n')

  const careSection = careTeam.length === 0 ? 'No care team on file.' : careTeam.map(d => {
    const spec = d.specialty ? ` (${d.specialty})` : ''
    const aff = d.affiliation ? ` at ${d.affiliation}` : ''
    return `- ${d.name}${spec}${aff}`
  }).join('\n')

  return `You are a helpful assistant for a family caring for their father. Answer questions concisely and accurately based only on the data provided below. Today is ${dateStr}.

MEDICATIONS (${meds.length} total):
${medsSection}

UPCOMING APPOINTMENTS:
${aptsSection}

OPEN TASKS (${openTasks.length}):
${tasksSection}

CARE TEAM (${careTeam.length}):
${careSection}

When referencing urgent items, use [urgent] and [/urgent] tags to wrap the key sentence. For informational highlights, use [info] and [/info] tags. Keep responses focused and practical.`
}

function buildActionChips(apts, tasks) {
  const chips = []

  const sorted = [...apts].sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime))
  const nextApt = sorted.find(a => aptStatus(a) !== 'past')
  if (nextApt?.doctor) {
    chips.push({ label: `Draft message to ${nextApt.doctor}`, msg: `Draft a brief message I can send to ${nextApt.doctor} about my dad's current status and upcoming visit.` })
  }

  chips.push({ label: 'Show full med list', msg: 'List all current medications with their status.' })

  const hasOpenTasks = tasks.some(t => getTaskStatus(t) !== 'done')
  if (hasOpenTasks) {
    chips.push({ label: 'Add prep task', msg: 'What prep tasks should I add before the next appointment?' })
  }

  return chips.slice(0, 3)
}

function renderAiContent(text) {
  const parts = []
  let remaining = text
  let key = 0

  while (remaining.length > 0) {
    const urgentStart = remaining.indexOf('[urgent]')
    const infoStart = remaining.indexOf('[info]')

    let nextTag = -1
    let tagType = null
    if (urgentStart !== -1 && (infoStart === -1 || urgentStart < infoStart)) {
      nextTag = urgentStart; tagType = 'urgent'
    } else if (infoStart !== -1) {
      nextTag = infoStart; tagType = 'info'
    }

    if (nextTag === -1) {
      if (remaining) parts.push(<span key={key++}>{remaining}</span>)
      break
    }

    if (nextTag > 0) {
      parts.push(<span key={key++}>{remaining.slice(0, nextTag)}</span>)
    }

    const closeTag = `[/${tagType}]`
    const closeIdx = remaining.indexOf(closeTag, nextTag)
    if (closeIdx === -1) {
      parts.push(<span key={key++}>{remaining.slice(nextTag)}</span>)
      break
    }

    const openTagLen = tagType === 'urgent' ? 8 : 6
    const inner = remaining.slice(nextTag + openTagLen, closeIdx)
    parts.push(
      <div key={key++} className={tagType === 'urgent' ? 'chat-highlight-red' : 'chat-highlight-blue'}>
        {inner}
      </div>
    )
    remaining = remaining.slice(closeIdx + closeTag.length)
  }

  return parts
}

export default function AskAiSheet({ open, onClose, meds, apts, tasks, careTeam }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  const upcomingCount = apts.filter(a => aptStatus(a) !== 'past').length
  const activeTaskCount = tasks.filter(t => getTaskStatus(t) !== 'done').length

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    if (open) document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  async function send(text) {
    const msg = (text ?? input).trim()
    if (!msg || loading) return
    const next = [...messages, { role: 'user', content: msg }]
    setMessages(next)
    setInput('')
    setLoading(true)
    setError(null)
    try {
      const fn = httpsCallable(functions, 'askClaude')
      const { data } = await fn({
        messages: next,
        systemContext: buildSystemContext(meds, apts, tasks, careTeam)
      })
      setMessages(m => [...m, { role: 'assistant', content: data.content }])
    } catch (e) {
      setError('Could not reach AI. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  if (!open) return null

  const suggestions = buildSuggestions(meds, apts, tasks)
  const actionChips = buildActionChips(apts, tasks)
  const isFirstMessage = messages.length === 0

  return (
    <>
      <div className="ask-ai-backdrop" onClick={onClose} />
      <div className="ask-ai-sheet" role="dialog" aria-label="Ask AI">
        <div className="ask-ai-handle" />

        <div className="ask-ai-header">
          <span className="ask-ai-icon-sm">⊙</span>
          <span className="ask-ai-title">Ask AI</span>
          <span className="ask-ai-badge">All data loaded</span>
          <button className="ask-ai-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="ask-ai-ctx">
          <span className="ai-ctx-chip">• {meds.length} meds</span>
          <span className="ai-ctx-chip">• {upcomingCount} appt{upcomingCount !== 1 ? 's' : ''}</span>
          <span className="ai-ctx-chip">• {activeTaskCount} task{activeTaskCount !== 1 ? 's' : ''}</span>
          <span className="ai-ctx-chip">• {careTeam.length} doctor{careTeam.length !== 1 ? 's' : ''}</span>
        </div>

        {isFirstMessage && suggestions.length > 0 && (
          <div className="ask-ai-suggestions">
            <div className="ask-ai-section-label">Suggested</div>
            {suggestions.map((s, i) => (
              <button key={i} className="ask-ai-suggestion" onClick={() => send(s.text)}>
                <span className="ask-ai-sugg-icon">{s.icon}</span>
                <span>{s.text}</span>
              </button>
            ))}
          </div>
        )}

        <div className="ask-ai-messages">
          {messages.map((m, i) => (
            m.role === 'user' ? (
              <div key={i} className="chat-row-user">
                <div className="chat-bubble-user">{m.content}</div>
              </div>
            ) : (
              <div key={i} className="chat-row-ai">
                <div className="chat-ai-avatar">⊙</div>
                <div className="chat-bubble-ai">
                  {renderAiContent(m.content)}
                  {i === messages.length - 1 && (
                    <div className="chat-actions">
                      {actionChips.map((chip, ci) => (
                        <button key={ci} className="chat-action-btn" onClick={() => send(chip.msg)}>
                          {chip.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          ))}
          {loading && (
            <div className="chat-row-ai">
              <div className="chat-ai-avatar">⊙</div>
              <div className="chat-bubble-ai chat-typing">
                <span /><span /><span />
              </div>
            </div>
          )}
          {error && <div className="ask-ai-error">{error}</div>}
          <div ref={bottomRef} />
        </div>

        <div className="ask-ai-input-bar">
          <textarea
            ref={inputRef}
            className="ask-ai-input"
            placeholder="Ask about medications, appointments..."
            value={input}
            rows={1}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            className="ask-ai-send"
            onClick={() => send()}
            disabled={!input.trim() || loading}
            aria-label="Send"
          >
            →
          </button>
        </div>
      </div>
    </>
  )
}
