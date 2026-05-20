import { useState } from 'react'
import { Calendar, Clock, MapPin, Video, Phone, Plus, ChevronLeft, ChevronRight, Check, X } from 'lucide-react'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

const appointments = [
  { id:1, doctor:'Dr. Priya Nair',     specialty:'Cardiology',        date:'Apr 16', time:'10:30 AM', mode:'video',    status:'upcoming',  avatar:'PN', color:'from-pink-400 to-rose-500',     notes:'Bring recent ECG report' },
  { id:2, doctor:'Dr. Amit Sharma',    specialty:'General Physician', date:'Apr 18', time:'2:00 PM',  mode:'in-person', status:'upcoming', avatar:'AS', color:'from-violet-400 to-purple-500',  notes:'Annual checkup' },
  { id:3, doctor:'Dr. Sunita Rao',     specialty:'Endocrinology',     date:'Apr 22', time:'11:00 AM', mode:'in-person', status:'upcoming', avatar:'SR', color:'from-teal-400 to-cyan-500',     notes:'Diabetes review — bring glucose log' },
  { id:4, doctor:'Dr. Vikram Mehta',   specialty:'Ophthalmology',     date:'Mar 28', time:'3:30 PM',  mode:'in-person', status:'completed', avatar:'VM', color:'from-amber-400 to-orange-500',  notes:'Annual eye exam completed' },
  { id:5, doctor:'Dr. Priya Nair',     specialty:'Cardiology',        date:'Feb 12', time:'9:00 AM',  mode:'video',     status:'completed', avatar:'PN', color:'from-pink-400 to-rose-500',    notes:'Follow-up after stress test' },
]

const modeIcon = { video: Video, 'in-person': MapPin, phone: Phone }

export default function Appointments() {
  const [tab, setTab] = useState('upcoming')
  const filtered = appointments.filter(a => a.status === tab)

  return (
    <div className="p-6 max-w-[1000px] mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <h2 className="font-display font-bold text-xl text-[#0f1f3d]">Appointments</h2>
          <p className="text-sm text-[#9aaec4] mt-0.5">Manage your healthcare visits</p>
        </div>
        <button className="btn-primary w-fit">
          <Plus size={16} /> Book Appointment
        </button>
      </div>

      {/* Calendar strip */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-[#0f1f3d]">April 2026</h3>
          <div className="flex gap-1">
            <button className="w-7 h-7 rounded-lg flex items-center justify-center text-[#9aaec4] hover:bg-[#f4f7ff] transition-colors"><ChevronLeft size={15}/></button>
            <button className="w-7 h-7 rounded-lg flex items-center justify-center text-[#9aaec4] hover:bg-[#f4f7ff] transition-colors"><ChevronRight size={15}/></button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {DAYS.map(d => (
            <div key={d} className="text-center text-[10px] text-[#9aaec4] font-semibold uppercase tracking-wide pb-2">{d}</div>
          ))}
          {/* Empty cells for April starting on Wednesday */}
          {[...Array(3)].map((_, i) => <div key={`e${i}`} />)}
          {[...Array(30)].map((_, i) => {
            const day = i + 1
            const today = day === 15
            const hasAppt = [16, 18, 22].includes(day)
            return (
              <button key={day} className={`
                aspect-square rounded-xl text-sm font-medium flex flex-col items-center justify-center gap-0.5 transition-all
                ${today ? 'bg-brand-700 text-white shadow-sm' : 'hover:bg-[#f4f7ff] text-[#0f1f3d]'}
              `}>
                {day}
                {hasAppt && <span className={`w-1 h-1 rounded-full ${today ? 'bg-white/70' : 'bg-brand-500'}`} />}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#f4f7ff] p-1 rounded-xl w-fit">
        {['upcoming','completed'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
              tab === t ? 'bg-white text-brand-700 shadow-sm' : 'text-[#9aaec4] hover:text-[#5a6c8a]'
            }`}
          >
            {t}
            <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
              tab === t ? 'bg-brand-50 text-brand-600' : 'bg-white/60 text-[#9aaec4]'
            }`}>
              {appointments.filter(a => a.status === t).length}
            </span>
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-3 stagger">
        {filtered.map(a => {
          const ModeIcon = modeIcon[a.mode] || MapPin
          return (
            <div key={a.id} className="card p-5 flex flex-col sm:flex-row sm:items-center gap-4 hover:shadow-md transition-shadow animate-slide-up opacity-0" style={{ animationFillMode: 'forwards' }}>
              {/* Doctor */}
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${a.color} flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm`}>
                  {a.avatar}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-[#0f1f3d] truncate">{a.doctor}</p>
                  <p className="text-sm text-[#9aaec4]">{a.specialty}</p>
                  <p className="text-xs text-[#9aaec4] mt-1 italic truncate">{a.notes}</p>
                </div>
              </div>

              {/* Details */}
              <div className="flex flex-wrap gap-3 text-xs sm:flex-nowrap sm:flex-col sm:items-end">
                <div className="flex items-center gap-1.5 text-[#5a6c8a]">
                  <Calendar size={13} className="text-brand-500" />
                  {a.date}
                </div>
                <div className="flex items-center gap-1.5 text-[#5a6c8a]">
                  <Clock size={13} className="text-brand-500" />
                  {a.time}
                </div>
                <div className="flex items-center gap-1.5 text-[#5a6c8a] capitalize">
                  <ModeIcon size={13} className="text-brand-500" />
                  {a.mode}
                </div>
              </div>

              {/* Status / Action */}
              <div className="shrink-0">
                {a.status === 'upcoming' ? (
                  <div className="flex gap-2">
                    <button className="btn-primary text-xs py-2 px-3">
                      {a.mode === 'video' ? <><Video size={13}/> Join</> : <><Check size={13}/> Confirm</>}
                    </button>
                    <button className="btn-ghost text-xs py-2 px-3 text-red-400 hover:bg-red-50 hover:text-red-500">
                      <X size={13}/> Cancel
                    </button>
                  </div>
                ) : (
                  <span className="badge badge-green">
                    <Check size={11} className="mr-1" /> Completed
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
