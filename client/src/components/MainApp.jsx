import { useState } from 'react'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase'

export default function MainApp({ user }) {
  const [activeTab, setActiveTab] = useState('meds')

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
  })

  return (
    <>
      <div className="topbar">
        <div className="brand">
          <span className="brand-dot" />
          FamilyCareHub
        </div>
        <div className="topbar-right">
          <span className="topbar-date">{today}</span>
          <span className="topbar-user">{user.email}</span>
          <button className="btn-ghost" onClick={() => signOut(auth)}>Sign out</button>
          <button className="btn-add">
            + {activeTab === 'meds' ? 'Add medication' : 'Add appointment'}
          </button>
        </div>
      </div>

      <div className="page-tabs">
        <button
          className={`ptab${activeTab === 'meds' ? ' active' : ''}`}
          onClick={() => setActiveTab('meds')}
        >
          Medications
        </button>
        <button
          className={`ptab${activeTab === 'apts' ? ' active' : ''}`}
          onClick={() => setActiveTab('apts')}
        >
          Appointments
        </button>
      </div>

      <div className="page" style={{ textAlign: 'center', color: 'var(--text2)', paddingTop: '3rem' }}>
        {activeTab === 'meds'
          ? 'Medications view coming soon (FAM-4)'
          : 'Appointments view coming soon (FAM-4)'}
      </div>
    </>
  )
}
