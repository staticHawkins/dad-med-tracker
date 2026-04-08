import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from '../firebase'

export async function uploadDoctorPhoto(file, doctorId) {
  const r = ref(storage, `doctorPhotos/${doctorId}`)
  await uploadBytes(r, file)
  return getDownloadURL(r)
}
