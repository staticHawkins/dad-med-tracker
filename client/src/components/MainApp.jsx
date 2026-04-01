import { useState } from 'react'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase'
import { useMeds } from '../hooks/useMeds'
import { useApts } from '../hooks/useApts'
import MedicationsView from './meds/MedicationsView'
import AppointmentsView from './apts/AppointmentsView'

export default function MainApp({ user }) {
  const [activeTab, setActiveTab] = useState('meds')
  const [medModalOpen, setMedModalOpen] = useState(false)
  const [aptModalOpen, setAptModalOpen] = useState(false)

  const meds = useMeds()
  const apts = useApts()

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
  })

  function handleAddBtn() {
    if (activeTab === 'meds') setMedModalOpen(true)
    else setAptModalOpen(true)
  }

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
          <button className="btn-add" onClick={handleAddBtn}>
            + {activeTab === 'meds' ? 'Add medication' : 'Add appointment'}
          </button>
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

      {activeTab === 'meds' && (
        <MedicationsView
          meds={meds}
          addTrigger={medModalOpen}
          onAddHandled={() => setMedModalOpen(false)}
        />
      )}
      {activeTab === 'apts' && (
        <AppointmentsView
          apts={apts}
          addTrigger={aptModalOpen}
          onAddHandled={() => setAptModalOpen(false)}
        />
      )}
    </>
  )
}
