import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { ROLES } from './contexts/AuthContext'
import Layout from './components/Layout'
import { Loader2 } from 'lucide-react'

const Login       = lazy(() => import('./pages/Login'))
const Register    = lazy(() => import('./pages/Register'))
const Dashboard   = lazy(() => import('./pages/Dashboard'))
const AIChat      = lazy(() => import('./pages/AIChat'))
const Appointments = lazy(() => import('./pages/Appointments'))
const Records     = lazy(() => import('./pages/Records'))
const Profile     = lazy(() => import('./pages/Profile'))
const Medications = lazy(() => import('./pages/Medications'))
const Patients    = lazy(() => import('./pages/Patients'))
const SOPPage     = lazy(() => import('./pages/SOP'))

const PageLoader = () => (
  <div className="flex items-center justify-center h-64">
    <Loader2 className="animate-spin text-brand-600" size={32} />
  </div>
)

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
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public routes */}
        <Route path="/login"    element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
        <Route path="/register" element={user ? <Navigate to="/dashboard" replace /> : <Register />} />

        {/* Protected routes */}
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />

          <Route path="chat" element={
            <RoleRoute roles={[ROLES.DOCTOR, ROLES.ATTENDEE]}>
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

          <Route path="sop" element={
            <RoleRoute roles={[ROLES.PATIENT, ROLES.DOCTOR]}>
              <SOPPage />
            </RoleRoute>
          } />

          <Route path="profile" element={<Profile />} />
        </Route>

        <Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} replace />} />
      </Routes>
    </Suspense>
  )
}
