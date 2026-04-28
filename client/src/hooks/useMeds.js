import { useState, useEffect } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'

export function useMeds() {
  const [meds, setMeds] = useState([])
  useEffect(() => {
    return onSnapshot(collection(db, 'medications'), snap => {
      setMeds(snap.docs.map(d => { const data = d.data(); return { ...data, person: data.person || 'dad' } }))
    }, err => console.error('Firestore meds error:', err))
  }, [])
  return meds
}
