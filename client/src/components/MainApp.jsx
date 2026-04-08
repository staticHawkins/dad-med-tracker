import { useState, useEffect, useRef } from 'react'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase'
import { useMeds } from '../hooks/useMeds'
import { useApts } from '../hooks/useApts'
import { useCareTeam } from '../hooks/useCareTeam'
import { useTasks } from '../hooks/useTasks'
import { useUsers } from '../hooks/useUsers'
import { upsertUser } from '../lib/firestore'
import MedicationsView from './meds/MedicationsView'
import AppointmentsView from './apts/AppointmentsView'
import TasksView from './tasks/TasksView'
import CareTeamPanel from './CareTeamPanel'

export default function MainApp({ user }) {
  const [activeTab, setActiveTab] = useState('meds')
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'dark')
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [careTeamOpen, setCareTeamOpen] = useState(false)
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

  const meds = useMeds()
  const apts = useApts()
  const careTeam = useCareTeam()
  const tasks = useTasks()
  const users = useUsers()

  return (
    <>
      <div className="topbar">
        <div className="brand">
          <span className="brand-dot" />
          FamilyCareHub
        </div>
        <div className="topbar-right">
          <button className="btn-ghost" onClick={() => setCareTeamOpen(true)} title="Manage Care Team">⚙</button>
          <button className="btn-ghost" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            {theme === 'dark' ? '☀' : '☽'}
          </button>
          <div className="topbar-menu-wrap" ref={userMenuRef}>
            <button className="btn-ghost topbar-user-btn" onClick={() => setUserMenuOpen(o => !o)}>
              {user.displayName || user.email} ▾
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

      <div className="page-tabs">
        <button className={`ptab${activeTab === 'meds' ? ' active' : ''}`} onClick={() => setActiveTab('meds')}>
          Medications
        </button>
        <button className={`ptab${activeTab === 'apts' ? ' active' : ''}`} onClick={() => setActiveTab('apts')}>
          Appointments
        </button>
        <button className={`ptab${activeTab === 'tasks' ? ' active' : ''}`} onClick={() => setActiveTab('tasks')}>
          Tasks
        </button>
      </div>

      {activeTab === 'meds' && <MedicationsView meds={meds} careTeam={careTeam} />}
      {activeTab === 'apts' && <AppointmentsView apts={apts} careTeam={careTeam} />}
      {activeTab === 'tasks' && <TasksView tasks={tasks} careTeam={careTeam} users={users} user={user} />}

      <CareTeamPanel careTeam={careTeam} open={careTeamOpen} onClose={() => setCareTeamOpen(false)} />
    </>
  )
}
