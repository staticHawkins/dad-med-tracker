const TYPE_CLASS = {
  response:        'tl-tag-green',
  progression:     'tl-tag-red',
  hospitalization: 'tl-tag-red',
  regimen:         'tl-tag-blue',
  symptom:         'tl-tag-amber',
  functional:      'tl-tag-purple',
  neutral:         'tl-tag-gray',
}

export default function MilestoneTag({ label, type }) {
  const cls = TYPE_CLASS[type] || 'tl-tag-gray'
  return <span className={`tl-tag ${cls}`}>{label}</span>
}
