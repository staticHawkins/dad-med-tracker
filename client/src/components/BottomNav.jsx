const NAV_ITEMS = [
  { id: 'dashboard', label: 'Home',  icon: '⊞' },
  { id: 'meds',      label: 'Meds',  icon: '💊' },
  { id: 'apts',      label: 'Appts', icon: '📅' },
  { id: 'tasks',     label: 'Tasks', icon: '✓'  },
  { id: 'timeline',  label: 'Timeline', icon: '⏱' },
]

export default function BottomNav({ activeTab, onNavigate }) {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {NAV_ITEMS.map(item => (
        <button
          key={item.id}
          className={`bnav-item${activeTab === item.id ? ' active' : ''}`}
          onClick={() => onNavigate(item.id)}
          aria-label={item.label}
          aria-current={activeTab === item.id ? 'page' : undefined}
        >
          <span className="bnav-icon">{item.icon}</span>
          <span className="bnav-label">{item.label}</span>
        </button>
      ))}
    </nav>
  )
}
