import { useState } from 'react'
import { Calendar, Clock, MapPin, Video, Phone, Plus, ChevronLeft, ChevronRight, Check, X, Search, Filter } from 'lucide-react'
import Modal from '../components/Modal'
import { INITIAL_APPOINTMENTS, DOCTORS } from '../data/store'
import { useAuth } from '../contexts/AuthContext'
import { ROLES } from '../contexts/AuthContext'

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const modeIcon = { video: Video, 'in-person': MapPin, phone: Phone }

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

export default function Appointments() {
  const { user } = useAuth()
  const [appointments, setAppointments] = useState(INITIAL_APPOINTMENTS)
  const [tab, setTab] = useState('upcoming')
  const [bookOpen, setBookOpen] = useState(false)
  const [detailAppt, setDetailAppt] = useState(null)
  const [cancelAppt, setCancelAppt] = useState(null)
  const [searchQ, setSearchQ] = useState('')
  const [calMonth] = useState({ m: 3, y: 2026 }) // April 2026 (0-indexed)

  // Role-based filtering
  const myAppts = user?.role === ROLES.PATIENT
    ? appointments.filter(a => a.patientId === 'P001')
    : user?.role === ROLES.DOCTOR
    ? appointments.filter(a => a.doctorId === 'D001')
    : appointments

  const filtered = myAppts.filter(a => {
    const matchTab = tab === 'all' || a.status === tab
    const matchSearch = !searchQ || a.doctor.toLowerCase().includes(searchQ.toLowerCase()) || a.patientName.toLowerCase().includes(searchQ.toLowerCase()) || a.specialty.toLowerCase().includes(searchQ.toLowerCase())
    return matchTab && matchSearch
  })

  const upcomingDays = myAppts.filter(a => a.status === 'upcoming').map(a => {
    const d = parseInt(a.date.split(' ')[1])
    return d
  })

  const handleCancel = () => {
    setAppointments(prev => prev.map(a => a.id === cancelAppt.id ? {...a, status:'cancelled'} : a))
    setCancelAppt(null)
  }

  const handleConfirm = (id) => {
    setAppointments(prev => prev.map(a => a.id === id ? {...a, confirmed: true} : a))
  }

  const tabs = user?.role === ROLES.PATIENT
    ? ['upcoming','completed']
    : ['upcoming','completed','all']

  return (
    <div className="p-6 max-w-[1000px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <h2 className="font-display font-bold text-xl text-[#0f1f3d]">Appointments</h2>
          <p className="text-sm text-[#9aaec4] mt-0.5">
            {user?.role === ROLES.RECEPTIONIST ? 'Manage all appointments' : user?.role === ROLES.DOCTOR ? 'Your patient schedule' : 'Manage your healthcare visits'}
          </p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aaec4]"/>
            <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="Search…" className="input pl-8 py-2 text-xs w-44"/>
          </div>
          <button onClick={() => setBookOpen(true)} className="btn-primary whitespace-nowrap">
            <Plus size={16}/> Book
          </button>
        </div>
      </div>

      {/* Calendar */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-[#0f1f3d]">April 2026</h3>
          <div className="flex gap-1">
            <button className="w-7 h-7 rounded-lg flex items-center justify-center text-[#9aaec4] hover:bg-[#f4f7ff] transition-colors"><ChevronLeft size={15}/></button>
            <button className="w-7 h-7 rounded-lg flex items-center justify-center text-[#9aaec4] hover:bg-[#f4f7ff] transition-colors"><ChevronRight size={15}/></button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {DAYS.map(d => <div key={d} className="text-center text-[10px] text-[#9aaec4] font-semibold uppercase tracking-wide pb-2">{d}</div>)}
          {[...Array(3)].map((_,i) => <div key={`e${i}`}/>)}
          {[...Array(30)].map((_,i) => {
            const day = i+1; const today = day===15; const hasAppt = upcomingDays.includes(day)
            return (
              <button key={day} className={`aspect-square rounded-xl text-sm font-medium flex flex-col items-center justify-center gap-0.5 transition-all ${today?'bg-brand-700 text-white shadow-sm':'hover:bg-[#f4f7ff] text-[#0f1f3d]'}`}>
                {day}
                {hasAppt && <span className={`w-1 h-1 rounded-full ${today?'bg-white/70':'bg-brand-500'}`}/>}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#f4f7ff] p-1 rounded-xl w-fit">
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${tab===t?'bg-white text-brand-700 shadow-sm':'text-[#9aaec4] hover:text-[#5a6c8a]'}`}>
            {t}
            <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${tab===t?'bg-brand-50 text-brand-600':'bg-white/60 text-[#9aaec4]'}`}>
              {myAppts.filter(a => t==='all' || a.status===t).length}
            </span>
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-3 stagger">
        {filtered.length === 0 && <div className="card p-10 text-center text-[#9aaec4] text-sm">No appointments found.</div>}
        {filtered.map(a => {
          const ModeIcon = modeIcon[a.mode] || MapPin
          return (
            <div key={a.id} onClick={() => setDetailAppt(a)}
              className="card p-5 flex flex-col sm:flex-row sm:items-center gap-4 hover:shadow-md transition-shadow cursor-pointer animate-slide-up opacity-0"
              style={{animationFillMode:'forwards'}}>
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${a.color} flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm`}>{a.avatar}</div>
                <div className="min-w-0">
                  <p className="font-semibold text-[#0f1f3d] truncate">{user?.role === ROLES.PATIENT ? a.doctor : a.patientName}</p>
                  <p className="text-sm text-[#9aaec4]">{user?.role === ROLES.PATIENT ? a.specialty : a.doctor}</p>
                  <p className="text-xs text-[#9aaec4] mt-1 italic truncate">{a.notes}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 text-xs sm:flex-nowrap sm:flex-col sm:items-end">
                <div className="flex items-center gap-1.5 text-[#5a6c8a]"><Calendar size={13} className="text-brand-500"/>{a.date}</div>
                <div className="flex items-center gap-1.5 text-[#5a6c8a]"><Clock size={13} className="text-brand-500"/>{a.time}</div>
                <div className="flex items-center gap-1.5 text-[#5a6c8a] capitalize"><ModeIcon size={13} className="text-brand-500"/>{a.mode}</div>
              </div>
              <div className="shrink-0" onClick={e => e.stopPropagation()}>
                {a.status === 'upcoming' ? (
                  <div className="flex gap-2">
                    <button onClick={() => handleConfirm(a.id)}
                      className={`btn-primary text-xs py-2 px-3 ${a.confirmed ? 'bg-emerald-600' : ''}`}>
                      {a.mode === 'video' ? <><Video size={13}/> Join</> : a.confirmed ? <><Check size={13}/> Confirmed</> : <><Check size={13}/> Confirm</>}
                    </button>
                    <button onClick={() => setCancelAppt(a)} className="btn-ghost text-xs py-2 px-3 text-red-400 hover:bg-red-50 hover:text-red-500">
                      <X size={13}/> Cancel
                    </button>
                  </div>
                ) : a.status === 'cancelled' ? (
                  <span className="badge badge-red">Cancelled</span>
                ) : (
                  <span className="badge badge-green"><Check size={11} className="mr-1"/> Completed</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Book Modal */}
      <BookModal open={bookOpen} onClose={() => setBookOpen(false)} onBook={(appt) => {
        setAppointments(prev => [...prev, {...appt, id: Date.now(), patientId:'P001', patientName:'Rahul Kumar', status:'upcoming'}])
        setBookOpen(false)
      }}/>

      {/* Detail Modal */}
      <Modal open={!!detailAppt} onClose={() => setDetailAppt(null)} title="Appointment Details" size="md">
        {detailAppt && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${detailAppt.color} flex items-center justify-center text-white font-bold text-lg shadow-sm`}>{detailAppt.avatar}</div>
              <div>
                <p className="font-display font-semibold text-[#0f1f3d] text-lg">{detailAppt.doctor}</p>
                <p className="text-[#9aaec4]">{detailAppt.specialty}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                {l:'Date',v:detailAppt.date},{l:'Time',v:detailAppt.time},
                {l:'Mode',v:detailAppt.mode},{l:'Patient',v:detailAppt.patientName},
              ].map(f => (
                <div key={f.l} className="bg-[#f8faff] rounded-xl p-3">
                  <p className="text-[10px] text-[#9aaec4] uppercase tracking-wide font-semibold">{f.l}</p>
                  <p className="text-sm font-semibold text-[#0f1f3d] mt-0.5 capitalize">{f.v}</p>
                </div>
              ))}
            </div>
            <div className="bg-[#f8faff] rounded-xl p-3">
              <p className="text-[10px] text-[#9aaec4] uppercase tracking-wide font-semibold mb-1">Notes</p>
              <p className="text-sm text-[#5a6c8a]">{detailAppt.notes}</p>
            </div>
            {detailAppt.status === 'upcoming' && (
              <div className="flex gap-3">
                <button className="btn-primary flex-1 justify-center">{detailAppt.mode === 'video' ? 'Join Video Call' : 'Get Directions'}</button>
                <button onClick={() => { setCancelAppt(detailAppt); setDetailAppt(null) }} className="btn-ghost border border-red-100 text-red-400 hover:bg-red-50 flex-1 justify-center">Cancel Appointment</button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Cancel Confirm Modal */}
      <Modal open={!!cancelAppt} onClose={() => setCancelAppt(null)} title="Cancel Appointment" size="sm">
        <div className="space-y-4">
          <p className="text-[#5a6c8a] text-sm">Are you sure you want to cancel your appointment with <span className="font-semibold text-[#0f1f3d]">{cancelAppt?.doctor}</span> on {cancelAppt?.date}?</p>
          <div className="flex gap-3">
            <button onClick={() => setCancelAppt(null)} className="btn-ghost border border-[#e8effc] flex-1 justify-center">Keep Appointment</button>
            <button onClick={handleCancel} className="flex-1 btn-primary bg-red-500 hover:bg-red-600 justify-center">Yes, Cancel</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─── Book Modal ───────────────────────────────────────────────────────────────
function BookModal({ open, onClose, onBook }) {
  const [step, setStep] = useState(1)
  const [selectedDoctor, setSelectedDoctor] = useState(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  const [selectedMode, setSelectedMode] = useState('in-person')
  const [notes, setNotes] = useState('')

  const reset = () => { setStep(1); setSelectedDoctor(null); setSelectedDate(''); setSelectedTime(''); setNotes('') }

  const handleClose = () => { reset(); onClose() }

  const handleBook = () => {
    const doc = DOCTORS.find(d => d.id === selectedDoctor)
    onBook({
      doctor: doc.name, doctorId: doc.id, specialty: doc.specialty,
      date: selectedDate, time: selectedTime, mode: selectedMode,
      avatar: doc.avatar, color: doc.color, notes: notes || 'No notes provided.',
    })
    reset()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Book Appointment" size="lg">
      {/* Steps */}
      <div className="flex items-center gap-2 mb-6">
        {[1,2,3].map(s => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step >= s ? 'bg-brand-700 text-white' : 'bg-[#f4f7ff] text-[#9aaec4]'}`}>{s}</div>
            <p className={`text-xs font-medium hidden sm:block ${step >= s ? 'text-brand-700' : 'text-[#9aaec4]'}`}>
              {s===1?'Select Doctor':s===2?'Date & Time':'Confirm'}
            </p>
            {s<3 && <div className={`flex-1 h-0.5 rounded ${step > s ? 'bg-brand-400' : 'bg-[#e8effc]'}`}/>}
          </div>
        ))}
      </div>

      {/* Step 1: Choose Doctor */}
      {step === 1 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-[#5a6c8a] mb-3">Select a specialist</p>
          {DOCTORS.map(doc => (
            <button key={doc.id} onClick={() => setSelectedDoctor(doc.id)}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${selectedDoctor===doc.id?'border-brand-400 bg-brand-50':'border-[#e8effc] hover:border-brand-200'}`}>
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${doc.color} flex items-center justify-center text-white font-bold text-sm shrink-0`}>{doc.avatar}</div>
              <div>
                <p className="font-semibold text-[#0f1f3d]">{doc.name}</p>
                <p className="text-sm text-[#9aaec4]">{doc.specialty}</p>
              </div>
              {selectedDoctor===doc.id && <Check size={18} className="ml-auto text-brand-600"/>}
            </button>
          ))}
          <button disabled={!selectedDoctor} onClick={() => setStep(2)} className="btn-primary w-full justify-center mt-4 disabled:opacity-40 disabled:cursor-not-allowed">Next</button>
        </div>
      )}

      {/* Step 2: Date & Time */}
      {step === 2 && (
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-[#5a6c8a] uppercase tracking-wide block mb-1.5">Select Date</label>
            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="input" min="2026-04-15"/>
          </div>
          <div>
            <label className="text-xs font-semibold text-[#5a6c8a] uppercase tracking-wide block mb-1.5">Available Slots</label>
            <div className="grid grid-cols-3 gap-2">
              {(DOCTORS.find(d => d.id === selectedDoctor)?.slots || []).map(slot => (
                <button key={slot} onClick={() => setSelectedTime(slot)}
                  className={`py-2 rounded-xl text-xs font-semibold border-2 transition-all ${selectedTime===slot?'bg-brand-700 text-white border-brand-700':'border-[#e8effc] text-[#5a6c8a] hover:border-brand-300'}`}>
                  {slot}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-[#5a6c8a] uppercase tracking-wide block mb-1.5">Visit Mode</label>
            <div className="flex gap-2">
              {[{v:'in-person',icon:MapPin,l:'In-Person'},{v:'video',icon:Video,l:'Video'},{v:'phone',icon:Phone,l:'Phone'}].map(m => (
                <button key={m.v} onClick={() => setSelectedMode(m.v)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border-2 text-xs font-semibold transition-all ${selectedMode===m.v?'bg-brand-700 text-white border-brand-700':'border-[#e8effc] text-[#5a6c8a] hover:border-brand-300'}`}>
                  <m.icon size={13}/> {m.l}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-[#5a6c8a] uppercase tracking-wide block mb-1.5">Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Reason for visit, symptoms, etc." className="input resize-none"/>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="btn-ghost border border-[#e8effc] flex-1 justify-center">Back</button>
            <button disabled={!selectedDate || !selectedTime} onClick={() => setStep(3)} className="btn-primary flex-1 justify-center disabled:opacity-40 disabled:cursor-not-allowed">Next</button>
          </div>
        </div>
      )}

      {/* Step 3: Confirm */}
      {step === 3 && (() => {
        const doc = DOCTORS.find(d => d.id === selectedDoctor)
        return (
          <div className="space-y-4">
            <div className="card p-5 bg-brand-50 border-brand-100">
              <p className="text-xs font-semibold text-brand-600 uppercase tracking-wide mb-3">Appointment Summary</p>
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${doc?.color} flex items-center justify-center text-white font-bold shadow-sm`}>{doc?.avatar}</div>
                <div><p className="font-semibold text-[#0f1f3d]">{doc?.name}</p><p className="text-sm text-[#9aaec4]">{doc?.specialty}</p></div>
              </div>
              {[{l:'Date',v:selectedDate},{l:'Time',v:selectedTime},{l:'Mode',v:selectedMode},{l:'Notes',v:notes||'None'}].map(f => (
                <div key={f.l} className="flex justify-between py-2 border-b border-brand-100 last:border-0">
                  <p className="text-xs text-[#9aaec4] font-medium">{f.l}</p>
                  <p className="text-xs font-semibold text-[#0f1f3d] capitalize">{f.v}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="btn-ghost border border-[#e8effc] flex-1 justify-center">Back</button>
              <button onClick={handleBook} className="btn-primary flex-1 justify-center">Confirm Booking</button>
            </div>
          </div>
        )
      })()}
    </Modal>
  )
}
