import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard, MessageSquare, CalendarDays, FileText, Pill,
  User, Settings, Bell, Activity, Menu, X, LogOut,
  Shield, Stethoscope, Users, UserCircle, ClipboardList
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useSocket } from '../contexts/SocketContext'
import { ROLES } from '../contexts/AuthContext'

const NAV_BY_ROLE = {
  [ROLES.PATIENT]: [
    { to: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/appointments', icon: CalendarDays,    label: 'Appointments' },
    { to: '/records',      icon: FileText,        label: 'Medical Records' },
    { to: '/medications',  icon: Pill,            label: 'Medications' },
    { to: '/sop',          icon: ClipboardList,   label: 'SOAP Records' },
    { to: '/profile',      icon: User,            label: 'My Profile' },
  ],
  [ROLES.DOCTOR]: [
    { to: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/chat',         icon: MessageSquare,   label: 'AI Conversation' },
    { to: '/appointments', icon: CalendarDays,    label: 'My Schedule' },
    { to: '/patients',     icon: Users,           label: 'Patients' },
    { to: '/records',      icon: FileText,        label: 'Records' },
    { to: '/sop',          icon: ClipboardList,   label: 'SOAP Review' },
    { to: '/profile',      icon: UserCircle,      label: 'My Profile' },
  ],
  [ROLES.RECEPTIONIST]: [
    { to: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/appointments', icon: CalendarDays,    label: 'Appointments' },
    { to: '/patients',     icon: Users,           label: 'Patient Directory' },
    { to: '/profile',      icon: UserCircle,      label: 'My Profile' },
  ],
  [ROLES.ATTENDEE]: [
    { to: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/appointments', icon: CalendarDays,    label: 'Appointments' },
    { to: '/profile',      icon: UserCircle,      label: 'My Profile' },
  ],
}

const ROLE_COLORS = {
  [ROLES.PATIENT]:      { tag: 'bg-brand-50 text-brand-700',   dot: 'bg-brand-500'  },
  [ROLES.DOCTOR]:       { tag: 'bg-pink-50 text-pink-700',     dot: 'bg-pink-500'   },
  [ROLES.RECEPTIONIST]: { tag: 'bg-violet-50 text-violet-700', dot: 'bg-violet-500' },
  [ROLES.ATTENDEE]:     { tag: 'bg-amber-50 text-amber-700',   dot: 'bg-amber-500'  },
}

const ROLE_LABELS = {
  [ROLES.PATIENT]:      'Patient',
  [ROLES.DOCTOR]:       'Doctor',
  [ROLES.RECEPTIONIST]: 'Receptionist',
  [ROLES.ATTENDEE]:     'Attendee',
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notifOpen, setNotifOpen]     = useState(false)
  const [notifications, setNotifications] = useState([
    { id: 1, msg: 'Appointment with Dr. Priya tomorrow at 10:30 AM', time: '2h ago', unread: true,  type: 'appointment' },
    { id: 2, msg: 'Metformin refill due in 3 days',                  time: '5h ago', unread: true,  type: 'medication' },
    { id: 3, msg: 'Lab results ready: CBC report',                   time: '1d ago', unread: false, type: 'record' },
  ])

  const location = useLocation()
  const navigate  = useNavigate()
  const { user, logout } = useAuth()
  const { on } = useSocket()

  const nav       = NAV_BY_ROLE[user?.role] || []
  const pageTitle = nav.find(n => location.pathname.startsWith(n.to))?.label || 'MedAssist AI'
  const roleStyle = ROLE_COLORS[user?.role] || ROLE_COLORS[ROLES.PATIENT]
  const unreadCount = notifications.filter(n => n.unread).length

  // Listen for real-time notifications (SOP events, etc.)
  useEffect(() => {
    const unsub = on('notification:received', (data) => {
      const label =
        data.type === 'sop:approved'  ? '✅ SOAP Approved' :
        data.type === 'sop:rejected'  ? '⚠️ SOAP Reviewed' :
        data.type === 'sop:submitted' ? '📋 SOAP Submitted' :
        data.type === 'sop:new'       ? '📋 New SOAP for review' :
        '🔔 Notification'

      setNotifications(prev => [
        {
          id:     Date.now(),
          msg:    data.message || label,
          time:   'just now',
          unread: true,
          type:   data.type || 'general',
          sopId:  data.sopId,
        },
        ...prev,
      ].slice(0, 20))
    })
    return unsub
  }, [on])

  const markAllRead = () => setNotifications(p => p.map(n => ({ ...n, unread: false })))

  const handleLogout = () => { logout(); navigate('/') }

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8faff]">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static top-0 left-0 h-full z-30 w-[260px] flex flex-col bg-white border-r border-[#e8effc] transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        {/* Logo */}
        <div className="px-6 py-5 flex items-center justify-between border-b border-[#e8effc]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-700 flex items-center justify-center shadow-sm">
              <Activity size={18} className="text-white" />
            </div>
            <div>
              <p className="font-display font-bold text-[#0f1f3d] text-base leading-none">MedAssist</p>
              <p className="text-[10px] text-brand-600 font-semibold tracking-wider uppercase mt-0.5">AI Health</p>
            </div>
          </div>
          <button className="lg:hidden text-gray-400" onClick={() => setSidebarOpen(false)}>
            <X size={18} />
          </button>
        </div>

        {/* User pill */}
        <div className="mx-4 mt-4 p-3 bg-[#f4f7ff] rounded-xl flex items-center gap-3">
          <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${user?.color} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
            {user?.initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[#0f1f3d] truncate">{user?.name}</p>
            <p className="text-[11px] text-[#9aaec4] truncate">{user?.subtitle}</p>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${roleStyle.tag}`}>
            {ROLE_LABELS[user?.role]}
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <p className="text-[10px] uppercase tracking-widest text-[#9aaec4] font-semibold px-4 pb-2">Menu</p>
          {nav.map(({ to, icon: Icon, label, badge }) => {
            // Add live badge count for SOP when on doctor role
            const sopBadge = to === '/sop' && user?.role === 'doctor'
              ? notifications.filter(n => n.type === 'sop:new' && n.unread).length || undefined
              : badge

            return (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <Icon size={17} />
                <span>{label}</span>
                {sopBadge && (
                  <span className="ml-auto bg-brand-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {sopBadge}
                  </span>
                )}
              </NavLink>
            )
          })}
        </nav>

        {/* Bottom */}
        <div className="px-3 pb-5 space-y-0.5 border-t border-[#e8effc] pt-3">
          <button className="sidebar-link w-full">
            <Settings size={17} />
            <span>Settings</span>
          </button>
          <button onClick={handleLogout} className="sidebar-link w-full text-red-400 hover:bg-red-50 hover:text-red-500">
            <LogOut size={17} />
            <span>Log Out</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-[#e8effc] flex items-center px-6 gap-4 shrink-0">
          <button className="lg:hidden text-[#5a6c8a]" onClick={() => setSidebarOpen(true)}>
            <Menu size={22} />
          </button>
          <div className="flex-1">
            <h1 className="font-display font-semibold text-[#0f1f3d] text-base">{pageTitle}</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-xs font-semibold px-3 py-1.5 rounded-full">
              <Shield size={12} /> HIPAA Secure
            </div>

            {/* Notifications bell */}
            <div className="relative">
              <button
                onClick={() => { setNotifOpen(!notifOpen); if (!notifOpen) markAllRead() }}
                className="relative w-9 h-9 rounded-xl bg-[#f4f7ff] flex items-center justify-center text-[#5a6c8a] hover:bg-brand-50 hover:text-brand-700 transition-colors"
              >
                <Bell size={17} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-brand-600 rounded-full border-2 border-white flex items-center justify-center text-[9px] text-white font-bold">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                  <div className="absolute right-0 top-12 w-80 bg-white rounded-2xl border border-[#e8effc] shadow-xl z-50 overflow-hidden animate-slide-up">
                    <div className="px-4 py-3 border-b border-[#e8effc] flex items-center justify-between">
                      <p className="font-display font-semibold text-[#0f1f3d] text-sm">Notifications</p>
                      <button onClick={markAllRead} className="text-[10px] text-brand-600 font-semibold hover:underline">Mark all read</button>
                    </div>
                    <div className="divide-y divide-[#f0f4ff] max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-8 text-center text-xs text-[#9aaec4]">No notifications</div>
                      ) : notifications.map(n => (
                        <div
                          key={n.id}
                          className={`px-4 py-3 flex gap-3 items-start hover:bg-[#f8faff] cursor-pointer ${n.unread ? 'bg-brand-50/50' : ''}`}
                          onClick={() => {
                            if (n.sopId || ['sop:new','sop:approved','sop:rejected','sop:submitted'].includes(n.type)) {
                              navigate('/sop')
                              setNotifOpen(false)
                            }
                          }}
                        >
                          <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.unread ? 'bg-brand-500' : 'bg-gray-200'}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-[#0f1f3d] font-medium leading-relaxed">{n.msg}</p>
                            <p className="text-[11px] text-[#9aaec4] mt-0.5">{n.time}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Avatar */}
            <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${user?.color} flex items-center justify-center text-white font-bold text-sm cursor-pointer`}>
              {user?.initials}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
