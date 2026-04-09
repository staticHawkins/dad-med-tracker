import { collection, doc, setDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { today } from './medUtils'

export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

function dl(name, content, type) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([content], { type }))
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}

export async function saveMed(fields, editId) {
  const med = {
    id: editId || newId(),
    name: fields.name,
    dose: fields.dose,
    frequency: fields.frequency,
    filledDate: fields.filledDate,
    supply: fields.supply,
    refillDate: fields.refillDate || '',
    pharmacy: fields.pharmacy,
    rxNum: fields.rxNum,
    doctor: fields.doctor,
    instructions: fields.instructions,
    notes: fields.notes,
    updatedAt: new Date().toISOString()
  }
  await setDoc(doc(db, 'medications', med.id), med)
}

export async function delMed(id) {
  await deleteDoc(doc(db, 'medications', id))
}

export async function markRefilled(med) {
  const updated = {
    ...med,
    filledDate: today().toISOString().slice(0, 10),
    refillDate: '',
    updatedAt: new Date().toISOString()
  }
  await setDoc(doc(db, 'medications', med.id), updated)
}

export async function saveApt(fields, editId) {
  const apt = {
    id: editId || newId(),
    title: fields.title,
    dateTime: fields.dateTime,
    type: fields.type,
    doctor: fields.doctor,
    location: fields.location,
    covering: fields.covering,
    prep: fields.prep,
    postNotes: fields.postNotes,
    specialty: fields.specialty || '',
    clinicalNoteId: fields.clinicalNoteId || '',
    updatedAt: new Date().toISOString()
  }
  await setDoc(doc(db, 'appointments', apt.id), apt)
}

export async function saveClinicalNote(note) {
  await setDoc(doc(db, 'clinicalNotes', note.id), note)
}

export async function delApt(id) {
  await deleteDoc(doc(db, 'appointments', id))
}

export async function saveDoctor(fields, editId) {
  const dr = {
    id: editId || newId(),
    name: fields.name,
    specialty: fields.specialty || '',
    affiliation: fields.affiliation || '',
    notes: fields.notes || '',
    imageUrl: fields.imageUrl || '',
    updatedAt: new Date().toISOString()
  }
  await setDoc(doc(db, 'careTeam', dr.id), dr)
  return dr.id
}

export async function delDoctor(id) {
  await deleteDoc(doc(db, 'careTeam', id))
}

export async function saveTask(fields, editId) {
  const task = {
    id: editId || newId(),
    title: fields.title,
    description: fields.description || '',
    doctorIds: fields.doctorIds || [],
    assigneeUids: fields.assigneeUids || [],
    dueDate: fields.dueDate || '',
    done: fields.done ?? false,
    updatedAt: new Date().toISOString()
  }
  await setDoc(doc(db, 'tasks', task.id), task)
}

export async function delTask(id) {
  await deleteDoc(doc(db, 'tasks', id))
}

export async function toggleTask(task) {
  await setDoc(doc(db, 'tasks', task.id), { ...task, done: !task.done, updatedAt: new Date().toISOString() })
}

export async function upsertUser(firebaseUser) {
  await setDoc(doc(db, 'users', firebaseUser.uid), {
    uid: firebaseUser.uid,
    displayName: firebaseUser.displayName || firebaseUser.email,
    email: firebaseUser.email,
    lastSignIn: new Date().toISOString()
  }, { merge: true })
}

export function exportCSV(meds) {
  const rows = [['Name', 'Dose', 'Freq/day', 'Last Filled', 'Supply', 'Refill Date', 'Pharmacy', 'Rx #', 'Doctor', 'Instructions', 'Notes']]
  meds.forEach(m => rows.push([m.name, m.dose, m.frequency, m.filledDate, m.supply, m.refillDate, m.pharmacy, m.rxNum, m.doctor, m.instructions, m.notes]))
  dl('familycarehub-medications.csv', rows.map(r => r.map(c => '"' + (c || '').replace(/"/g, '""') + '"').join(',')).join('\n'), 'text/csv')
}

export function exportJSON(meds) {
  dl('familycarehub-backup.json', JSON.stringify(meds, null, 2), 'application/json')
}

export async function importMeds(file, existingMeds) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async ev => {
      try {
        const data = JSON.parse(ev.target.result)
        if (!Array.isArray(data)) throw new Error('Not an array')
        const have = new Set(existingMeds.map(m => m.id))
        const toAdd = data.filter(m => !have.has(m.id))
        await Promise.all(toAdd.map(m => setDoc(doc(db, 'medications', m.id), m)))
        resolve(toAdd.length)
      } catch {
        reject(new Error('Invalid backup file.'))
      }
    }
    reader.readAsText(file)
  })
}
