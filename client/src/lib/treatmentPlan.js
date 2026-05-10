import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase'
import { saveTreatmentSummary } from './firestore'

const SYSTEM_CONTEXT = `You are a medical care coordinator summarizing a patient's ongoing hospital treatment for his family. Based on the doctor notes and test results provided, identify each active clinical problem being managed (for example: Acute Kidney Injury, Liver Disease, High Potassium) and write a plain-English summary for each one. Always refer to the patient as "your dad" — never "the patient", "he", or "your loved one".

Your entire response must be a valid JSON array. Start your response with [ and end with ]. Do not include any text before or after the array. Do not use markdown code fences. Each array item must have exactly two string fields: "problem" (condition name in plain English, no abbreviations) and "summary" (1-2 short sentences maximum: current status and what the team is doing). Keep each summary brief. Only include problems actively being managed.`

function parseProblems(raw) {
  const start = raw.indexOf('[')
  let depth = 0, end = -1
  for (let i = start; i < raw.length; i++) {
    if (raw[i] === '[') depth++
    else if (raw[i] === ']') { depth--; if (depth === 0) { end = i; break } }
  }
  const slice = start !== -1
    ? (end !== -1 ? raw.slice(start, end + 1) : raw.slice(start) + ']')
    : raw
  return JSON.parse(slice)
}

function buildPlanContext(allNotes, allResults) {
  // Keep only the most recent note per author and most recent result per test name
  const latestByAuthor = Object.values(
    allNotes.reduce((acc, n) => {
      const key = (n.author || `__unknown_${n.id}`).toLowerCase()
      if (!acc[key] || n.date > acc[key].date) acc[key] = n
      return acc
    }, {})
  ).sort((a, b) => b.date.localeCompare(a.date))

  const latestByTest = Object.values(
    allResults.reduce((acc, r) => {
      const key = (r.testName || `__unknown_${r.id}`).toLowerCase()
      if (!acc[key] || r.date > acc[key].date) acc[key] = r
      return acc
    }, {})
  ).sort((a, b) => b.date.localeCompare(a.date))

  // Prefer interpretation (concise AI bullets) over raw extracted text
  const notesText = latestByAuthor
    .map(n => {
      const header = `[${n.date}] ${[n.noteType, n.author].filter(Boolean).join(' · ')}`
      const body = n.interpretation || (n.extractedText || '').slice(0, 2000)
      return `${header}\n${body}`
    })
    .join('\n\n---\n\n')

  const resultsText = latestByTest
    .map(r => {
      const header = `[${r.date}] ${r.testName || 'Test Result'}`
      const body = r.interpretation || (r.extractedText || '').slice(0, 2000)
      return `${header}\n${body}`
    })
    .join('\n\n---\n\n')

  return [
    latestByAuthor.length > 0 && `DOCTOR NOTES (most recent per provider):\n${notesText}`,
    latestByTest.length > 0 && `TEST RESULTS (most recent per test):\n${resultsText}`,
  ].filter(Boolean).join('\n\n')
}

export async function generateTreatmentSummary(stayId, allNotes, allResults) {
  if (allNotes.length === 0 && allResults.length === 0) return
  try {
    const fn = httpsCallable(functions, 'askClaude')
    const userContent = buildPlanContext(allNotes, allResults)
    const { data } = await fn({ messages: [{ role: 'user', content: userContent }], systemContext: SYSTEM_CONTEXT })
    let problems
    try {
      problems = parseProblems(data.content)
    } catch {
      problems = [{ problem: 'Treatment Summary', summary: data.content }]
    }
    await saveTreatmentSummary(stayId, problems)
  } catch {
    // Silent — treatment summary is best-effort
  }
}
