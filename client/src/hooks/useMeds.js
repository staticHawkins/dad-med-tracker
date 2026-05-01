import { useState, useEffect } from 'react'
import { collection, onSnapshot, writeBatch, doc } from 'firebase/firestore'
import { db } from '../firebase'
import { newId } from '../lib/firestore'

export function useMeds() {
  const [meds, setMeds] = useState([])
  useEffect(() => {
    return onSnapshot(collection(db, 'medications'), snap => {
      const docs = snap.docs.map(d => { const data = d.data(); return { ...data, person: data.person || 'dad' } })
      setMeds(docs)

      // One-time migration: seed fills[] from top-level fields for pre-feature meds
      const toMigrate = docs.filter(m => !m.fills?.length && m.filledDate)
      if (toMigrate.length) {
        const batch = writeBatch(db)
        toMigrate.forEach(m => {
          const initialFill = {
            id: newId(),
            filledDate: m.filledDate,
            supply: m.supply,
            dose: m.dose || '',
            frequency: m.frequency,
            frequencyPreset: m.frequencyPreset || 'once-daily',
            frequencyCustomCount: m.frequencyCustomCount || '1',
            frequencyCustomEvery: m.frequencyCustomEvery || '1',
            frequencyCustomUnit: m.frequencyCustomUnit || 'days',
            pharmacy: m.pharmacy || '',
            rxNum: m.rxNum || '',
            doctor: m.doctor || '',
            instructions: m.instructions || '',
            createdAt: m.updatedAt || new Date().toISOString(),
          }
          batch.update(doc(db, 'medications', m.id), { fills: [initialFill] })
        })
        batch.commit().catch(err => console.error('fills migration error:', err))
      }
    }, err => console.error('Firestore meds error:', err))
  }, [])
  return meds
}
