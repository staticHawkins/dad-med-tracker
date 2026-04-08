import { useState, useEffect } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'

export function useUsers() {
  const [users, setUsers] = useState([])
  useEffect(() => {
    return onSnapshot(collection(db, 'users'), snap => {
      setUsers(snap.docs.map(d => d.data()))
    }, err => console.error('Firestore users error:', err))
  }, [])
  return users
}
