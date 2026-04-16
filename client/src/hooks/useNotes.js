import { useState, useEffect } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'

export function useNotes() {
  const [noteByDate, setNoteByDate] = useState({})
  useEffect(() => {
    return onSnapshot(collection(db, 'clinicalNotes'), snap => {
      const map = {}
      snap.docs.forEach(d => {
        const n = d.data()
        if (n.date) {
          const dateKey = n.date.slice(0, 10)
          map[dateKey] = n
        }
      })
      setNoteByDate(map)
    }, err => console.error('Firestore notes error:', err))
  }, [])
  return noteByDate
}
