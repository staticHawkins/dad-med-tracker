export function parseSection(text, sectionName) {
  const escaped = sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // Match the section header (line by itself with optional colon)
  // Capture until next section-like header or e-signature block
  const re = new RegExp(
    `^${escaped}:?[\\t ]*\\n([\\s\\S]*?)(?=\\n[A-Z][\\w &/,()-]*:[\\t ]*\\n|\\n_ESign|$)`,
    'im'
  )
  const m = text.match(re)
  if (!m || !m[1]) return ''
  return m[1]
    .replace(/\t/g, '')
    .replace(/^\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function deriveSpecialty(noteName) {
  if (/hemonc|oncol/i.test(noteName)) return 'oncology'
  if (/palliativ/i.test(noteName)) return 'palliative'
  if (/liver|hepat/i.test(noteName)) return 'liver'
  if (/kidney|nephro/i.test(noteName)) return 'kidney'
  return 'other'
}

export const SPECIALTIES = {
  oncology:   'Oncology',
  palliative: 'Palliative',
  liver:      'Liver',
  kidney:     'Kidney',
  other:      'Other',
}
