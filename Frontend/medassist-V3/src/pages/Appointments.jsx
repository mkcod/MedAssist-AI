import { useState, useEffect, useCallback } from 'react'
import { appointmentsApi, usersApi } from '../services/api'
import { useSocket } from '../contexts/SocketContext'
import { useAuth } from '../contexts/AuthContext'
import { Calendar, Clock, MapPin, Video, Phone, Plus, Check, X, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'

const modeIcon = { video: Video, 'in-person': MapPin, phone: Phone }

function BookModal({ onClose, onBooked }) {
  const [doctors, setDoctors] = useState([])
  const [form, setForm] = useState({ doctorId: '', date: '', time: '', mode: 'in-person', notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    usersApi.doctors().then(res => setDoctors(res.data))
  }, [])

  const selectedDoctor = doctors.find(d => d.id === form.doctorId)

  const submit = async () => {
    if (!form.doctorId || !form.date || !form.time) { setError('Doctor, date, and time are required'); return }
    setSaving(true); setError('')
    try {
      await appointmentsApi.create({ ...form, date: new Date(form.date).toISOString() })
      onBooked()
    } catch (e) { setError(e.message) } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display font-semibold text-[#0f1f3d] text-lg">Book Appointment</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-[#9aaec4] hover:bg-[#f4f7ff]"><X size={16}/></button>
        </div>
        {error && <div className="bg-red-50 text-red-600 text-xs rounded-xl px-3 py-2 mb-3">{error}</div>}
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-[#5a6c8a] uppercase tracking-wide mb-1 block">Doctor</label>
            <select value={form.doctorId} onChange={e=>setForm(f=>({...f,doctorId:e.target.value,time:''}))} className="input">
              <option value="">Select a doctor</option>
              {doctors.map(d => <option key={d.id} value={d.id}>{d.name} — {d.specialty}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-[#5a6c8a] uppercase tracking-wide mb-1 block">Date</label>
              <input type="date" value={form.date} min={new Date().toISOString().split('T')[0]} onChange={e=>setForm(f=>({...f,date:e.target.value}))} className="input"/>
            </div>
            <div>
              <label className="text-xs font-semibold text-[#5a6c8a] uppercase tracking-wide mb-1 block">Time</label>
              {selectedDoctor?.slots?.length ? (
                <select value={form.time} onChange={e=>setForm(f=>({...f,time:e.target.value}))} className="input">
                  <option value="">Select slot</option>
                  {selectedDoctor.slots.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : (
                <input type="time" value={form.time} onChange={e=>setForm(f=>({...f,time:e.target.value}))} className="input"/>
              )}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-[#5a6c8a] uppercase tracking-wide mb-1 block">Mode</label>
            <div className="flex gap-2">
              {['in-person','video','phone'].map(m => (
                <button key={m} onClick={()=>setForm(f=>({...f,mode:m}))} className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all capitalize ${form.mode===m?'bg-brand-700 text-white border-brand-700':'bg-white text-[#5a6c8a] border-[#e8effc] hover:border-brand-200'}`}>{m}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-[#5a6c8a] uppercase tracking-wide mb-1 block">Notes (optional)</label>
            <textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Reason for visit…" rows={2} className="input resize-none"/>
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="btn-ghost flex-1 justify-center border border-[#e8effc]">Cancel</button>
          <button onClick={submit} disabled={saving} className="btn-primary flex-1 justify-center">
            {saving?<><Loader2 size={14} className="animate-spin"/> Booking…</>:<><Check size={14}/> Confirm</>}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Appointments() {
  const { user } = useAuth()
  const { on } = useSocket()
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('upcoming')
  const [showBook, setShowBook] = useState(false)
  const [cancelling, setCancelling] = useState(null)

  const load = useCallback(() =>
    appointmentsApi.list().then(res => setAppointments(res.data)).catch(()=>{}).finally(()=>setLoading(false))
  , [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!on) return
    const u1 = on('appointment:created', () => load())
    const u2 = on('appointment:updated', () => load())
    return () => { u1?.(); u2?.() }
  }, [on, load])

  const cancel = async (id) => {
    setCancelling(id)
    try { await appointmentsApi.updateStatus(id, 'cancelled'); load() }
    catch (e) { alert(e.message) }
    finally { setCancelling(null) }
  }

  const filtered = appointments.filter(a => a.status === tab)
  const counts = { upcoming: appointments.filter(a=>a.status==='upcoming').length, completed: appointments.filter(a=>a.status==='completed').length }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-brand-600" size={32}/></div>

  return (
    <div className="p-6 max-w-[1000px] mx-auto space-y-6">
      {showBook && <BookModal onClose={()=>setShowBook(false)} onBooked={()=>{setShowBook(false);load()}}/>}

      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <h2 className="font-display font-bold text-xl text-[#0f1f3d]">Appointments</h2>
          <p className="text-sm text-[#9aaec4] mt-0.5">Manage your healthcare visits</p>
        </div>
        {(user.role==='patient'||user.role==='receptionist') && (
          <button onClick={()=>setShowBook(true)} className="btn-primary w-fit"><Plus size={16}/> Book Appointment</button>
        )}
      </div>

      <div className="flex gap-1 bg-[#f4f7ff] p-1 rounded-xl w-fit">
        {['upcoming','completed'].map(t => (
          <button key={t} onClick={()=>setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${tab===t?'bg-white text-brand-700 shadow-sm':'text-[#9aaec4] hover:text-[#5a6c8a]'}`}>
            {t} <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${tab===t?'bg-brand-50 text-brand-600':'bg-white/60 text-[#9aaec4]'}`}>{counts[t]}</span>
          </button>
        ))}
      </div>

      <div className="space-y-3 stagger">
        {filtered.length===0 && <div className="card p-10 text-center text-[#9aaec4]">No {tab} appointments.</div>}
        {filtered.map(a => {
          const ModeIcon = modeIcon[a.mode] || MapPin
          return (
            <div key={a._id} className="card p-5 flex flex-col sm:flex-row sm:items-center gap-4 hover:shadow-md transition-shadow animate-slide-up opacity-0" style={{animationFillMode:'forwards'}}>
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${a.doctorColor||'from-brand-400 to-teal-500'} flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm`}>
                  {a.doctorInitials || a.doctorName?.split(' ').map(n=>n[0]).join('').slice(0,2)}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-[#0f1f3d] truncate">{a.doctorName}</p>
                  <p className="text-sm text-[#9aaec4]">{a.specialty}</p>
                  {a.notes && <p className="text-xs text-[#9aaec4] mt-0.5 italic truncate">{a.notes}</p>}
                </div>
              </div>
              <div className="flex flex-wrap gap-3 text-xs sm:flex-col sm:items-end">
                <div className="flex items-center gap-1.5 text-[#5a6c8a]"><Calendar size={13} className="text-brand-500"/>{new Date(a.date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</div>
                <div className="flex items-center gap-1.5 text-[#5a6c8a]"><Clock size={13} className="text-brand-500"/>{a.time}</div>
                <div className="flex items-center gap-1.5 text-[#5a6c8a] capitalize"><ModeIcon size={13} className="text-brand-500"/>{a.mode}</div>
              </div>
              <div className="shrink-0">
                {a.status==='upcoming' ? (
                  <div className="flex gap-2">
                    {a.mode==='video' && <button className="btn-primary text-xs py-2 px-3"><Video size={13}/> Join</button>}
                    <button onClick={()=>cancel(a._id)} disabled={cancelling===a._id} className="btn-ghost text-xs py-2 px-3 text-red-400 hover:bg-red-50 hover:text-red-500">
                      {cancelling===a._id?<Loader2 size={13} className="animate-spin"/>:<X size={13}/>} Cancel
                    </button>
                  </div>
                ) : (
                  <span className="badge badge-green"><Check size={11} className="mr-1"/> Completed</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
