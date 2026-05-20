import { User, Mail, Phone, MapPin, Calendar, Droplets, Weight, Ruler, Shield, Edit2, Camera } from 'lucide-react'

const personal = [
  { icon: Mail,     label: 'Email',       value: 'rahul.kumar@email.com' },
  { icon: Phone,    label: 'Phone',       value: '+91 98765 43210' },
  { icon: MapPin,   label: 'Location',    value: 'Bengaluru, Karnataka' },
  { icon: Calendar, label: 'Date of Birth', value: 'March 14, 1985 (41 yrs)' },
]

const medInfo = [
  { label: 'Blood Group',   value: 'B+', color: 'text-red-600 bg-red-50'   },
  { label: 'Height',        value: '5\'10"', color: 'text-brand-700 bg-brand-50' },
  { label: 'Weight',        value: '78 kg', color: 'text-teal-700 bg-teal-50' },
  { label: 'BMI',           value: '24.9', color: 'text-emerald-700 bg-emerald-50' },
]

const conditions = ['Type 2 Diabetes (Controlled)', 'Hypertension (Stage 1)', 'Hyperlipidemia']
const allergies = ['Penicillin', 'Sulfa drugs', 'Latex']

const emergency = [
  { name: 'Anjali Kumar', relation: 'Spouse', phone: '+91 98765 00001' },
  { name: 'Ravi Kumar',   relation: 'Father', phone: '+91 98765 00002' },
]

export default function Profile() {
  return (
    <div className="p-6 max-w-[900px] mx-auto space-y-6">

      {/* Hero card */}
      <div className="card p-6 mesh-bg">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <div className="relative">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-brand-400 to-teal-500 flex items-center justify-center text-white font-display font-bold text-3xl shadow-md">
              RK
            </div>
            <button className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl bg-white border border-[#e8effc] flex items-center justify-center text-brand-600 shadow-sm hover:bg-brand-50 transition-colors">
              <Camera size={14} />
            </button>
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h2 className="font-display font-bold text-2xl text-[#0f1f3d]">Rahul Kumar</h2>
            <p className="text-[#9aaec4] text-sm mt-0.5">Patient ID #2891 · Member since January 2024</p>
            <div className="flex flex-wrap gap-2 mt-3 justify-center sm:justify-start">
              <span className="badge badge-blue">Diabetes Care Program</span>
              <span className="badge badge-green">
                <Shield size={10} className="mr-1" /> Verified
              </span>
            </div>
          </div>
          <button className="btn-ghost border border-[#e8effc] bg-white/80">
            <Edit2 size={14} /> Edit Profile
          </button>
        </div>
      </div>

      {/* Medical info chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {medInfo.map(m => (
          <div key={m.label} className={`card p-4 text-center ${m.color}`}>
            <p className="font-display font-bold text-xl">{m.value}</p>
            <p className="text-xs mt-0.5 opacity-70 font-medium">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Two column */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

        {/* Personal info */}
        <div className="card p-5 space-y-4">
          <h3 className="font-display font-semibold text-[#0f1f3d]">Personal Information</h3>
          <div className="space-y-3">
            {personal.map(p => {
              const Icon = p.icon
              return (
                <div key={p.label} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#f4f7ff] flex items-center justify-center shrink-0">
                    <Icon size={14} className="text-brand-600" />
                  </div>
                  <div>
                    <p className="text-[10px] text-[#9aaec4] uppercase tracking-wide font-semibold">{p.label}</p>
                    <p className="text-sm text-[#0f1f3d] font-medium">{p.value}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Medical conditions + allergies */}
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="font-display font-semibold text-[#0f1f3d] mb-3">Medical Conditions</h3>
            <div className="space-y-2">
              {conditions.map(c => (
                <div key={c} className="flex items-center gap-2 bg-[#f8faff] rounded-xl px-3 py-2">
                  <span className="w-2 h-2 rounded-full bg-brand-500 shrink-0" />
                  <span className="text-sm text-[#5a6c8a]">{c}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-display font-semibold text-[#0f1f3d] mb-3">Known Allergies</h3>
            <div className="flex flex-wrap gap-2">
              {allergies.map(a => (
                <span key={a} className="badge badge-red text-xs">{a}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Emergency contacts */}
      <div className="card p-5">
        <h3 className="font-display font-semibold text-[#0f1f3d] mb-4">Emergency Contacts</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {emergency.map((e, i) => (
            <div key={i} className="flex items-center gap-3 bg-[#f8faff] rounded-xl px-4 py-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-300 to-teal-400 flex items-center justify-center text-white font-bold text-xs shrink-0">
                {e.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div>
                <p className="text-sm font-semibold text-[#0f1f3d]">{e.name}</p>
                <p className="text-xs text-[#9aaec4]">{e.relation} · {e.phone}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
