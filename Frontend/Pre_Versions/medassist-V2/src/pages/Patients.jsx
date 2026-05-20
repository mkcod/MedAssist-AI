import { useState } from 'react'
import { Search, Plus, Eye, Phone, Calendar, Filter, ChevronRight, UserCircle } from 'lucide-react'
import Modal from '../components/Modal'
import { PATIENTS, INITIAL_APPOINTMENTS, INITIAL_RECORDS, INITIAL_MEDS } from '../data/store'
import { useAuth } from '../contexts/AuthContext'
import { ROLES } from '../contexts/AuthContext'

export default function Patients() {
  const { user } = useAuth()
  const [patients, setPatients] = useState(PATIENTS)
  const [search, setSearch] = useState('')
  const [viewPatient, setViewPatient] = useState(null)
  const [addOpen, setAddOpen] = useState(false)

  const filtered = patients.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.condition.toLowerCase().includes(search.toLowerCase()) ||
    p.id.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6 max-w-[1000px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h2 className="font-display font-bold text-xl text-[#0f1f3d]">Patient Directory</h2>
          <p className="text-sm text-[#9aaec4] mt-0.5">{patients.length} registered patients</p>
        </div>
        <div className="sm:ml-auto flex gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aaec4]"/>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patients…" className="input pl-8 py-2 text-xs w-52"/>
          </div>
          {user?.role === ROLES.RECEPTIONIST && (
            <button onClick={() => setAddOpen(true)} className="btn-primary"><Plus size={16}/> Register</button>
          )}
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-4 gap-3">
        {[
          {l:'Total',v:patients.length,c:'text-brand-700',bg:'bg-brand-50'},
          {l:'Active',v:patients.filter(p=>p.status==='Active').length,c:'text-emerald-700',bg:'bg-emerald-50'},
          {l:'Today\'s Visits',v:3,c:'text-amber-700',bg:'bg-amber-50'},
          {l:'Critical',v:1,c:'text-red-600',bg:'bg-red-50'},
        ].map(s => (
          <div key={s.l} className={`card p-4 text-center ${s.bg}`}>
            <p className={`font-display font-bold text-2xl ${s.c}`}>{s.v}</p>
            <p className="text-xs text-[#9aaec4] mt-0.5">{s.l}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[#f8faff] border-b border-[#e8effc]">
                {['Patient','ID','Age / Blood','Condition','Last Visit','Status','Actions'].map(h => (
                  <th key={h} className="text-left text-[10px] font-semibold text-[#9aaec4] uppercase tracking-wide px-4 py-3 first:pl-5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f4ff]">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-[#f8faff] transition-colors cursor-pointer" onClick={() => setViewPatient(p)}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${p.color} flex items-center justify-center text-white font-bold text-xs shrink-0`}>{p.initials}</div>
                      <p className="font-semibold text-sm text-[#0f1f3d]">{p.name}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#9aaec4] font-mono">{p.id}</td>
                  <td className="px-4 py-3 text-xs text-[#5a6c8a]">{p.age} yrs · {p.blood}</td>
                  <td className="px-4 py-3 text-xs text-[#5a6c8a] max-w-[160px] truncate">{p.condition}</td>
                  <td className="px-4 py-3 text-xs text-[#9aaec4]">{p.lastVisit}</td>
                  <td className="px-4 py-3"><span className="badge badge-green text-[10px]">{p.status}</span></td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1">
                      <button onClick={() => setViewPatient(p)} className="w-7 h-7 rounded-lg flex items-center justify-center text-[#9aaec4] hover:bg-brand-50 hover:text-brand-600 transition-colors"><Eye size={13}/></button>
                      <button className="w-7 h-7 rounded-lg flex items-center justify-center text-[#9aaec4] hover:bg-brand-50 hover:text-brand-600 transition-colors"><Phone size={13}/></button>
                      <button className="w-7 h-7 rounded-lg flex items-center justify-center text-[#9aaec4] hover:bg-brand-50 hover:text-brand-600 transition-colors"><Calendar size={13}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Patient Detail Modal */}
      <Modal open={!!viewPatient} onClose={() => setViewPatient(null)} title="Patient Details" size="lg">
        {viewPatient && <PatientDetail patient={viewPatient}/>}
      </Modal>

      {/* Register Patient Modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Register New Patient" size="md">
        <RegisterForm onRegister={(p) => {
          setPatients(prev => [...prev, {...p, id:`P00${prev.length+1}`, status:'Active', initials:p.name.split(' ').map(n=>n[0]).join(''), color:'from-brand-400 to-teal-500', lastVisit:'Apr 15, 2026'}])
          setAddOpen(false)
        }} onClose={() => setAddOpen(false)}/>
      </Modal>
    </div>
  )
}

function PatientDetail({ patient }) {
  const appts = INITIAL_APPOINTMENTS.filter(a => a.patientId === patient.id)
  const records = INITIAL_RECORDS.filter(r => r.patientId === patient.id)
  const meds = INITIAL_MEDS.filter(m => m.patientId === patient.id)

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${patient.color} flex items-center justify-center text-white font-bold text-xl shadow-sm`}>{patient.initials}</div>
        <div>
          <p className="font-display font-semibold text-[#0f1f3d] text-xl">{patient.name}</p>
          <p className="text-[#9aaec4] text-sm">{patient.id} · Age {patient.age} · {patient.blood}</p>
          <p className="text-xs text-[#5a6c8a] mt-1">{patient.condition}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#f8faff] rounded-xl p-3"><p className="text-[10px] text-[#9aaec4] uppercase font-semibold">Phone</p><p className="text-sm font-semibold text-[#0f1f3d] mt-0.5">{patient.phone}</p></div>
        <div className="bg-[#f8faff] rounded-xl p-3"><p className="text-[10px] text-[#9aaec4] uppercase font-semibold">Last Visit</p><p className="text-sm font-semibold text-[#0f1f3d] mt-0.5">{patient.lastVisit}</p></div>
      </div>

      {appts.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-[#5a6c8a] uppercase tracking-wide mb-2">Appointments ({appts.length})</p>
          <div className="space-y-2">
            {appts.slice(0,3).map(a => (
              <div key={a.id} className="flex items-center gap-3 bg-[#f8faff] rounded-xl px-3 py-2">
                <span className={`badge ${a.status==='upcoming'?'badge-blue':'badge-green'} text-[10px]`}>{a.status}</span>
                <p className="text-xs text-[#5a6c8a] flex-1">{a.doctor} · {a.date} · {a.time}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {meds.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-[#5a6c8a] uppercase tracking-wide mb-2">Active Medications ({meds.length})</p>
          <div className="flex flex-wrap gap-2">
            {meds.map(m => <span key={m.id} className="badge badge-blue">{m.name} {m.dose}</span>)}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button className="btn-primary flex-1 justify-center"><Calendar size={14}/> Book Appointment</button>
        <button className="btn-ghost border border-[#e8effc] flex-1 justify-center"><Phone size={14}/> Call Patient</button>
      </div>
    </div>
  )
}

function RegisterForm({ onRegister, onClose }) {
  const [form, setForm] = useState({name:'',age:'',blood:'O+',phone:'',condition:''})
  const set = (k,v) => setForm(p => ({...p,[k]:v}))
  return (
    <div className="space-y-4">
      <div><label className="text-xs font-semibold text-[#5a6c8a] uppercase tracking-wide block mb-1.5">Full Name *</label>
        <input value={form.name} onChange={e => set('name',e.target.value)} placeholder="Patient's full name" className="input"/></div>
      <div className="grid grid-cols-3 gap-3">
        <div><label className="text-xs font-semibold text-[#5a6c8a] uppercase tracking-wide block mb-1.5">Age</label>
          <input type="number" value={form.age} onChange={e => set('age',e.target.value)} placeholder="25" className="input"/></div>
        <div><label className="text-xs font-semibold text-[#5a6c8a] uppercase tracking-wide block mb-1.5">Blood Group</label>
          <select value={form.blood} onChange={e => set('blood',e.target.value)} className="input">
            {['A+','A-','B+','B-','O+','O-','AB+','AB-'].map(b => <option key={b}>{b}</option>)}
          </select></div>
        <div><label className="text-xs font-semibold text-[#5a6c8a] uppercase tracking-wide block mb-1.5">Phone</label>
          <input value={form.phone} onChange={e => set('phone',e.target.value)} placeholder="+91 …" className="input"/></div>
      </div>
      <div><label className="text-xs font-semibold text-[#5a6c8a] uppercase tracking-wide block mb-1.5">Condition / Reason</label>
        <input value={form.condition} onChange={e => set('condition',e.target.value)} placeholder="e.g. Fever, Checkup" className="input"/></div>
      <div className="flex gap-3">
        <button onClick={onClose} className="btn-ghost border border-[#e8effc] flex-1 justify-center">Cancel</button>
        <button onClick={() => onRegister(form)} disabled={!form.name} className="btn-primary flex-1 justify-center disabled:opacity-40">Register Patient</button>
      </div>
    </div>
  )
}
