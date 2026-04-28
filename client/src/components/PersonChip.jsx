export default function PersonChip({ person }) {
  return (
    <span className={`person-chip person-chip-${person || 'dad'}`}>
      {person === 'mom' ? 'Mom' : 'Dad'}
    </span>
  )
}
