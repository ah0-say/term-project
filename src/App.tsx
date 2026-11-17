import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { auth } from './data/firebase'
import LoginPage from './ui/LoginPage'
import EventListPage from './ui/EventListPage'
import './App.css'

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  // updateProfile은 user 객체를 제자리에서 바꾸므로, 카운터를 올려 재렌더시킨다.
  const [profileVersion, setProfileVersion] = useState(0)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  if (loading) {
    return <p className="center-text">불러오는 중…</p>
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          user ? (
            <Navigate to="/" replace />
          ) : (
            <LoginPage
              onProfileUpdated={() => setProfileVersion((v) => v + 1)}
            />
          )
        }
      />
      <Route
        path="/"
        element={
          user ? (
            <EventListPage
              displayName={user.displayName}
              profileVersion={profileVersion}
            />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
