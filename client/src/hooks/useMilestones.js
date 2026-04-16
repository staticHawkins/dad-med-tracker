import { useState, useEffect } from 'react'
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore'
import { db } from '../firebase'

export function useMilestones() {
  const [milestones, setMilestones] = useState([])
  useEffect(() => {
    const q = query(collection(db, 'milestones'), orderBy('date', 'desc'))
    return onSnapshot(q, snap => {
      setMilestones(snap.docs.map(d => d.data()))
    }, err => console.error('Firestore milestones error:', err))
  }, [])
  return milestones
}
