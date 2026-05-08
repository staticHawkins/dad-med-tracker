import { useState, useEffect } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'

export function useHospitalStays() {
  const [stays, setStays] = useState([])
  useEffect(() => {
    return onSnapshot(collection(db, 'hospitalStays'), snap => {
      const all = snap.docs
        .map(d => ({ ...d.data(), person: d.data().person || 'dad' }))
        .sort((a, b) => b.admissionDate.localeCompare(a.admissionDate))
      setStays(all)
    }, err => console.error('Firestore hospitalStays error:', err))
  }, [])
  const activeStay = stays.find(s => !s.dischargeDate) ?? null
  return { stays, activeStay }
}
