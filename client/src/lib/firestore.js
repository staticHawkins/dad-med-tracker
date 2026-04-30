import { collection, doc, setDoc, getDoc, deleteDoc, getDocs, updateDoc, arrayUnion, writeBatch, deleteField } from 'firebase/firestore'
import { db } from '../firebase'
import { today, todayStr } from './medUtils'

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

function computeFrequency(fields) {
  const p = fields.frequencyPreset
  if (p === 'twice-daily')     return 2
  if (p === 'every-other-day') return 0.5
  if (p === 'as-needed')       return 0
  if (p === 'custom') {
    const count = parseFloat(fields.frequencyCustomCount) || 1
    const every = parseFloat(fields.frequencyCustomEvery) || 1
    const unit  = fields.frequencyCustomUnit === 'weeks' ? every * 7 : every
    return count / unit
  }
  return 1 // once-daily default
}

export async function saveMed(fields, editId) {
  const med = {
    id: editId || newId(),
    name: fields.name,
    dose: fields.dose,
    frequency: computeFrequency(fields),
    frequencyPreset: fields.frequencyPreset || 'once-daily',
    frequencyCustomCount: fields.frequencyCustomCount || '1',
    frequencyCustomEvery: fields.frequencyCustomEvery || '1',
    frequencyCustomUnit:  fields.frequencyCustomUnit  || 'days',
    filledDate: fields.filledDate,
    supply: fields.supply,
    refillDate: fields.refillDate || '',
    pharmacy: fields.pharmacy,
    rxNum: fields.rxNum,
    doctor: fields.doctor,
    instructions: fields.instructions,
    active: fields.active ?? true,
    person: fields.person || 'dad',
    updatedAt: new Date().toISOString()
  }
  await setDoc(doc(db, 'medications', med.id), med)
}

export async function deactivateMed(id) {
  await updateDoc(doc(db, 'medications', id), { active: false })
}

export async function reactivateMed(id) {
  await updateDoc(doc(db, 'medications', id), { active: true })
}

export async function markRefilled(med, overrides = {}) {
  const hasFreq = overrides.frequencyPreset !== undefined
  const updated = {
    ...med,
    filledDate: overrides.filledDate || todayStr(),
    supply: overrides.supply ?? med.supply,
    dose: overrides.dose ?? med.dose,
    ...(hasFreq && {
      frequency: computeFrequency(overrides),
      frequencyPreset: overrides.frequencyPreset,
      frequencyCustomCount: overrides.frequencyCustomCount || '1',
      frequencyCustomEvery: overrides.frequencyCustomEvery || '1',
      frequencyCustomUnit: overrides.frequencyCustomUnit || 'days',
    }),
    refillDate: '',
    refillStatus: null,
    updatedAt: new Date().toISOString()
  }
  await setDoc(doc(db, 'medications', med.id), updated)
}

export async function updateRefillStatus(med, status) {
  const updated = {
    ...med,
    refillStatus: status,
    updatedAt: new Date().toISOString()
  }
  await setDoc(doc(db, 'medications', med.id), updated)
}

export async function saveApt(fields, editId) {
  const apt = {
    id: editId || newId(),
    title: fields.title,
    dateTime: fields.dateTime,
    doctor: fields.doctor,
    location: fields.location,
    covering: fields.covering,
    prep: fields.prep,
    postNotes: fields.postNotes,
    specialty: fields.specialty || '',
    clinicalNoteId: fields.clinicalNoteId || '',
    person: fields.person || 'dad',
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
    person: fields.person || 'dad',
    updatedAt: new Date().toISOString()
  }
  await setDoc(doc(db, 'careTeam', dr.id), dr)
  return dr.id
}

export async function delDoctor(id) {
  await deleteDoc(doc(db, 'careTeam', id))
}

export async function saveSpecialty(fields, editId) {
  const s = { id: editId || fields.id, label: fields.label }
  await setDoc(doc(db, 'specialties', s.id), s)
}

export async function delSpecialty(id) {
  await deleteDoc(doc(db, 'specialties', id))
}

export async function seedTimeline() {
  const { GUANGUL_MILESTONES, GUANGUL_PHASES } = await import('../data/milestones/guangul-zekiros.js')
  const existing = await getDocs(collection(db, 'milestones'))
  if (!existing.empty) {
    console.warn('seedTimeline: milestones collection already has data, skipping.')
    return
  }
  const batch = writeBatch(db)
  GUANGUL_MILESTONES.forEach(m => batch.set(doc(db, 'milestones', m.id), m))
  GUANGUL_PHASES.forEach(p => batch.set(doc(db, 'phases', p.key), p))
  await batch.commit()
  console.log('seedTimeline: seeded', GUANGUL_MILESTONES.length, 'milestones and', GUANGUL_PHASES.length, 'phases')
}

export async function seedClinicalNotes({ force = false } = {}) {
  const { default: notes } = await import('../data/clinical-notes/txonc_clinical_notes_enriched.json')
  const existing = await getDocs(collection(db, 'clinicalNotes'))
  if (!existing.empty && !force) {
    console.warn('seedClinicalNotes: clinicalNotes collection already has data, skipping. Pass { force: true } to overwrite.')
    return
  }
  const batch = writeBatch(db)
  if (force) existing.docs.forEach(d => batch.delete(d.ref))
  notes.forEach(n => batch.set(doc(db, 'clinicalNotes', n.id), n))
  await batch.commit()
  console.log('seedClinicalNotes: seeded', notes.length, 'notes')
}

export async function seedAppointmentsFromNotes({ force = false } = {}) {
  const { default: notes } = await import('../data/clinical-notes/txonc_clinical_notes_enriched.json')

  // Build set of dates already in appointments collection
  const existing = await getDocs(collection(db, 'appointments'))
  const existingDates = new Set(existing.docs.map(d => (d.data().dateTime || '').slice(0, 10)))

  function aptFromNote(n) {
    const dateKey = n.date?.slice(0, 10) ?? ''
    const lastName = n.author?.split(',')[0]?.trim() ?? ''
    const isTelemedicine = /telehealth|telemedicine/i.test(n.noteName)
    const isPalliative = /palliative/i.test(n.noteName)
    const isConsult = /consult/i.test(n.noteName)
    const title = isPalliative
      ? (isConsult ? 'Palliative Care Consult' : 'Palliative Care Follow Up')
      : (isConsult ? 'Oncology Consult' : 'Oncology Follow Up')
    return {
      id: newId(),
      title,
      dateTime: `${dateKey}T09:00`,
      doctor: `Dr. ${lastName}`,
      location: isTelemedicine ? 'Telehealth' : 'Texas Oncology',
      specialty: isPalliative ? 'palliative' : 'oncology',
      covering: '',
      prep: '',
      postNotes: '',
      clinicalNoteId: n.id,
      updatedAt: new Date().toISOString(),
    }
  }

  const toSeed = force
    ? notes
    : notes.filter(n => !existingDates.has(n.date?.slice(0, 10)))

  if (toSeed.length === 0) {
    console.log('seedAppointmentsFromNotes: all note dates already have appointments, nothing to add.')
    return
  }

  const batch = writeBatch(db)
  toSeed.forEach(n => {
    const apt = aptFromNote(n)
    batch.set(doc(db, 'appointments', apt.id), apt)
  })
  await batch.commit()
  console.log('seedAppointmentsFromNotes: created', toSeed.length, 'appointments')
}

export async function cleanupAptType() {
  const snap = await getDocs(collection(db, 'appointments'))
  const toClean = snap.docs.filter(d => d.data().type !== undefined)
  if (toClean.length === 0) {
    console.log('cleanupAptType: nothing to clean')
    return
  }
  const batch = writeBatch(db)
  toClean.forEach(d => batch.update(d.ref, { type: deleteField() }))
  await batch.commit()
  console.log(`cleanupAptType: removed type field from ${toClean.length} appointments`)
}

export async function seedSpecialties() {
  const existing = await getDocs(collection(db, 'specialties'))
  if (!existing.empty) {
    console.warn('seedSpecialties: specialties collection already has data, skipping.')
    return
  }
  const data = [
    { id: 'oncology',   label: 'Oncology' },
    { id: 'palliative', label: 'Palliative' },
    { id: 'liver',      label: 'Liver' },
    { id: 'kidney',     label: 'Kidney' },
  ]
  await Promise.all(data.map(s => setDoc(doc(db, 'specialties', s.id), s)))
  console.log('seedSpecialties: done')
}

export async function saveTask(fields, editId) {
  const status = fields.status || (fields.done ? 'done' : 'todo')
  const task = {
    id: editId || newId(),
    title: fields.title,
    description: fields.description || '',
    doctorIds: fields.doctorIds || [],
    assigneeUids: fields.assigneeUids || [],
    dueDate: fields.dueDate || '',
    priority: fields.priority || 'medium',
    category: fields.category || '',
    status,
    done: status === 'done',
    person: fields.person || 'dad',
    updatedAt: new Date().toISOString()
  }
  if (fields.parentId) task.parentId = fields.parentId
  await setDoc(doc(db, 'tasks', task.id), task)
}

export async function updateTaskFields(taskId, fields) {
  await updateDoc(doc(db, 'tasks', taskId), {
    ...fields,
    updatedAt: new Date().toISOString()
  })
}

export async function delTask(id, allTasks = []) {
  const childIds = allTasks.filter(t => t.parentId === id).map(t => t.id)
  await Promise.all([
    deleteDoc(doc(db, 'tasks', id)),
    ...childIds.map(cid => deleteDoc(doc(db, 'tasks', cid)))
  ])
}

export async function updateTaskAssignees(task, assigneeUids) {
  await updateDoc(doc(db, 'tasks', task.id), {
    assigneeUids,
    updatedAt: new Date().toISOString()
  })
}

export async function updateTaskStatus(task, status) {
  await updateDoc(doc(db, 'tasks', task.id), {
    status,
    done: status === 'done',
    updatedAt: new Date().toISOString()
  })
}

export async function addComment(taskId, comment) {
  await updateDoc(doc(db, 'tasks', taskId), {
    comments: arrayUnion(comment),
    updatedAt: new Date().toISOString()
  })
}

export async function deleteComment(task, commentId) {
  if (!task?.id) return
  const comments = (task.comments || []).filter(c => c.id !== commentId)
  await updateDoc(doc(db, 'tasks', task.id), { comments, updatedAt: new Date().toISOString() })
}

export async function saveFcmToken(uid, token, deviceInfo = {}) {
  const userRef = doc(db, 'users', uid)
  const snap = await getDoc(userRef)
  const existing = snap.exists() ? (snap.data().fcmTokens || []) : []

  // Replace entry for this token if it exists, otherwise append
  const filtered = existing.filter(e => (typeof e === 'string' ? e : e.token) !== token)
  const entry = { token, ...deviceInfo, updatedAt: new Date().toISOString() }

  await setDoc(userRef, {
    fcmTokens: [...filtered, entry],
    fcmTokenUpdatedAt: new Date().toISOString(),
  }, { merge: true })
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
  const rows = [['Person', 'Name', 'Dose', 'Freq/day', 'Last Filled', 'Supply', 'Refill Date', 'Pharmacy', 'Rx #', 'Doctor', 'Instructions']]
  meds.forEach(m => rows.push([m.person || 'dad', m.name, m.dose, m.frequency, m.filledDate, m.supply, m.refillDate, m.pharmacy, m.rxNum, m.doctor, m.instructions]))
  dl('familycarehub-medications.csv', rows.map(r => r.map(c => '"' + String(c ?? '').replace(/"/g, '""') + '"').join(',')).join('\n'), 'text/csv')
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
