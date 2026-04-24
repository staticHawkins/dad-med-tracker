import { useAuth } from './hooks/useAuth'
import LoginScreen from './components/LoginScreen'
import MainApp from './components/MainApp'

const DEV_TEST_USER = import.meta.env.DEV &&
  new URLSearchParams(window.location.search).get('testUser') === '1'
    ? { uid: 'test-uid', displayName: 'Test User', email: 'test@example.com', photoURL: null }
    : null

export default function App() {
  const firebaseUser = useAuth()
  const user = DEV_TEST_USER ?? firebaseUser

  if (user === undefined) {
    return (
      <div className="login-screen">
        <div className="login-card" style={{ color: 'var(--text2)' }}>Loading…</div>
      </div>
    )
  }

  if (!user) return <LoginScreen />

  return <MainApp user={user} />
}
