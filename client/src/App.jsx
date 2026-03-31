import { useAuth } from './hooks/useAuth'
import LoginScreen from './components/LoginScreen'
import MainApp from './components/MainApp'

export default function App() {
  const user = useAuth()

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
