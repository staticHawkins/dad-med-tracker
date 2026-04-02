import { useState, useEffect, useRef } from 'react'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase'
import { useMeds } from '../hooks/useMeds'
import { useApts } from '../hooks/useApts'
import MedicationsView from './meds/MedicationsView'
import AppointmentsView from './apts/AppointmentsView'

export default function MainApp({ user }) {
  const [activeTab, setActiveTab] = useState('meds')
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'dark')
  const [userMenuOpen, setUserMenuOpen] = useState(false)
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

  const meds = useMeds()
  const apts = useApts()

  return (
    <>
      <div className="topbar">
        <div className="brand">
          <span className="brand-dot" />
          FamilyCareHub
        </div>
        <div className="topbar-right">
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
      </div>

      {activeTab === 'meds' && <MedicationsView meds={meds} />}
      {activeTab === 'apts' && <AppointmentsView apts={apts} />}
    </>
  )
}
