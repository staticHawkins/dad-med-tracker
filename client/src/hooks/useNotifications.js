import { useEffect } from 'react'
import { requestNotificationPermission, onForegroundMessage } from '../lib/notifications'

export function useNotifications(user) {
  useEffect(() => {
    if (!user) return
    requestNotificationPermission(user.uid).catch(() => {})
    return onForegroundMessage((payload) => {
      console.log('Foreground FCM message:', payload)
    })
  }, [user?.uid])
}
