export function parseSection(text, sectionName) {
  const escaped = sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // Match section header preceded by newline (or start of string) — no 'm' flag
  // so '$' anchors to end-of-string, not end-of-line (fixes lazy capture stopping too early)
  const re = new RegExp(
    `(?:^|\\n)${escaped}:?[ \\t]*\\n([\\s\\S]*?)(?=\\n[A-Z][\\w &/,()\\-*]+:[ \\t]*\\n|\\n_ESign|$)`,
    'i'
  )
  const m = text.match(re)
  if (!m || !m[1]) return ''
  return m[1]
    .replace(/\t/g, '')
    .replace(/^\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
