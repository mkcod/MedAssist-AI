import { useState } from 'react'
import { Pill, Plus, Clock, AlertTriangle, CheckCircle, RefreshCw, Info, X, Trash2, Edit2 } from 'lucide-react'
import Modal from '../components/Modal'
import { INITIAL_MEDS } from '../data/store'
import { useAuth } from '../contexts/AuthContext'
import { ROLES } from '../contexts/AuthContext'

const adherenceData = [
  {day:'Mon',pct:100},{day:'Tue',pct:75},{day:'Wed',pct:100},
  {day:'Thu',pct:50},{day:'Fri',pct:100},{day:'Sat',pct:75},{day:'Sun',pct:100},
]

const GRAD_OPTIONS = [
  'from-teal-400 to-cyan-500','from-brand-400 to-brand-600',
  'from-violet-400 to-purple-600','from-amber-400 to-orange-500',
  'from-pink-400 to-rose-500','from-emerald-400 to-green-600',
]

export default function Medications() {
  const { user } = useAuth()
  const [meds, setMeds] = useState(INITIAL_MEDS)
  const [takenState, setTakenState] = useState(
    Object.fromEntries(INITIAL_MEDS.map(m => [m.id, [...m.taken]]))
  )
  const [addOpen, setAddOpen] = useState(false)
  const [refillMed, setRefillMed] = useState(null)
  const [deleteMed, setDeleteMed] = useState(null)
  const [editMed, setEditMed] = useState(null)

  const toggle = (medId, idx) => {
    setTakenState(prev => {
      const updated = [...prev[medId]]
      updated[idx] = !updated[idx]
      return {...prev, [medId]: updated}
    })
  }

  const overallAdherence = Math.round(adherenceData.reduce((s,d) => s+d.pct, 0) / adherenceData.length)

  const handleAdd = (med) => {
    const newMed = {...med, id: Date.now(), patientId:'P001', taken: med.times.map(() => false)}
    setMeds(prev => [...prev, newMed])
    setTakenState(prev => ({...prev, [newMed.id]: newMed.taken}))
    setAddOpen(false)
  }

  const handleDelete = () => {
    setMeds(prev => prev.filter(m => m.id !== deleteMed.id))
    setTakenState(prev => { const n = {...prev}; delete n[deleteMed.id]; return n })
    setDeleteMed(null)
  }

  const handleRefill = () => {
    setMeds(prev => prev.map(m => m.id === refillMed.id ? {...m, daysLeft: 30, refillDate:'May 15, 2026'} : m))
    setRefillMed(null)
  }

  const canEdit = user?.role === ROLES.DOCTOR || user?.role === ROLES.PATIENT

  return (
    <div className="p-6 max-w-[1000px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-xl text-[#0f1f3d]">Medications</h2>
          <p className="text-sm text-[#9aaec4] mt-0.5">Track and manage your prescriptions</p>
        </div>
        {canEdit && (
          <button onClick={() => setAddOpen(true)} className="btn-primary"><Plus size={16}/> Add Medication</button>
        )}
      </div>

      {/* Adherence summary */}
      <div className="card p-5 flex flex-col sm:flex-row gap-6">
        <div className="text-center sm:text-left">
          <p className="text-[11px] uppercase tracking-widest text-[#9aaec4] font-semibold">Weekly Adherence</p>
          <p className="font-display font-bold text-5xl text-brand-700 mt-1">{overallAdherence}<span className="text-2xl">%</span></p>
          <p className="text-xs text-emerald-600 font-medium mt-1 flex items-center gap-1 justify-center sm:justify-start">
            <CheckCircle size={12}/> Great consistency!
          </p>
        </div>
        <div className="flex-1">
          <div className="flex items-end gap-1.5 h-16">
            {adherenceData.map(d => (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full rounded-md transition-all" style={{
                  height:`${(d.pct/100)*52}px`,
                  background: d.pct===100?'#1c77eb':d.pct>=75?'#93c5fd':'#fca5a5',
                }}/>
                <span className="text-[9px] text-[#9aaec4] font-medium">{d.day}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Today's schedule */}
      <div>
        <h3 className="font-display font-semibold text-[#0f1f3d] mb-3 flex items-center gap-2">
          <Clock size={16} className="text-brand-600"/> Today's Schedule
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 stagger">
          {meds.map(med => (
            <div key={med.id} className="card p-5 space-y-4 animate-slide-up opacity-0 hover:shadow-md transition-shadow"
              style={{animationFillMode:'forwards'}}>
              {/* Top */}
              <div className="flex items-start gap-3">
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${med.color} flex items-center justify-center shrink-0 shadow-sm`}>
                  <Pill size={18} className="text-white"/>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-[#0f1f3d]">{med.name}</p>
                    <span className="badge badge-blue text-[10px]">{med.dose}</span>
                  </div>
                  <p className="text-xs text-[#9aaec4] mt-0.5">{med.purpose} · {med.frequency}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  {med.daysLeft <= 5 && (
                    <span className="badge badge-orange text-[10px]"><AlertTriangle size={10} className="mr-1"/>{med.daysLeft}d</span>
                  )}
                  {canEdit && (
                    <button onClick={() => setEditMed(med)} className="w-6 h-6 rounded-lg flex items-center justify-center text-[#9aaec4] hover:text-brand-600 hover:bg-brand-50 transition-colors">
                      <Edit2 size={12}/>
                    </button>
                  )}
                  {canEdit && (
                    <button onClick={() => setDeleteMed(med)} className="w-6 h-6 rounded-lg flex items-center justify-center text-[#9aaec4] hover:text-red-500 hover:bg-red-50 transition-colors">
                      <Trash2 size={12}/>
                    </button>
                  )}
                </div>
              </div>

              {/* Dose times */}
              <div className="space-y-2">
                {med.times.map((t,idx) => (
                  <div key={idx} className="flex items-center justify-between bg-[#f8faff] rounded-xl px-3 py-2">
                    <div className="flex items-center gap-2 text-sm text-[#5a6c8a]">
                      <Clock size={13} className="text-[#9aaec4]"/>{t}
                    </div>
                    <button onClick={() => toggle(med.id, idx)}
                      className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-lg transition-all ${
                        takenState[med.id]?.[idx]
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-[#eff6ff] text-brand-700 hover:bg-brand-100'
                      }`}>
                      {takenState[med.id]?.[idx] ? <><CheckCircle size={12}/> Taken</> : 'Mark taken'}
                    </button>
                  </div>
                ))}
              </div>

              {/* Warning */}
              {med.warning && (
                <div className="flex items-start gap-2 bg-amber-50 rounded-xl px-3 py-2 text-xs text-amber-700">
                  <Info size={12} className="shrink-0 mt-0.5"/>{med.warning}
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between text-xs text-[#9aaec4] pt-1 border-t border-[#f0f4ff]">
                <span>{med.prescriber}</span>
                <button onClick={() => setRefillMed(med)} className="flex items-center gap-1 text-brand-600 hover:underline font-medium">
                  <RefreshCw size={11}/> Refill {med.refillDate}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Medication Modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Medication" size="md">
        <AddMedForm onAdd={handleAdd} onClose={() => setAddOpen(false)}/>
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editMed} onClose={() => setEditMed(null)} title="Edit Medication" size="md">
        {editMed && <EditMedForm med={editMed} onSave={(updated) => {
          setMeds(prev => prev.map(m => m.id === editMed.id ? {...m, ...updated} : m))
          setEditMed(null)
        }} onClose={() => setEditMed(null)}/>}
      </Modal>

      {/* Refill Modal */}
      <Modal open={!!refillMed} onClose={() => setRefillMed(null)} title="Request Refill" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-[#5a6c8a]">
            Request a refill for <span className="font-semibold text-[#0f1f3d]">{refillMed?.name} {refillMed?.dose}</span>?<br/>
            This will notify <span className="font-semibold">{refillMed?.prescriber}</span> to authorize the refill.
          </p>
          <div className="flex gap-3">
            <button onClick={() => setRefillMed(null)} className="btn-ghost border border-[#e8effc] flex-1 justify-center">Cancel</button>
            <button onClick={handleRefill} className="btn-primary flex-1 justify-center"><RefreshCw size={14}/> Request Refill</button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal open={!!deleteMed} onClose={() => setDeleteMed(null)} title="Remove Medication" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-[#5a6c8a]">Are you sure you want to remove <span className="font-semibold text-[#0f1f3d]">{deleteMed?.name}</span> from your medication list?</p>
          <div className="flex gap-3">
            <button onClick={() => setDeleteMed(null)} className="btn-ghost border border-[#e8effc] flex-1 justify-center">Cancel</button>
            <button onClick={handleDelete} className="btn-primary bg-red-500 hover:bg-red-600 flex-1 justify-center">Remove</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function AddMedForm({ onAdd, onClose }) {
  const [form, setForm] = useState({
    name:'', dose:'', frequency:'Once daily', times:['9:00 AM'],
    purpose:'', prescriber:'', refillDate:'', daysLeft:30,
    color: GRAD_OPTIONS[0], warning:''
  })
  const set = (k,v) => setForm(p => ({...p, [k]:v}))

  const freqToTimes = (f) => {
    if (f==='Once daily') return ['9:00 AM']
    if (f==='Twice daily') return ['9:00 AM','9:00 PM']
    if (f==='Three times daily') return ['8:00 AM','2:00 PM','8:00 PM']
    if (f==='Once at night') return ['10:00 PM']
    return ['9:00 AM']
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-xs font-semibold text-[#5a6c8a] uppercase tracking-wide block mb-1.5">Medicine Name *</label>
          <input value={form.name} onChange={e => set('name',e.target.value)} placeholder="e.g. Paracetamol" className="input"/></div>
        <div><label className="text-xs font-semibold text-[#5a6c8a] uppercase tracking-wide block mb-1.5">Dose *</label>
          <input value={form.dose} onChange={e => set('dose',e.target.value)} placeholder="e.g. 500 mg" className="input"/></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-xs font-semibold text-[#5a6c8a] uppercase tracking-wide block mb-1.5">Frequency</label>
          <select value={form.frequency} onChange={e => set('times', freqToTimes(e.target.value)) || set('frequency',e.target.value)} className="input">
            {['Once daily','Twice daily','Three times daily','Once at night'].map(f => <option key={f}>{f}</option>)}
          </select></div>
        <div><label className="text-xs font-semibold text-[#5a6c8a] uppercase tracking-wide block mb-1.5">Purpose</label>
          <input value={form.purpose} onChange={e => set('purpose',e.target.value)} placeholder="e.g. Fever" className="input"/></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-xs font-semibold text-[#5a6c8a] uppercase tracking-wide block mb-1.5">Prescriber</label>
          <input value={form.prescriber} onChange={e => set('prescriber',e.target.value)} placeholder="Dr. Name" className="input"/></div>
        <div><label className="text-xs font-semibold text-[#5a6c8a] uppercase tracking-wide block mb-1.5">Refill Date</label>
          <input type="date" value={form.refillDate} onChange={e => set('refillDate',e.target.value)} className="input"/></div>
      </div>
      <div><label className="text-xs font-semibold text-[#5a6c8a] uppercase tracking-wide block mb-1.5">Color</label>
        <div className="flex gap-2">
          {GRAD_OPTIONS.map(g => (
            <button key={g} onClick={() => set('color',g)} className={`w-8 h-8 rounded-xl bg-gradient-to-br ${g} ${form.color===g?'ring-2 ring-brand-400 ring-offset-1':''}`}/>
          ))}
        </div>
      </div>
      <div><label className="text-xs font-semibold text-[#5a6c8a] uppercase tracking-wide block mb-1.5">Warning / Instructions</label>
        <input value={form.warning} onChange={e => set('warning',e.target.value)} placeholder="e.g. Take with food" className="input"/></div>
      <div className="flex gap-3">
        <button onClick={onClose} className="btn-ghost border border-[#e8effc] flex-1 justify-center">Cancel</button>
        <button onClick={() => onAdd(form)} disabled={!form.name||!form.dose} className="btn-primary flex-1 justify-center disabled:opacity-40">Add Medication</button>
      </div>
    </div>
  )
}

function EditMedForm({ med, onSave, onClose }) {
  const [form, setForm] = useState({dose: med.dose, refillDate: med.refillDate, warning: med.warning||'', prescriber: med.prescriber})
  const set = (k,v) => setForm(p => ({...p,[k]:v}))
  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-[#0f1f3d]">{med.name}</p>
      <div><label className="text-xs font-semibold text-[#5a6c8a] uppercase tracking-wide block mb-1.5">Dose</label>
        <input value={form.dose} onChange={e => set('dose',e.target.value)} className="input"/></div>
      <div><label className="text-xs font-semibold text-[#5a6c8a] uppercase tracking-wide block mb-1.5">Prescriber</label>
        <input value={form.prescriber} onChange={e => set('prescriber',e.target.value)} className="input"/></div>
      <div><label className="text-xs font-semibold text-[#5a6c8a] uppercase tracking-wide block mb-1.5">Warning</label>
        <input value={form.warning} onChange={e => set('warning',e.target.value)} className="input"/></div>
      <div className="flex gap-3">
        <button onClick={onClose} className="btn-ghost border border-[#e8effc] flex-1 justify-center">Cancel</button>
        <button onClick={() => onSave(form)} className="btn-primary flex-1 justify-center">Save Changes</button>
      </div>
    </div>
  )
}
