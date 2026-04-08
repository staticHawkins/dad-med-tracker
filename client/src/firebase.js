import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

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
