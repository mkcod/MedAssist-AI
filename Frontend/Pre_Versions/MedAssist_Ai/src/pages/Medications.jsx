import { useState } from 'react'
import { Pill, Plus, Clock, AlertTriangle, CheckCircle, RefreshCw, Info } from 'lucide-react'

const meds = [
  {
    id: 1,
    name: 'Metformin',
    dose: '500 mg',
    frequency: 'Twice daily',
    times: ['8:00 AM', '8:00 PM'],
    purpose: 'Type 2 Diabetes',
    prescriber: 'Dr. Sunita Rao',
    refillDate: 'Apr 18, 2026',
    daysLeft: 3,
    taken: [true, false],
    color: 'from-teal-400 to-cyan-500',
    warning: 'Take with meals to reduce stomach upset.',
  },
  {
    id: 2,
    name: 'Amlodipine',
    dose: '5 mg',
    frequency: 'Once daily',
    times: ['9:00 AM'],
    purpose: 'Blood Pressure',
    prescriber: 'Dr. Priya Nair',
    refillDate: 'May 5, 2026',
    daysLeft: 20,
    taken: [true],
    color: 'from-brand-400 to-brand-600',
    warning: null,
  },
  {
    id: 3,
    name: 'Atorvastatin',
    dose: '10 mg',
    frequency: 'Once at night',
    times: ['10:00 PM'],
    purpose: 'Cholesterol',
    prescriber: 'Dr. Amit Sharma',
    refillDate: 'May 12, 2026',
    daysLeft: 27,
    taken: [false],
    color: 'from-violet-400 to-purple-600',
    warning: 'Avoid grapefruit juice while taking this medication.',
  },
  {
    id: 4,
    name: 'Vitamin D3',
    dose: '1000 IU',
    frequency: 'Once daily',
    times: ['9:00 AM'],
    purpose: 'Supplement',
    prescriber: 'Dr. Amit Sharma',
    refillDate: 'Jun 1, 2026',
    daysLeft: 47,
    taken: [true],
    color: 'from-amber-400 to-orange-500',
    warning: null,
  },
]

const adherenceData = [
  { day: 'Mon', pct: 100 }, { day: 'Tue', pct: 75 }, { day: 'Wed', pct: 100 },
  { day: 'Thu', pct: 50  }, { day: 'Fri', pct: 100 }, { day: 'Sat', pct: 75 },
  { day: 'Sun', pct: 100 },
]

export default function Medications() {
  const [takenState, setTakenState] = useState(
    Object.fromEntries(meds.map(m => [m.id, [...m.taken]]))
  )

  const toggle = (medId, idx) => {
    setTakenState(prev => {
      const updated = [...prev[medId]]
      updated[idx] = !updated[idx]
      return { ...prev, [medId]: updated }
    })
  }

  const overallAdherence = Math.round(
    (adherenceData.reduce((s, d) => s + d.pct, 0) / adherenceData.length)
  )

  return (
    <div className="p-6 max-w-[1000px] mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-xl text-[#0f1f3d]">Medications</h2>
          <p className="text-sm text-[#9aaec4] mt-0.5">Track and manage your prescriptions</p>
        </div>
        <button className="btn-primary">
          <Plus size={16} /> Add Medication
        </button>
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
                  height: `${(d.pct / 100) * 52}px`,
                  background: d.pct === 100 ? '#1c77eb' : d.pct >= 75 ? '#93c5fd' : '#fca5a5',
                }} />
                <span className="text-[9px] text-[#9aaec4] font-medium">{d.day}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Today's schedule */}
      <div>
        <h3 className="font-display font-semibold text-[#0f1f3d] mb-3 flex items-center gap-2">
          <Clock size={16} className="text-brand-600" /> Today's Schedule
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 stagger">
          {meds.map(med => (
            <div key={med.id} className="card p-5 space-y-4 animate-slide-up opacity-0 hover:shadow-md transition-shadow" style={{ animationFillMode: 'forwards' }}>
              {/* Top */}
              <div className="flex items-start gap-3">
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${med.color} flex items-center justify-center shrink-0 shadow-sm`}>
                  <Pill size={18} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-[#0f1f3d]">{med.name}</p>
                    <span className="badge badge-blue text-[10px]">{med.dose}</span>
                  </div>
                  <p className="text-xs text-[#9aaec4] mt-0.5">{med.purpose} · {med.frequency}</p>
                </div>
                {med.daysLeft <= 5 && (
                  <div className="badge badge-orange shrink-0 text-[10px]">
                    <AlertTriangle size={10} className="mr-1" /> {med.daysLeft}d left
                  </div>
                )}
              </div>

              {/* Dose times */}
              <div className="space-y-2">
                {med.times.map((t, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-[#f8faff] rounded-xl px-3 py-2">
                    <div className="flex items-center gap-2 text-sm text-[#5a6c8a]">
                      <Clock size={13} className="text-[#9aaec4]" />
                      {t}
                    </div>
                    <button
                      onClick={() => toggle(med.id, idx)}
                      className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-lg transition-all ${
                        takenState[med.id][idx]
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-[#eff6ff] text-brand-700 hover:bg-brand-100'
                      }`}
                    >
                      {takenState[med.id][idx] ? <><CheckCircle size={12}/> Taken</> : 'Mark taken'}
                    </button>
                  </div>
                ))}
              </div>

              {/* Warning */}
              {med.warning && (
                <div className="flex items-start gap-2 bg-amber-50 rounded-xl px-3 py-2 text-xs text-amber-700">
                  <Info size={12} className="shrink-0 mt-0.5" />
                  {med.warning}
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between text-xs text-[#9aaec4] pt-1 border-t border-[#f0f4ff]">
                <span>{med.prescriber}</span>
                <button className="flex items-center gap-1 text-brand-600 hover:underline font-medium">
                  <RefreshCw size={11} /> Refill {med.refillDate}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
