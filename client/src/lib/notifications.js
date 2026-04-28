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

function getDeviceInfo() {
  const ua = navigator.userAgent
  let browser = 'Unknown'
  if (/CriOS/i.test(ua))        browser = 'Chrome iOS'
  else if (/FxiOS/i.test(ua))   browser = 'Firefox iOS'
  else if (/EdgA?/i.test(ua))   browser = 'Edge'
  else if (/Chrome/i.test(ua))  browser = 'Chrome'
  else if (/Firefox/i.test(ua)) browser = 'Firefox'
  else if (/Safari/i.test(ua))  browser = 'Safari'

  let os = 'Unknown'
  if (/iPhone|iPad|iPod/.test(ua))    os = 'iOS'
  else if (/Android/.test(ua))        os = 'Android'
  else if (/Windows/.test(ua))        os = 'Windows'
  else if (/Mac OS X/.test(ua))       os = 'macOS'
  else if (/Linux/.test(ua))          os = 'Linux'

  return { browser, os }
}

export async function requestNotificationPermission(uid) {
  if (!('Notification' in window) || !messaging) return null
  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return null

    const swReg = await getSwRegistration()
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg })

    if (token && uid) await saveFcmToken(uid, token, getDeviceInfo())
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
