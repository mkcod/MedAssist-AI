import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  Activity, User, Stethoscope, ClipboardList, Users,
  Eye, EyeOff, Shield, ChevronRight, ArrowLeft, CheckCircle2
} from 'lucide-react'

const ROLES = [
  {
    key: 'patient',
    label: 'Patient',
    icon: User,
    desc: 'Access health records & appointments',
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
    desc: 'Manage patients & medical records',
    gradient: 'from-pink-500 to-rose-600',
    bg: 'bg-pink-50',
    border: 'border-pink-200',
    text: 'text-pink-700',
    ring: 'ring-pink-400',
  },
  {
    key: 'receptionist',
    label: 'Receptionist',
    icon: ClipboardList,
    desc: 'Handle bookings & patient directory',
    gradient: 'from-violet-500 to-purple-600',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    text: 'text-violet-700',
    ring: 'ring-violet-400',
  },
  {
    key: 'attendee',
    label: 'Attendee',
    icon: Users,
    desc: 'View appointments for accompanied patient',
    gradient: 'from-amber-500 to-orange-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    ring: 'ring-amber-400',
  },
]

export default function Register() {
  const { register, error, setError } = useAuth()
  const navigate = useNavigate()

  const [step, setStep]           = useState(1) // 1 = role select, 2 = form
  const [selectedRole, setRole]   = useState(null)
  const [showPw, setShowPw]       = useState(false)
  const [showConfirm, setShowCf]  = useState(false)
  const [loading, setLoading]     = useState(false)
  const [success, setSuccess]     = useState(false)

  const [form, setForm] = useState({
    name: '', email: '', password: '', confirm: '',
    phone: '', specialty: '', licenseNo: '',
  })

  const active = ROLES.find(r => r.key === selectedRole)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleRoleNext = () => {
    if (!selectedRole) return
    setError('')
    setStep(2)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password !== form.confirm) {
      setError('Passwords do not match.')
      return
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    setLoading(true)
    setError('')

    const payload = {
      name:      form.name.trim(),
      email:     form.email.trim(),
      password:  form.password,
      role:      selectedRole,
      phone:     form.phone.trim(),
    }
    if (selectedRole === 'doctor') {
      payload.specialty  = form.specialty.trim()
      payload.licenseNo  = form.licenseNo.trim()
    }

    const ok = await register(payload)
    setLoading(false)
    if (ok) {
      setSuccess(true)
      setTimeout(() => navigate('/dashboard'), 1800)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#f8faff] flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
            <CheckCircle2 size={40} className="text-emerald-500" />
          </div>
          <h2 className="font-display font-bold text-2xl text-[#0f1f3d]">Account Created!</h2>
          <p className="text-[#9aaec4] text-sm">Redirecting to your dashboard…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8faff] flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-[44%] xl:w-[40%] bg-gradient-to-br from-[#0f1f3d] via-[#132b52] to-[#1560d0] flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-brand-600/20 -translate-y-1/2 translate-x-1/2 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-teal-500/15 translate-y-1/2 -translate-x-1/2 blur-3xl" />

        <div className="flex items-center gap-3 relative z-10">
          <div className="w-11 h-11 rounded-2xl bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center">
            <Activity size={22} className="text-white" />
          </div>
          <div>
            <p className="font-display font-bold text-white text-xl leading-none">MedAssist</p>
            <p className="text-[11px] text-brand-300 font-semibold tracking-widest uppercase mt-0.5">AI Health Platform</p>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <div>
            <h1 className="font-display font-bold text-4xl xl:text-5xl text-white leading-tight">
              Join the future<br />
              <span className="text-teal-400">of healthcare.</span>
            </h1>
            <p className="text-brand-200 mt-4 text-base leading-relaxed max-w-sm">
              Create your account and get access to AI-powered health management tools tailored to your role.
            </p>
          </div>
          <div className="space-y-3">
            {['HIPAA Compliant & secure', 'Real-time AI assistance', 'Instant SOAP generation'].map(f => (
              <div key={f} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-teal-400/20 border border-teal-400/40 flex items-center justify-center shrink-0">
                  <CheckCircle2 size={11} className="text-teal-400" />
                </div>
                <span className="text-brand-200 text-sm">{f}</span>
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
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 overflow-y-auto">
        <div className="w-full max-w-[480px] space-y-7 py-8">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-700 flex items-center justify-center">
              <Activity size={18} className="text-white" />
            </div>
            <p className="font-display font-bold text-[#0f1f3d] text-lg">MedAssist AI</p>
          </div>

          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-display font-bold text-2xl text-[#0f1f3d]">
                {step === 1 ? 'Create account' : `Register as ${active?.label}`}
              </h2>
              <p className="text-[#9aaec4] mt-1 text-sm">
                {step === 1 ? 'Choose your role to get started' : 'Fill in your details below'}
              </p>
            </div>
            {step === 2 && (
              <button
                onClick={() => { setStep(1); setError('') }}
                className="flex items-center gap-1.5 text-sm text-[#9aaec4] hover:text-[#5a6c8a] transition-colors mt-1"
              >
                <ArrowLeft size={14} /> Back
              </button>
            )}
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2">
            {[1, 2].map(s => (
              <div key={s} className={`h-1.5 rounded-full transition-all duration-300 ${s === step ? 'flex-1 bg-brand-600' : s < step ? 'flex-1 bg-brand-300' : 'w-8 bg-[#e8effc]'}`} />
            ))}
          </div>

          {/* Step 1: Role selection */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                {ROLES.map(r => {
                  const Icon = r.icon
                  const isActive = selectedRole === r.key
                  return (
                    <button
                      key={r.key}
                      onClick={() => setRole(r.key)}
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

              <button
                onClick={handleRoleNext}
                disabled={!selectedRole}
                className={`w-full btn-primary justify-center py-3 text-base ${!selectedRole ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <span>Continue</span>
                <ChevronRight size={16} />
              </button>

              <p className="text-center text-sm text-[#9aaec4]">
                Already have an account?{' '}
                <Link to="/login" className="text-brand-600 font-semibold hover:underline">Sign in</Link>
              </p>
            </div>
          )}

          {/* Step 2: Registration form */}
          {step === 2 && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Full name */}
              <div>
                <label className="text-xs font-semibold text-[#5a6c8a] uppercase tracking-wide block mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  required
                  className="input"
                />
              </div>

              {/* Email */}
              <div>
                <label className="text-xs font-semibold text-[#5a6c8a] uppercase tracking-wide block mb-1.5">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => set('email', e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="input"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="text-xs font-semibold text-[#5a6c8a] uppercase tracking-wide block mb-1.5">Phone <span className="text-[#9aaec4] font-normal normal-case">(optional)</span></label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => set('phone', e.target.value)}
                  placeholder="+91 98765 43210"
                  className="input"
                />
              </div>

              {/* Doctor-specific fields */}
              {selectedRole === 'doctor' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-[#5a6c8a] uppercase tracking-wide block mb-1.5">Specialty</label>
                    <input
                      type="text"
                      value={form.specialty}
                      onChange={e => set('specialty', e.target.value)}
                      placeholder="e.g. Cardiology"
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[#5a6c8a] uppercase tracking-wide block mb-1.5">License No.</label>
                    <input
                      type="text"
                      value={form.licenseNo}
                      onChange={e => set('licenseNo', e.target.value)}
                      placeholder="MCI-XXXXX"
                      className="input"
                    />
                  </div>
                </div>
              )}

              {/* Password */}
              <div>
                <label className="text-xs font-semibold text-[#5a6c8a] uppercase tracking-wide block mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => set('password', e.target.value)}
                    placeholder="Min. 6 characters"
                    required
                    className="input pr-10"
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9aaec4] hover:text-[#5a6c8a]">
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Confirm password */}
              <div>
                <label className="text-xs font-semibold text-[#5a6c8a] uppercase tracking-wide block mb-1.5">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={form.confirm}
                    onChange={e => set('confirm', e.target.value)}
                    placeholder="Re-enter password"
                    required
                    className="input pr-10"
                  />
                  <button type="button" onClick={() => setShowCf(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9aaec4] hover:text-[#5a6c8a]">
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {form.confirm && form.password !== form.confirm && (
                  <p className="text-red-400 text-xs mt-1">Passwords do not match</p>
                )}
              </div>

              {error && (
                <p className="text-red-500 text-sm bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className={`w-full btn-primary justify-center py-3 text-base ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Creating account…
                  </span>
                ) : (
                  <><span>Create Account</span><ChevronRight size={16} /></>
                )}
              </button>

              <p className="text-center text-sm text-[#9aaec4]">
                Already have an account?{' '}
                <Link to="/login" className="text-brand-600 font-semibold hover:underline">Sign in</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
