import { useState, useEffect } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'

export function useApts() {
  const [apts, setApts] = useState([])
  useEffect(() => {
    return onSnapshot(collection(db, 'appointments'), snap => {
      setApts(snap.docs.map(d => d.data()))
    }, err => console.error('Firestore apts error:', err))
  }, [])
  return apts
}
