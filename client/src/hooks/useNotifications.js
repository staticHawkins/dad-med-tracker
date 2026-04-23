import { useEffect } from 'react'
import { requestNotificationPermission, onForegroundMessage } from '../lib/notifications'

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
}

export function useNotifications(user) {
  useEffect(() => {
    if (!user) return
    // On iOS the permission prompt requires a user gesture — the NotificationBanner
    // handles this. On other platforms auto-request is fine.
    if (!isIos()) {
      requestNotificationPermission(user.uid).catch(() => {})
    }
    return onForegroundMessage((payload) => {
      console.log('Foreground FCM message:', payload)
    })
  }, [user?.uid])
}
