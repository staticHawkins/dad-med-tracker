import { useState, useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../firebase'

export function useAuth() {
  const [user, setUser] = useState(undefined) // undefined = still loading
  useEffect(() => {
    return onAuthStateChanged(auth, setUser)
  }, [])
  return user
}
