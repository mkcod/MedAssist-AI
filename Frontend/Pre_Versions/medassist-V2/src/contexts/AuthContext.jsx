import { createContext, useContext, useState } from 'react'

export const ROLES = {
  PATIENT: 'patient',
  DOCTOR: 'doctor',
  RECEPTIONIST: 'receptionist',
  ATTENDEE: 'attendee',
}

const USERS = [
  {
    id: 'P001', role: ROLES.PATIENT,
    email: 'rahul@medassist.com', password: 'patient123',
    name: 'Rahul Kumar', initials: 'RK',
    subtitle: 'Patient ID #2891',
    color: 'from-brand-400 to-teal-500',
    extra: { bloodGroup: 'B+', height: "5'10\"", weight: '78 kg', bmi: '24.9' },
  },
  {
    id: 'D001', role: ROLES.DOCTOR,
    email: 'priya@medassist.com', password: 'doctor123',
    name: 'Dr. Priya Nair', initials: 'PN',
    subtitle: 'Cardiologist · Reg #MCI-29817',
    color: 'from-pink-400 to-rose-500',
    extra: { department: 'Cardiology', experience: '14 yrs', patients: 248 },
  },
  {
    id: 'R001', role: ROLES.RECEPTIONIST,
    email: 'meera@medassist.com', password: 'recept123',
    name: 'Meera Patel', initials: 'MP',
    subtitle: 'Front Desk · OPD Wing B',
    color: 'from-violet-400 to-purple-500',
    extra: { department: 'OPD', shift: 'Morning (8am–4pm)' },
  },
  {
    id: 'A001', role: ROLES.ATTENDEE,
    email: 'rohan@medassist.com', password: 'attend123',
    name: 'Rohan Singh', initials: 'RS',
    subtitle: 'Attender for Rahul Kumar',
    color: 'from-amber-400 to-orange-500',
    extra: { relation: 'Son', patientId: 'P001' },
  },
]

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [error, setError] = useState('')

  const login = (email, password) => {
    const found = USERS.find(u => u.email === email && u.password === password)
    if (found) {
      setUser(found)
      setError('')
      return true
    }
    setError('Invalid email or password. Try the demo credentials below.')
    return false
  }

  const logout = () => setUser(null)

  return (
    <AuthContext.Provider value={{ user, login, logout, error, setError }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
