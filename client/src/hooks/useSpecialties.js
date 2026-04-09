import { useState, useEffect } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'

export function useSpecialties() {
  const [specialties, setSpecialties] = useState([])
  useEffect(() => {
    return onSnapshot(collection(db, 'specialties'), snap => {
      setSpecialties(snap.docs.map(d => d.data()))
    }, err => console.error('Firestore specialties error:', err))
  }, [])
  return specialties
}

export function specialtyLabel(specialties, id) {
  return specialties.find(s => s.id === id)?.label || id
}

export function specialtyColor(specialties, id) {
  if (!id) return {}
  const idx = specialties.findIndex(s => s.id === id)
  const i = idx === -1 ? 0 : idx
  // Spread hues evenly using golden angle to avoid adjacent colors being similar
  const hue = (i * 137.508) % 360
  return {
    background: `hsl(${hue} 60% 18%)`,
    borderColor: `hsl(${hue} 55% 35%)`,
    color:       `hsl(${hue} 85% 72%)`,
  }
}
