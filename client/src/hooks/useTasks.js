import { useState, useEffect } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'

export function useTasks() {
  const [tasks, setTasks] = useState([])
  useEffect(() => {
    return onSnapshot(collection(db, 'tasks'), snap => {
      setTasks(snap.docs.map(d => d.data()).filter(data => !data.deletedAt).map(data => ({ ...data, person: data.person || 'dad' })))
    }, err => console.error('Firestore tasks error:', err))
  }, [])
  return tasks
}
