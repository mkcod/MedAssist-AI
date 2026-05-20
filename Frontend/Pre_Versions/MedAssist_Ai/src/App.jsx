import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import AIChat from './pages/AIChat'
import Appointments from './pages/Appointments'
import Records from './pages/Records'
import Profile from './pages/Profile'
import Medications from './pages/Medications'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard"    element={<Dashboard />} />
        <Route path="chat"         element={<AIChat />} />
        <Route path="appointments" element={<Appointments />} />
        <Route path="records"      element={<Records />} />
        <Route path="medications"  element={<Medications />} />
        <Route path="profile"      element={<Profile />} />
      </Route>
    </Routes>
  )
}
