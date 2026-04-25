import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { getFunctions } from 'firebase/functions'
import { getMessaging } from 'firebase/messaging'

const firebaseConfig = {
  apiKey:            "AIzaSyCD1uMNkBMdbArrv4zKppc54Lgxg66xMdo",
  authDomain:        "dad-med-tracker.firebaseapp.com",
  projectId:         "dad-med-tracker",
  storageBucket:     "dad-med-tracker.firebasestorage.app",
  messagingSenderId: "1043260614123",
  appId:             "1:1043260614123:web:352f4cfa5ee621f22425ae"
}

const firebaseApp = initializeApp(firebaseConfig)

export const auth = getAuth(firebaseApp)
export const provider = new GoogleAuthProvider()
export const db = getFirestore(firebaseApp)
export const storage = getStorage(firebaseApp)
export const functions = getFunctions(firebaseApp)

let messaging = null
try { messaging = getMessaging(firebaseApp) } catch { /* unsupported browser */ }
export { messaging }

if (import.meta.env.VITE_USE_EMULATOR === 'true') {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, 'localhost', 8080)
}
