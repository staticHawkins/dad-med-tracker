import { useState, useEffect } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'

const PHASE_ORDER = ['pre', 'line1', 'line2', 'line3', 'line4']

export function usePhases() {
  const [phases, setPhases] = useState([])
  useEffect(() => {
    return onSnapshot(collection(db, 'phases'), snap => {
      const data = snap.docs.map(d => d.data())
      data.sort((a, b) => PHASE_ORDER.indexOf(a.key) - PHASE_ORDER.indexOf(b.key))
      setPhases(data)
    }, err => console.error('Firestore phases error:', err))
  }, [])
  return phases
}
