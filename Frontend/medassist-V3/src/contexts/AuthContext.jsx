import { createContext, useContext, useState, useEffect } from 'react'
import { authApi } from '../services/api'

export const ROLES = {
  PATIENT:       'patient',
  DOCTOR:        'doctor',
  RECEPTIONIST:  'receptionist',
  ATTENDEE:      'attendee',
}

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(true)

  // Rehydrate from localStorage on app load
  useEffect(() => {
    const token = localStorage.getItem('medassist_token')
    if (token) {
      authApi.me()
        .then(res => setUser(res.user))
        .catch(() => localStorage.removeItem('medassist_token'))
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (email, password) => {
    setError('')
    try {
      const res = await authApi.login(email, password)
      localStorage.setItem('medassist_token', res.token)
      setUser(res.user)
      return true
    } catch (err) {
      setError(err.message || 'Invalid email or password.')
      return false
    }
  }

  const register = async (data) => {
    setError('')
    try {
      const res = await authApi.register(data)
      localStorage.setItem('medassist_token', res.token)
      setUser(res.user)
      return true
    } catch (err) {
      setError(err.message || 'Registration failed.')
      return false
    }
  }

  const logout = async () => {
    try { await authApi.logout() } catch (_) {}
    localStorage.removeItem('medassist_token')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout, error, setError, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
