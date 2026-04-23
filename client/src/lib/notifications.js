import { getToken, onMessage } from 'firebase/messaging'
import { messaging } from '../firebase'
import { saveFcmToken } from './firestore'

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY

async function getSwRegistration() {
  if (!('serviceWorker' in navigator)) return undefined
  const existing = await navigator.serviceWorker.getRegistration('/')
  if (existing) return existing
  return navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' })
}

export async function requestNotificationPermission(uid) {
  if (!('Notification' in window) || !messaging) return null
  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return null

    const swReg = await getSwRegistration()
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg })

    if (token && uid) await saveFcmToken(uid, token)
    return token
  } catch (err) {
    console.warn('FCM token registration failed:', err)
    return null
  }
}

export function onForegroundMessage(callback) {
  if (!messaging) return () => {}
  return onMessage(messaging, callback)
}
