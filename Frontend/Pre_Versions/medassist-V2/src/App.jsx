import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { ROLES } from './contexts/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import AIChat from './pages/AIChat'
import Appointments from './pages/Appointments'
import Records from './pages/Records'
import Profile from './pages/Profile'
import Medications from './pages/Medications'
import Patients from './pages/Patients'

function PrivateRoute({ children }) {
  const { user } = useAuth()
  return user ? children : <Navigate to="/login" replace />
}

function RoleRoute({ roles, children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  const { user } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />

      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="chat" element={
          <RoleRoute roles={[ROLES.PATIENT, ROLES.DOCTOR, ROLES.ATTENDEE]}>
            <AIChat />
          </RoleRoute>
        } />
        <Route path="appointments" element={<Appointments />} />
        <Route path="records" element={
          <RoleRoute roles={[ROLES.PATIENT, ROLES.DOCTOR]}>
            <Records />
          </RoleRoute>
        } />
        <Route path="medications" element={
          <RoleRoute roles={[ROLES.PATIENT, ROLES.DOCTOR]}>
            <Medications />
          </RoleRoute>
        } />
        <Route path="patients" element={
          <RoleRoute roles={[ROLES.DOCTOR, ROLES.RECEPTIONIST]}>
            <Patients />
          </RoleRoute>
        } />
        <Route path="profile" element={<Profile />} />
      </Route>

      <Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} replace />} />
    </Routes>
  )
}
