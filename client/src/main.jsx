import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { seedTimeline, seedClinicalNotes, seedAppointmentsFromNotes, cleanupAptType } from './lib/firestore.js'

window.seedTimeline = seedTimeline
window.seedClinicalNotes = seedClinicalNotes
window.seedAppointmentsFromNotes = seedAppointmentsFromNotes
window.cleanupAptType = cleanupAptType

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
