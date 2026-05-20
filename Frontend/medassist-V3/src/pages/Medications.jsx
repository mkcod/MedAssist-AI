import { useState, useEffect } from 'react'
import { medicationsApi } from '../services/api'
import { useSocket } from '../contexts/SocketContext'
import {
  Pill, Clock, AlertTriangle, CheckCircle, RefreshCw,
  Info, Loader2, Edit2, Save, X, Plus, Trash2
} from 'lucide-react'

// ─── Medication Edit Modal ─────────────────────────────────────────────────────
function MedEditModal({ med, onSave, onClose }) {
  const [form, setForm] = useState({
    name:          med.name          || '',
    dose:          med.dose          || '',
    purpose:       med.purpose       || '',
    frequency:     med.frequency     || '',
    times:         med.times         ? [...med.times] : [''],
    warning:       med.warning       || '',
    daysLeft:      med.daysLeft      ?? '',
    refillDate:    med.refillDate    ? med.refillDate.split('T')[0] : '',
    prescriberName:med.prescriberName|| '',
  })
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const updateTime = (i, v) => {
    const times = [...form.times]
    times[i] = v
    set('times', times)
  }
  const addTime    = () => set('times', [...form.times, ''])
  const removeTime = (i) => set('times', form.times.filter((_, idx) => idx !== i))

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {
        ...form,
        daysLeft: form.daysLeft !== '' ? Number(form.daysLeft) : undefined,
        times: form.times.filter(t => t.trim()),
      }
      await onSave(payload)
    } catch (e) {
      alert(e.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  // Close on Escape
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  const handleBackdrop = (e) => { if (e.target === e.currentTarget) onClose() }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={handleBackdrop}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-[#e8effc] w-full max-w-md max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0f4ff]">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${med.color||'from-brand-400 to-brand-600'} flex items-center justify-center shadow-sm`}>
              <Pill size={15} className="text-white"/>
            </div>
            <div>
              <h3 className="font-display font-bold text-[#0f1f3d] text-sm">Edit Medication</h3>
              <p className="text-[10px] text-[#9aaec4]">Changes saved to your profile</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-[#9aaec4] hover:bg-[#f4f7ff] transition-colors">
            <X size={15}/>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Name + Dose */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-[#9aaec4] uppercase tracking-wide font-bold block mb-1">Medication Name</label>
              <input value={form.name} onChange={e=>set('name',e.target.value)} className="input text-sm" placeholder="e.g. Metformin"/>
            </div>
            <div>
              <label className="text-[10px] text-[#9aaec4] uppercase tracking-wide font-bold block mb-1">Dose</label>
              <input value={form.dose} onChange={e=>set('dose',e.target.value)} className="input text-sm" placeholder="e.g. 500mg"/>
            </div>
          </div>

          {/* Purpose + Frequency */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-[#9aaec4] uppercase tracking-wide font-bold block mb-1">Purpose</label>
              <input value={form.purpose} onChange={e=>set('purpose',e.target.value)} className="input text-sm" placeholder="e.g. Diabetes"/>
            </div>
            <div>
              <label className="text-[10px] text-[#9aaec4] uppercase tracking-wide font-bold block mb-1">Frequency</label>
              <input value={form.frequency} onChange={e=>set('frequency',e.target.value)} className="input text-sm" placeholder="e.g. Twice daily"/>
            </div>
          </div>

          {/* Times */}
          <div>
            <label className="text-[10px] text-[#9aaec4] uppercase tracking-wide font-bold block mb-2">Scheduled Times</label>
            <div className="space-y-2">
              {form.times.map((t, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="time"
                    value={t}
                    onChange={e => updateTime(i, e.target.value)}
                    className="input text-sm flex-1"
                  />
                  {form.times.length > 1 && (
                    <button onClick={() => removeTime(i)} className="w-9 h-9 rounded-xl bg-red-50 text-red-400 hover:bg-red-100 flex items-center justify-center transition-colors">
                      <Trash2 size={13}/>
                    </button>
                  )}
                </div>
              ))}
              <button onClick={addTime} className="w-full py-2 rounded-xl border-2 border-dashed border-[#e8effc] text-sm text-[#9aaec4] hover:border-brand-200 hover:text-brand-600 transition-colors flex items-center justify-center gap-2">
                <Plus size={13}/> Add Time
              </button>
            </div>
          </div>

          {/* Prescriber */}
          <div>
            <label className="text-[10px] text-[#9aaec4] uppercase tracking-wide font-bold block mb-1">Prescriber</label>
            <input value={form.prescriberName} onChange={e=>set('prescriberName',e.target.value)} className="input text-sm" placeholder="Dr. Name"/>
          </div>

          {/* Days Left + Refill Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-[#9aaec4] uppercase tracking-wide font-bold block mb-1">Days Left</label>
              <input type="number" min="0" value={form.daysLeft} onChange={e=>set('daysLeft',e.target.value)} className="input text-sm" placeholder="e.g. 30"/>
            </div>
            <div>
              <label className="text-[10px] text-[#9aaec4] uppercase tracking-wide font-bold block mb-1">Refill Date</label>
              <input type="date" value={form.refillDate} onChange={e=>set('refillDate',e.target.value)} className="input text-sm"/>
            </div>
          </div>

          {/* Warning */}
          <div>
            <label className="text-[10px] text-[#9aaec4] uppercase tracking-wide font-bold block mb-1">Warning / Notes</label>
            <textarea
              value={form.warning}
              onChange={e=>set('warning',e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-[#e8effc] bg-white px-3 py-2 text-sm text-[#0f1f3d] focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
              placeholder="e.g. Take with food"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[#f0f4ff] flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-[#e8effc] text-sm font-semibold text-[#5a6c8a] hover:bg-[#f8faff] transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-700 text-white text-sm font-semibold hover:bg-brand-800 transition-colors disabled:opacity-60">
            {saving ? <Loader2 size={13} className="animate-spin"/> : <Save size={13}/>} Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Medications Page ─────────────────────────────────────────────────────
export default function Medications() {
  const { on } = useSocket()
  const [meds, setMeds] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingMed, setEditingMed] = useState(null)   // ✅ NEW: which med is being edited
  const today = new Date().toISOString().split('T')[0]

  const load = () =>
    medicationsApi.list()
      .then(res => setMeds(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (!on) return
    return on('medication:created', () => load())
  }, [on])

  const isTaken = (med, idx) =>
    med.takenLog?.some(l => l.date === today && l.doseIndex === idx && l.taken)

  const toggle = async (med, idx) => {
    const taken = !isTaken(med, idx)
    await medicationsApi.markTaken(med._id, idx, taken)
    load()
  }

  // ✅ NEW: Save edited medication to DB
  const handleSaveMed = async (data) => {
    await medicationsApi.update(editingMed._id, data)
    setEditingMed(null)
    load()
  }

  const adherence = () => {
    if (!meds.length) return 0
    let total = 0, taken = 0
    meds.forEach(m => {
      m.times.forEach((_, i) => { total++; if (isTaken(m, i)) taken++ })
    })
    return total ? Math.round((taken / total) * 100) : 0
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-brand-600" size={32}/>
    </div>
  )

  return (
    <div className="p-6 max-w-[1000px] mx-auto space-y-6">
      {/* ✅ Edit Modal */}
      {editingMed && (
        <MedEditModal
          med={editingMed}
          onSave={handleSaveMed}
          onClose={() => setEditingMed(null)}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-xl text-[#0f1f3d]">Medications</h2>
          <p className="text-sm text-[#9aaec4] mt-0.5">Track and manage your prescriptions</p>
        </div>
      </div>

      {/* Adherence summary */}
      <div className="card p-5 flex flex-col sm:flex-row gap-6">
        <div className="text-center sm:text-left">
          <p className="text-[11px] uppercase tracking-widest text-[#9aaec4] font-semibold">Today's Adherence</p>
          <p className="font-display font-bold text-5xl text-brand-700 mt-1">{adherence()}<span className="text-2xl">%</span></p>
          {adherence() >= 80 && (
            <p className="text-xs text-emerald-600 font-medium mt-1 flex items-center gap-1">
              <CheckCircle size={12}/> Great consistency!
            </p>
          )}
        </div>
        <div className="flex-1 flex items-end gap-1.5">
          {meds.slice(0, 7).map((m, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full rounded-md bg-brand-500 opacity-80" style={{ height:`${(adherence()/100)*52}px` }}/>
              <span className="text-[9px] text-[#9aaec4]">{m.name.slice(0, 3)}</span>
            </div>
          ))}
        </div>
      </div>

      <h3 className="font-display font-semibold text-[#0f1f3d] flex items-center gap-2">
        <Clock size={16} className="text-brand-600"/> Today's Schedule
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 stagger">
        {meds.map(med => (
          <div
            key={med._id}
            className="card p-5 space-y-4 animate-slide-up opacity-0 hover:shadow-md transition-shadow"
            style={{ animationFillMode:'forwards' }}
          >
            <div className="flex items-start gap-3">
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${med.color||'from-brand-400 to-brand-600'} flex items-center justify-center shrink-0 shadow-sm`}>
                <Pill size={18} className="text-white"/>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-[#0f1f3d]">{med.name}</p>
                  <span className="badge badge-blue text-[10px]">{med.dose}</span>
                </div>
                <p className="text-xs text-[#9aaec4] mt-0.5">{med.purpose} · {med.frequency}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {med.daysLeft <= 5 && (
                  <div className="badge badge-orange text-[10px]">
                    <AlertTriangle size={10} className="mr-1"/>{med.daysLeft}d left
                  </div>
                )}
                {/* ✅ NEW: Edit button */}
                <button
                  onClick={() => setEditingMed(med)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[#9aaec4] hover:bg-brand-50 hover:text-brand-600 transition-colors"
                  title="Edit medication"
                >
                  <Edit2 size={13}/>
                </button>
              </div>
            </div>

            {/* Times / taken toggle */}
            <div className="space-y-2">
              {med.times.map((t, idx) => (
                <div key={idx} className="flex items-center justify-between bg-[#f8faff] rounded-xl px-3 py-2">
                  <div className="flex items-center gap-2 text-sm text-[#5a6c8a]">
                    <Clock size={13} className="text-[#9aaec4]"/>{t}
                  </div>
                  <button
                    onClick={() => toggle(med, idx)}
                    className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-lg transition-all ${
                      isTaken(med, idx)
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-[#eff6ff] text-brand-700 hover:bg-brand-100'
                    }`}
                  >
                    {isTaken(med, idx) ? <><CheckCircle size={12}/> Taken</> : 'Mark taken'}
                  </button>
                </div>
              ))}
            </div>

            {med.warning && (
              <div className="flex items-start gap-2 bg-amber-50 rounded-xl px-3 py-2 text-xs text-amber-700">
                <Info size={12} className="shrink-0 mt-0.5"/>{med.warning}
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-[#9aaec4] pt-1 border-t border-[#f0f4ff]">
              <span>{med.prescriberName}</span>
              {med.refillDate && (
                <span className="flex items-center gap-1 text-brand-600 font-medium">
                  <RefreshCw size={11}/>
                  Refill {new Date(med.refillDate).toLocaleDateString('en-US',{month:'short',day:'numeric'})}
                </span>
              )}
            </div>
          </div>
        ))}
        {meds.length === 0 && (
          <div className="card p-8 text-center text-[#9aaec4] col-span-2">No medications found.</div>
        )}
      </div>
    </div>
  )
}
