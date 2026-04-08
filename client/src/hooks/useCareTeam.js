import { useState, useEffect } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'

export function useCareTeam() {
  const [careTeam, setCareTeam] = useState([])
  useEffect(() => {
    return onSnapshot(collection(db, 'careTeam'), snap => {
      setCareTeam(snap.docs.map(d => d.data()))
    }, err => console.error('Firestore careTeam error:', err))
  }, [])
  return careTeam
}
