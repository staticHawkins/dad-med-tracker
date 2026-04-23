import { useState, useEffect } from 'react'
import { requestNotificationPermission } from '../lib/notifications'

const DISMISSED_KEY = 'notif-banner-dismissed'

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )
}

export default function NotificationBanner({ user }) {
  const [state, setState] = useState(null) // null | 'ios-browser' | 'prompt' | 'denied'

  useEffect(() => {
    if (!user) return
    if (localStorage.getItem(DISMISSED_KEY)) return
    if (!('Notification' in window)) return

    const perm = Notification.permission
    if (perm === 'granted') return

    if (isIos() && !isStandalone()) {
      setState('ios-browser')
    } else if (perm === 'default') {
      setState('prompt')
    } else if (perm === 'denied') {
      setState('denied')
    }
  }, [user?.uid])

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1')
    setState(null)
  }

  async function handleEnable() {
    const token = await requestNotificationPermission(user?.uid)
    if (token || Notification.permission === 'granted') {
      dismiss()
    } else if (Notification.permission === 'denied') {
      setState('denied')
    } else {
      dismiss()
    }
  }

  if (!state) return null

  return (
    <div className="notif-banner">
      <span className="notif-banner-icon">🔔</span>
      <div className="notif-banner-body">
        {state === 'ios-browser' && (
          <>
            <span className="notif-banner-title">Add to Home Screen for notifications</span>
            <span className="notif-banner-sub">
              Tap <strong>Share</strong> → <strong>Add to Home Screen</strong>, then open the app from your home screen.
            </span>
          </>
        )}
        {state === 'prompt' && (
          <>
            <span className="notif-banner-title">Enable medication reminders</span>
            <span className="notif-banner-sub">Get notified when supplies are running low.</span>
          </>
        )}
        {state === 'denied' && (
          <>
            <span className="notif-banner-title">Notifications are blocked</span>
            <span className="notif-banner-sub">
              Go to <strong>Settings → Notifications</strong> and allow this site to send alerts.
            </span>
          </>
        )}
      </div>
      <div className="notif-banner-actions">
        {state === 'prompt' && (
          <button className="notif-banner-btn" onClick={handleEnable}>
            Enable
          </button>
        )}
        <button className="notif-banner-dismiss" onClick={dismiss} aria-label="Dismiss">
          ✕
        </button>
      </div>
    </div>
  )
}
