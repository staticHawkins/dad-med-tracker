import { useState, useEffect } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'

export function useMeds() {
  const [meds, setMeds] = useState([])
  useEffect(() => {
    return onSnapshot(collection(db, 'medications'), snap => {
      setMeds(snap.docs.map(d => d.data()))
    }, err => console.error('Firestore meds error:', err))
  }, [])
  return meds
}
