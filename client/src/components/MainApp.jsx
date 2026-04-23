import { useState, useEffect, useRef } from 'react'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase'
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
import AppointmentsView from './apts/AppointmentsView'
import TasksView from './tasks/TasksView'
import CareTeamPanel from './CareTeamPanel'
import DashboardView, { BackBar } from './DashboardView'
import TimelineView from './timeline/TimelineView'
import AskAiSheet from './chat/AskAiSheet'

export default function MainApp({ user }) {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'dark')
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [askAiOpen, setAskAiOpen] = useState(false)
  const userMenuRef = useRef(null)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('theme', theme)
  }, [theme])

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
  const apts = useApts()
  const careTeam = useCareTeam()
  const tasks = useTasks()
  const users = useUsers()
  const milestones = useMilestones()
  const phases = usePhases()

  return (
    <>
      <div className="topbar">
        <div className="brand">
          <span className="brand-dot" />
          FamilyCareHub
        </div>
        <div className="topbar-right">
          <button className="btn-ask-ai" onClick={() => setAskAiOpen(true)}>
            <span className="ask-ai-icon-sm">?</span> Ask AI
          </button>
          <button className="btn-ghost" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            {theme === 'dark' ? '☀' : '☽'}
          </button>
          <div className="topbar-menu-wrap" ref={userMenuRef}>
            <button className="btn-ghost topbar-user-btn" onClick={() => setUserMenuOpen(o => !o)}>
              {user.photoURL
                ? <img className="topbar-avatar" src={user.photoURL} alt={user.displayName || 'User'} referrerPolicy="no-referrer" />
                : <>{user.displayName || user.email} ▾</>}
            </button>
            {userMenuOpen && (
              <div className="topbar-menu">
                <button className="menu-item" onClick={() => { signOut(auth); setUserMenuOpen(false) }}>
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {activeTab === 'dashboard' && (
        <DashboardView
          meds={meds}
          apts={apts}
          tasks={tasks}
          careTeam={careTeam}
          milestones={milestones}
          phases={phases}
          onNavigate={setActiveTab}
        />
      )}

      {activeTab === 'meds' && (
        <>
          <BackBar label="Medications" onBack={() => setActiveTab('dashboard')} />
          <MedicationsView meds={meds} careTeam={careTeam} />
        </>
      )}
      {activeTab === 'apts' && (
        <>
          <BackBar label="Appointments" onBack={() => setActiveTab('dashboard')} />
          <AppointmentsView apts={apts} careTeam={careTeam} />
        </>
      )}
      {activeTab === 'tasks' && (
        <>
          <BackBar label="Tasks" onBack={() => setActiveTab('dashboard')} />
          <TasksView tasks={tasks} careTeam={careTeam} users={users} user={user} />
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
