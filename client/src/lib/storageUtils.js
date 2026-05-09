import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { storage } from '../firebase'

export async function uploadDoctorPhoto(file, doctorId) {
  const r = ref(storage, `doctorPhotos/${doctorId}`)
  await uploadBytes(r, file)
  return getDownloadURL(r)
}

export async function uploadAptFile(file, aptId) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `aptFiles/${aptId}/${Date.now()}-${safeName}`
  const r = ref(storage, storagePath)
  await uploadBytes(r, file)
  const url = await getDownloadURL(r)
  return {
    name: file.name,
    storagePath,
    url,
    type: file.type,
    size: file.size,
    uploadedAt: new Date().toISOString(),
  }
}

export async function deleteAptFile(storagePath) {
  await deleteObject(ref(storage, storagePath))
}

export async function uploadStayDocument(file, stayId) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `stayDocs/${stayId}/${Date.now()}-${safeName}`
  const r = ref(storage, storagePath)
  await uploadBytes(r, file)
  const url = await getDownloadURL(r)
  return {
    name: file.name,
    storagePath,
    url,
    type: file.type,
    size: file.size,
    uploadedAt: new Date().toISOString(),
  }
}

export async function deleteStayDocument(storagePath) {
  await deleteObject(ref(storage, storagePath))
}
