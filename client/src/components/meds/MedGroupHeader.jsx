export default function MedGroupHeader({ label, count, variant, isOpen, onToggle }) {
  return (
    <div className={`med-group-hdr med-group-hdr-${variant}`}>
      <span className="med-group-label">{label}</span>
      <span className="med-group-count">{count}</span>
      {onToggle && (
        <button className="med-group-toggle" onClick={onToggle}>
          {isOpen ? 'Hide ›' : 'Show ›'}
        </button>
      )}
    </div>
  )
}
