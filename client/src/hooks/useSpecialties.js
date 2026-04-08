import { useState, useEffect } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'

export function useSpecialties() {
  const [specialties, setSpecialties] = useState([])
  useEffect(() => {
    return onSnapshot(collection(db, 'specialties'), snap => {
      setSpecialties(snap.docs.map(d => d.data()))
    }, err => console.error('Firestore specialties error:', err))
  }, [])
  return specialties
}

export function specialtyLabel(specialties, id) {
  return specialties.find(s => s.id === id)?.label || id
}
