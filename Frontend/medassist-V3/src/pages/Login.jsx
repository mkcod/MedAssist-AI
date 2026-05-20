import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Link } from 'react-router-dom'
import { Activity, Stethoscope, User, Eye, EyeOff, Shield, ChevronRight } from 'lucide-react'

const ROLES = [
  {
    key: 'patient',
    label: 'Patient',
    icon: User,
    desc: 'Access health records, medications & appointments',
    email: 'rahul@medassist.com',
    password: 'patient123',
    gradient: 'from-brand-500 to-brand-700',
    bg: 'bg-brand-50',
    border: 'border-brand-200',
    text: 'text-brand-700',
    ring: 'ring-brand-400',
  },
  {
    key: 'doctor',
    label: 'Doctor',
    icon: Stethoscope,
    desc: 'Manage patients, schedule & medical records',
    email: 'priya@medassist.com',
    password: 'doctor123',
    gradient: 'from-pink-500 to-rose-600',
    bg: 'bg-pink-50',
    border: 'border-pink-200',
    text: 'text-pink-700',
    ring: 'ring-pink-400',
  },
]

export default function Login() {
  const { login, error } = useAuth()
  const [selected, setSelected] = useState(null)
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)

  const selectRole = (r) => {
    setSelected(r)
    setEmail(r.email)
    setPassword(r.password)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    await login(email, password)
    setLoading(false)
  }

  const active = selected ? ROLES.find(r => r.key === selected.key) : null

  return (
    <div className="min-h-screen bg-[#f8faff] flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-[44%] xl:w-[40%] bg-gradient-to-br from-[#0f1f3d] via-[#132b52] to-[#1560d0] flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-brand-600/20 -translate-y-1/2 translate-x-1/2 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-teal-500/15 translate-y-1/2 -translate-x-1/2 blur-3xl" />

        {/* Logo */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-11 h-11 rounded-2xl bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center">
            <Activity size={22} className="text-white" />
          </div>
          <div>
            <p className="font-display font-bold text-white text-xl leading-none">MedAssist</p>
            <p className="text-[11px] text-brand-300 font-semibold tracking-widest uppercase mt-0.5">AI Health Platform</p>
          </div>
        </div>

        {/* Hero text */}
        <div className="relative z-10 space-y-6">
          <div>
            <h1 className="font-display font-bold text-4xl xl:text-5xl text-white leading-tight">
              Smarter healthcare<br />
              <span className="text-teal-400">starts here.</span>
            </h1>
            <p className="text-brand-200 mt-4 text-base leading-relaxed max-w-sm">
              AI-powered health management for patients, doctors, and care teams — all in one secure platform.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[{ v: '50K+', l: 'Patients' }, { v: '1,200+', l: 'Doctors' }, { v: '99.9%', l: 'Uptime' }].map(s => (
              <div key={s.l} className="bg-white/10 backdrop-blur rounded-2xl p-4 border border-white/10">
                <p className="font-display font-bold text-2xl text-white">{s.v}</p>
                <p className="text-xs text-brand-300 mt-0.5">{s.l}</p>
              </div>
            ))}
          </div>
          <div className="inline-flex items-center gap-2 bg-emerald-500/15 border border-emerald-400/30 rounded-full px-4 py-2">
            <Shield size={14} className="text-emerald-400" />
            <span className="text-emerald-300 text-sm font-medium">HIPAA Compliant · AES-256 Encrypted</span>
          </div>
        </div>

        <p className="text-brand-400 text-xs relative z-10">© 2026 MedAssist AI. All rights reserved.</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-[480px] space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-700 flex items-center justify-center">
              <Activity size={18} className="text-white" />
            </div>
            <p className="font-display font-bold text-[#0f1f3d] text-lg">MedAssist AI</p>
          </div>

          <div>
            <h2 className="font-display font-bold text-2xl text-[#0f1f3d]">Welcome back</h2>
            <p className="text-[#9aaec4] mt-1 text-sm">Select your role to continue</p>
          </div>

          {/* Role selector */}
          <div className="grid grid-cols-2 gap-3">
            {ROLES.map(r => {
              const Icon = r.icon
              const isActive = selected?.key === r.key
              return (
                <button
                  key={r.key}
                  onClick={() => selectRole(r)}
                  className={`group relative p-4 rounded-2xl border-2 text-left transition-all duration-200 ${
                    isActive
                      ? `${r.border} ${r.bg} ring-2 ${r.ring} ring-offset-1`
                      : 'border-[#e8effc] bg-white hover:border-gray-300 hover:shadow-sm'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${r.gradient} flex items-center justify-center mb-3 shadow-sm`}>
                    <Icon size={18} className="text-white" />
                  </div>
                  <p className={`font-display font-semibold text-sm ${isActive ? r.text : 'text-[#0f1f3d]'}`}>{r.label}</p>
                  <p className="text-[11px] text-[#9aaec4] mt-0.5 leading-relaxed">{r.desc}</p>
                  {isActive && (
                    <div className={`absolute top-3 right-3 w-4 h-4 rounded-full bg-gradient-to-br ${r.gradient} flex items-center justify-center`}>
                      <div className="w-2 h-2 rounded-full bg-white" />
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Credentials hint */}
          {selected && (
            <div className={`rounded-xl px-4 py-3 ${active.bg} border ${active.border} flex items-start gap-3`}>
              <Shield size={14} className={`${active.text} mt-0.5 shrink-0`} />
              <div>
                <p className={`text-xs font-semibold ${active.text}`}>Demo credentials pre-filled</p>
                <p className="text-[11px] text-[#9aaec4] mt-0.5">You can click Sign In directly, or enter your own credentials.</p>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-[#5a6c8a] uppercase tracking-wide block mb-1.5">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter your email" required className="input" />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#5a6c8a] uppercase tracking-wide block mb-1.5">Password</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" required className="input pr-10" />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9aaec4] hover:text-[#5a6c8a]">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && <p className="text-red-500 text-sm bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}

            <button type="submit" disabled={loading} className={`w-full btn-primary justify-center py-3 text-base ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Signing in…
                </span>
              ) : (
                <><span>Sign In</span><ChevronRight size={16} /></>
              )}
            </button>
          </form>

          {/* Register link */}
          <div className="text-center pt-1">
            <p className="text-sm text-[#9aaec4]">
              New to MedAssist?{' '}
              <Link to="/register" className="text-brand-600 font-semibold hover:underline">Create an account</Link>
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}
