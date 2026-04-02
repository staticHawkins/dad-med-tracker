import { useState, useEffect } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'

export function useNotes() {
  const [noteById, setNoteById] = useState({})
  useEffect(() => {
    return onSnapshot(collection(db, 'clinicalNotes'), snap => {
      const map = {}
      snap.docs.forEach(d => { const n = d.data(); map[n.id] = n })
      setNoteById(map)
    }, err => console.error('Firestore notes error:', err))
  }, [])
  return noteById
}
