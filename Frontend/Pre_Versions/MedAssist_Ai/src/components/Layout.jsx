import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useState } from 'react'
import {
  LayoutDashboard, MessageSquare, CalendarDays,
  FileText, Pill, User, Settings, Bell,
  ChevronRight, Activity, Menu, X, LogOut,
  Shield
} from 'lucide-react'

const NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/chat', icon: MessageSquare, label: 'AI Assistant' },
  { to: '/appointments', icon: CalendarDays, label: 'Appointments' },
  { to: '/records', icon: FileText, label: 'Medical Records' },
  { to: '/medications', icon: Pill, label: 'Medications' },
  { to: '/profile', icon: User, label: 'My Profile' },
]

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  const pageTitle = NAV.find(n => location.pathname.startsWith(n.to))?.label || 'MedAssist AI'

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8faff]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static top-0 left-0 h-full z-30
        w-[260px] flex flex-col bg-white border-r border-[#e8effc]
        transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
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
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-400 to-teal-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
            RK
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#0f1f3d] truncate">Rahul Kumar</p>
            <p className="text-[11px] text-[#9aaec4] truncate">Patient ID #2891</p>
          </div>
          <ChevronRight size={14} className="text-[#9aaec4] shrink-0 ml-auto" />
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <p className="text-[10px] uppercase tracking-widest text-[#9aaec4] font-semibold px-4 pb-2">Menu</p>
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'active' : ''}`
              }
              onClick={() => setSidebarOpen(false)}
            >
              <Icon size={17} />
              <span>{label}</span>
              {to === '/chat' && (
                <span className="ml-auto bg-brand-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">2</span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bottom */}
        <div className="px-3 pb-5 space-y-0.5 border-t border-[#e8effc] pt-3">
          <button className="sidebar-link w-full">
            <Settings size={17} />
            <span>Settings</span>
          </button>
          <button className="sidebar-link w-full text-red-400 hover:bg-red-50 hover:text-red-500">
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
            {/* HIPAA badge */}
            <div className="hidden sm:flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-xs font-semibold px-3 py-1.5 rounded-full">
              <Shield size={12} />
              HIPAA Secure
            </div>

            {/* Notifications */}
            <button className="relative w-9 h-9 rounded-xl bg-[#f4f7ff] flex items-center justify-center text-[#5a6c8a] hover:bg-brand-50 hover:text-brand-700 transition-colors">
              <Bell size={17} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand-600 rounded-full border-2 border-white" />
            </button>

            {/* Avatar */}
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-400 to-teal-500 flex items-center justify-center text-white font-bold text-sm cursor-pointer">
              RK
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
