import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase'
import { requestNotificationPermission } from '../lib/notifications'
import { useMeds } from '../hooks/useMeds'
import { useApts } from '../hooks/useApts'
import { useCareTeam } from '../hooks/useCareTeam'
import { useTasks } from '../hooks/useTasks'
import { useUsers } from '../hooks/useUsers'
import { useMilestones } from '../hooks/useMilestones'
import { usePhases } from '../hooks/usePhases'
import { upsertUser } from '../lib/firestore'
import { useNotifications } from '../hooks/useNotifications'
import MedicationsView from './meds/MedicationsView'
import PersonChip from './PersonChip'
import AppointmentsView from './apts/AppointmentsView'
import TasksView from './tasks/TasksView'
import CareTeamPanel from './CareTeamPanel'
import DashboardView, { BackBar } from './DashboardView'
import TimelineView from './timeline/TimelineView'
import AskAiSheet from './chat/AskAiSheet'
import NotificationBanner from './NotificationBanner'
import BottomNav from './BottomNav'

export function filterByPerson(items, personFilter) {
  if (personFilter === 'all') return items
  return items.filter(item => (item.person || 'dad') === personFilter)
}

function PersonFilter({ value, onChange }) {
  return (
    <div className="person-filter">
      {['all', 'dad', 'mom'].map(p => (
        <button
          key={p}
          className={`pfill pfill-${p}${value === p ? ' on' : ''}`}
          onClick={() => onChange(p)}
        >
          {p === 'all' ? 'All' : p.charAt(0).toUpperCase() + p.slice(1)}
        </button>
      ))}
    </div>
  )
}

const SIDEBAR_ITEMS = [
  { id: 'dashboard', label: 'Dashboard',    icon: '⊞' },
  { id: 'meds',      label: 'Medications',  icon: '💊' },
  { id: 'apts',      label: 'Appointments', icon: '📅' },
  { id: 'tasks',     label: 'Tasks',        icon: '✓'  },
  { id: 'timeline',  label: 'Timeline',     icon: '⏱' },
  { id: 'care-team', label: 'Care Team',    icon: '👥' },
]

function Sidebar({ activeTab, onNavigate, onAskAi }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-dot" />
        Family Care Hub
      </div>
      <nav className="sidebar-nav">
        {SIDEBAR_ITEMS.map(item => (
          <button
            key={item.id}
            className={`sidebar-item${activeTab === item.id ? ' active' : ''}`}
            onClick={() => onNavigate(item.id)}
            aria-current={activeTab === item.id ? 'page' : undefined}
          >
            <span className="sidebar-icon">{item.icon}</span>
            <span className="sidebar-label">{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-spacer" />
      <button className="sidebar-ask-ai" onClick={onAskAi}>
        <span className="sidebar-icon">✦</span>
        <span className="sidebar-label">Ask AI</span>
      </button>
    </aside>
  )
}

export default function MainApp({ user }) {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [personFilter, setPersonFilter] = useState('all')
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [askAiOpen, setAskAiOpen] = useState(false)
  const userMenuRef = useRef(null)

  const [notifPermission, setNotifPermission] = useState(
    () => ('Notification' in window ? Notification.permission : 'unsupported')
  )

  const handleNotifClick = useCallback(async () => {
    if (notifPermission === 'granted') return
    if (notifPermission === 'denied') return
    const token = await requestNotificationPermission(user?.uid)
    setNotifPermission('Notification' in window ? Notification.permission : 'unsupported')
    if (token) setUserMenuOpen(false)
  }, [notifPermission, user?.uid])

  useEffect(() => {
    function handleClick(e) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    upsertUser(user).catch(() => {})
  }, [user])

  useNotifications(user)

  const meds = useMeds()
  const activeMeds = meds.filter(m => m.active !== false)
  const apts = useApts()
  const careTeam = useCareTeam()
  const tasks = useTasks()
  const users = useUsers()
  const milestones = useMilestones()
  const phases = usePhases()

  const filteredMeds  = useMemo(() => filterByPerson(activeMeds, personFilter),  [activeMeds,  personFilter])
  const filteredApts  = useMemo(() => filterByPerson(apts,       personFilter),  [apts,        personFilter])
  const filteredTasks = useMemo(() => filterByPerson(tasks,      personFilter),  [tasks,       personFilter])

  return (
    <>
      <div className="app-outer">
        <Sidebar activeTab={activeTab} onNavigate={setActiveTab} onAskAi={() => setAskAiOpen(true)} />

        <div className="app-main">
          <div className="topbar">
            <div className="brand topbar-brand-mobile">
              <span className="brand-dot" />
              Family Care Hub
            </div>
            {activeTab !== 'dashboard' && (
              <div className="topbar-person-filter">
                <PersonFilter value={personFilter} onChange={setPersonFilter} />
              </div>
            )}
            <div className="topbar-right">
              <button className="btn-ask-ai" onClick={() => setAskAiOpen(true)}>
                <span className="ask-ai-icon-sm">✦</span> Ask AI
              </button>
              <div className="topbar-menu-wrap" ref={userMenuRef}>
                <button className="topbar-user-btn" onClick={() => setUserMenuOpen(o => !o)}>
                  {user.photoURL
                    ? <img className="topbar-avatar" src={user.photoURL} alt={user.displayName || 'User'} referrerPolicy="no-referrer" />
                    : <>{user.displayName || user.email} ▾</>}
                </button>
                {userMenuOpen && (
                  <div className="topbar-menu">
                    <button
                      className="menu-item menu-item-notif"
                      onClick={handleNotifClick}
                      disabled={notifPermission === 'granted' || notifPermission === 'denied' || notifPermission === 'unsupported'}
                    >
                      <span className="menu-item-label">Notifications</span>
                      <span className={`notif-status-badge notif-status-${notifPermission}`}>
                        {notifPermission === 'granted' && 'Enabled'}
                        {notifPermission === 'default' && 'Tap to enable'}
                        {notifPermission === 'denied' && 'Blocked'}
                        {notifPermission === 'unsupported' && 'Unavailable'}
                      </span>
                    </button>
                    <div className="menu-divider" />
                    <button className="menu-item" onClick={() => { setActiveTab('care-team'); setUserMenuOpen(false) }}>
                      <span className="menu-item-label">Doctors</span>
                    </button>
                    <div className="menu-divider" />
                    <button className="menu-item" onClick={() => { signOut(auth); setUserMenuOpen(false) }}>
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <NotificationBanner user={user} />

          {activeTab === 'dashboard' && (
            <DashboardView
              meds={activeMeds}
              filteredMeds={filteredMeds}
              apts={apts}
              filteredApts={filteredApts}
              tasks={tasks}
              filteredTasks={filteredTasks}
              milestones={milestones}
              phases={phases}
              onNavigate={setActiveTab}
              personFilter={personFilter}
              onPersonFilter={setPersonFilter}
            />
          )}

          {activeTab === 'meds' && (
            <>
              <BackBar label="Medications" onBack={() => setActiveTab('dashboard')} />
              <MedicationsView meds={meds} careTeam={careTeam} personFilter={personFilter} onPersonFilter={setPersonFilter} />
            </>
          )}
          {activeTab === 'apts' && (
            <>
              <BackBar label="Appointments" onBack={() => setActiveTab('dashboard')} />
              <AppointmentsView apts={apts} careTeam={careTeam} personFilter={personFilter} onPersonFilter={setPersonFilter} />
            </>
          )}
          {activeTab === 'tasks' && (
            <>
              <BackBar label="Tasks" onBack={() => setActiveTab('dashboard')} />
              <TasksView tasks={tasks} careTeam={careTeam} users={users} user={user} personFilter={personFilter} onPersonFilter={setPersonFilter} />
            </>
          )}
          {activeTab === 'care-team' && (
            <>
              <BackBar label="Care Team" onBack={() => setActiveTab('dashboard')} />
              <CareTeamPanel careTeam={careTeam} />
            </>
          )}
          {activeTab === 'timeline' && (
            <>
              <BackBar label="Disease Timeline" onBack={() => setActiveTab('dashboard')} />
              <TimelineView milestones={milestones} phases={phases} />
            </>
          )}
        </div>
      </div>

      <BottomNav activeTab={activeTab} onNavigate={setActiveTab} />

      <AskAiSheet
        open={askAiOpen}
        onClose={() => setAskAiOpen(false)}
        meds={meds}
        apts={apts}
        tasks={tasks}
        careTeam={careTeam}
      />
    </>
  )
}
