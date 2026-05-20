import { useState } from 'react'
import { User, Mail, Phone, MapPin, Calendar, Shield, Edit2, Camera, Save, X, Plus, Trash2 } from 'lucide-react'
import Modal from '../components/Modal'
import { useAuth } from '../contexts/AuthContext'
import { ROLES } from '../contexts/AuthContext'

const DEFAULT_PATIENT = {
  name:'Rahul Kumar', email:'rahul.kumar@email.com', phone:'+91 98765 43210',
  location:'Bengaluru, Karnataka', dob:'March 14, 1985 (41 yrs)',
  bloodGroup:'B+', height:"5'10\"", weight:'78 kg', bmi:'24.9',
  conditions:['Type 2 Diabetes (Controlled)','Hypertension (Stage 1)','Hyperlipidemia'],
  allergies:['Penicillin','Sulfa drugs','Latex'],
  emergency:[{name:'Anjali Kumar',relation:'Spouse',phone:'+91 98765 00001'},{name:'Ravi Kumar',relation:'Father',phone:'+91 98765 00002'}],
}

const DEFAULT_DOCTOR = {
  name:'Dr. Priya Nair', email:'priya@medassist.com', phone:'+91 98765 55555',
  location:'Bengaluru, Karnataka', dob:'June 5, 1980 (45 yrs)',
  bloodGroup:'O+', height:"5'5\"", weight:'60 kg', bmi:'22.0',
  department:'Cardiology', experience:'14 years', patients:'248',
  qualifications:['MBBS — AIIMS Delhi','MD Cardiology — CMC Vellore','FESC — European Society of Cardiology'],
  languages:['English','Hindi','Malayalam'],
  emergency:[{name:'Arun Nair',relation:'Spouse',phone:'+91 98765 66666'}],
}

export default function Profile() {
  const { user } = useAuth()
  const isDoctor = user?.role === ROLES.DOCTOR
  const isReceptionist = user?.role === ROLES.RECEPTIONIST
  const defaultData = isDoctor ? DEFAULT_DOCTOR : DEFAULT_PATIENT

  const [profile, setProfile] = useState(defaultData)
  const [editOpen, setEditOpen] = useState(false)
  const [editEmergency, setEditEmergency] = useState(false)
  const [addCondition, setAddCondition] = useState('')
  const [addAllergy, setAddAllergy] = useState('')

  const save = (updated) => {
    setProfile(p => ({...p, ...updated}))
    setEditOpen(false)
  }

  const removeCondition = (c) => setProfile(p => ({...p, conditions: p.conditions.filter(x => x !== c)}))
  const removeAllergy = (a) => setProfile(p => ({...p, allergies: p.allergies.filter(x => x !== a)}))

  const medInfo = isDoctor ? [
    {label:'Department',value:profile.department,color:'text-pink-700 bg-pink-50'},
    {label:'Experience',value:profile.experience,color:'text-brand-700 bg-brand-50'},
    {label:'Patients',value:profile.patients,color:'text-teal-700 bg-teal-50'},
    {label:'Blood Group',value:profile.bloodGroup,color:'text-red-600 bg-red-50'},
  ] : [
    {label:'Blood Group',value:profile.bloodGroup,color:'text-red-600 bg-red-50'},
    {label:'Height',value:profile.height,color:'text-brand-700 bg-brand-50'},
    {label:'Weight',value:profile.weight,color:'text-teal-700 bg-teal-50'},
    {label:'BMI',value:profile.bmi,color:'text-emerald-700 bg-emerald-50'},
  ]

  const personal = [
    {icon:Mail,label:'Email',value:profile.email},
    {icon:Phone,label:'Phone',value:profile.phone},
    {icon:MapPin,label:'Location',value:profile.location},
    {icon:Calendar,label:'Date of Birth',value:profile.dob},
  ]

  return (
    <div className="p-6 max-w-[900px] mx-auto space-y-6">
      {/* Hero card */}
      <div className="card p-6 mesh-bg">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <div className="relative">
            <div className={`w-24 h-24 rounded-2xl bg-gradient-to-br ${user?.color} flex items-center justify-center text-white font-display font-bold text-3xl shadow-md`}>
              {user?.initials}
            </div>
            <button className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl bg-white border border-[#e8effc] flex items-center justify-center text-brand-600 shadow-sm hover:bg-brand-50 transition-colors">
              <Camera size={14}/>
            </button>
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h2 className="font-display font-bold text-2xl text-[#0f1f3d]">{profile.name}</h2>
            <p className="text-[#9aaec4] text-sm mt-0.5">{user?.subtitle}</p>
            <div className="flex flex-wrap gap-2 mt-3 justify-center sm:justify-start">
              {isDoctor && <span className="badge badge-pink">Cardiology Department</span>}
              {!isDoctor && !isReceptionist && <span className="badge badge-blue">Diabetes Care Program</span>}
              <span className="badge badge-green"><Shield size={10} className="mr-1"/> Verified</span>
              <span className={`badge ${user?.role==='doctor'?'bg-pink-50 text-pink-700':user?.role==='receptionist'?'bg-violet-50 text-violet-700':user?.role==='attendee'?'bg-amber-50 text-amber-700':'badge-blue'} capitalize`}>{user?.role}</span>
            </div>
          </div>
          <button onClick={() => setEditOpen(true)} className="btn-ghost border border-[#e8effc] bg-white/80">
            <Edit2 size={14}/> Edit Profile
          </button>
        </div>
      </div>

      {/* Stats */}
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
            {personal.map(p => { const Icon = p.icon; return (
              <div key={p.label} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#f4f7ff] flex items-center justify-center shrink-0"><Icon size={14} className="text-brand-600"/></div>
                <div>
                  <p className="text-[10px] text-[#9aaec4] uppercase tracking-wide font-semibold">{p.label}</p>
                  <p className="text-sm text-[#0f1f3d] font-medium">{p.value}</p>
                </div>
              </div>
            )})}
          </div>
        </div>

        {/* Conditions / Qualifications + Allergies */}
        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-semibold text-[#0f1f3d]">
                {isDoctor ? 'Qualifications' : 'Medical Conditions'}
              </h3>
            </div>
            <div className="space-y-2">
              {(isDoctor ? profile.qualifications : profile.conditions)?.map((c,i) => (
                <div key={i} className="flex items-center gap-2 bg-[#f8faff] rounded-xl px-3 py-2 group">
                  <span className="w-2 h-2 rounded-full bg-brand-500 shrink-0"/>
                  <span className="text-sm text-[#5a6c8a] flex-1">{c}</span>
                  {!isDoctor && (
                    <button onClick={() => removeCondition(c)} className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600"><X size={12}/></button>
                  )}
                </div>
              ))}
              {!isDoctor && (
                <div className="flex gap-2 mt-2">
                  <input value={addCondition} onChange={e => setAddCondition(e.target.value)} placeholder="Add condition…" className="input text-xs py-2 flex-1"/>
                  <button onClick={() => { if(addCondition) { setProfile(p => ({...p, conditions:[...p.conditions, addCondition]})); setAddCondition('') } }}
                    className="btn-primary text-xs py-2 px-3"><Plus size={12}/></button>
                </div>
              )}
            </div>
          </div>

          {!isDoctor && (
            <div className="card p-5">
              <h3 className="font-display font-semibold text-[#0f1f3d] mb-3">Known Allergies</h3>
              <div className="flex flex-wrap gap-2">
                {profile.allergies?.map(a => (
                  <span key={a} className="badge badge-red text-xs group cursor-pointer" onClick={() => removeAllergy(a)}>
                    {a} <X size={10} className="ml-1 opacity-60 group-hover:opacity-100"/>
                  </span>
                ))}
              </div>
              <div className="flex gap-2 mt-3">
                <input value={addAllergy} onChange={e => setAddAllergy(e.target.value)} placeholder="Add allergy…" className="input text-xs py-2 flex-1"/>
                <button onClick={() => { if(addAllergy) { setProfile(p => ({...p, allergies:[...p.allergies, addAllergy]})); setAddAllergy('') } }}
                  className="btn-primary text-xs py-2 px-3"><Plus size={12}/></button>
              </div>
            </div>
          )}

          {isDoctor && profile.languages && (
            <div className="card p-5">
              <h3 className="font-display font-semibold text-[#0f1f3d] mb-3">Languages Spoken</h3>
              <div className="flex flex-wrap gap-2">
                {profile.languages.map(l => <span key={l} className="badge badge-blue">{l}</span>)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Emergency contacts */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-[#0f1f3d]">Emergency Contacts</h3>
          <button onClick={() => setEditEmergency(true)} className="btn-ghost text-xs py-1.5 border border-[#e8effc]"><Edit2 size={12}/> Edit</button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {profile.emergency?.map((e,i) => (
            <div key={i} className="flex items-center gap-3 bg-[#f8faff] rounded-xl px-4 py-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-300 to-teal-400 flex items-center justify-center text-white font-bold text-xs shrink-0">
                {e.name.split(' ').map(n=>n[0]).join('')}
              </div>
              <div>
                <p className="text-sm font-semibold text-[#0f1f3d]">{e.name}</p>
                <p className="text-xs text-[#9aaec4]">{e.relation} · {e.phone}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Edit Profile Modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Profile" size="md">
        <EditProfileForm profile={profile} onSave={save} onClose={() => setEditOpen(false)}/>
      </Modal>

      {/* Edit Emergency Modal */}
      <Modal open={editEmergency} onClose={() => setEditEmergency(false)} title="Edit Emergency Contacts" size="md">
        <EditEmergencyForm
          contacts={profile.emergency}
          onSave={(contacts) => { setProfile(p => ({...p, emergency: contacts})); setEditEmergency(false) }}
          onClose={() => setEditEmergency(false)}
        />
      </Modal>
    </div>
  )
}

function EditProfileForm({ profile, onSave, onClose }) {
  const [form, setForm] = useState({
    name: profile.name, email: profile.email, phone: profile.phone,
    location: profile.location, bloodGroup: profile.bloodGroup,
    height: profile.height, weight: profile.weight,
  })
  const set = (k,v) => setForm(p => ({...p,[k]:v}))
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-xs font-semibold text-[#5a6c8a] uppercase tracking-wide block mb-1.5">Full Name</label><input value={form.name} onChange={e => set('name',e.target.value)} className="input"/></div>
        <div><label className="text-xs font-semibold text-[#5a6c8a] uppercase tracking-wide block mb-1.5">Email</label><input value={form.email} onChange={e => set('email',e.target.value)} className="input"/></div>
        <div><label className="text-xs font-semibold text-[#5a6c8a] uppercase tracking-wide block mb-1.5">Phone</label><input value={form.phone} onChange={e => set('phone',e.target.value)} className="input"/></div>
        <div><label className="text-xs font-semibold text-[#5a6c8a] uppercase tracking-wide block mb-1.5">Location</label><input value={form.location} onChange={e => set('location',e.target.value)} className="input"/></div>
        <div><label className="text-xs font-semibold text-[#5a6c8a] uppercase tracking-wide block mb-1.5">Blood Group</label>
          <select value={form.bloodGroup} onChange={e => set('bloodGroup',e.target.value)} className="input">
            {['A+','A-','B+','B-','O+','O-','AB+','AB-'].map(b => <option key={b}>{b}</option>)}
          </select></div>
        <div><label className="text-xs font-semibold text-[#5a6c8a] uppercase tracking-wide block mb-1.5">Height</label><input value={form.height} onChange={e => set('height',e.target.value)} className="input"/></div>
        <div><label className="text-xs font-semibold text-[#5a6c8a] uppercase tracking-wide block mb-1.5">Weight</label><input value={form.weight} onChange={e => set('weight',e.target.value)} className="input"/></div>
      </div>
      <div className="flex gap-3">
        <button onClick={onClose} className="btn-ghost border border-[#e8effc] flex-1 justify-center">Cancel</button>
        <button onClick={() => onSave(form)} className="btn-primary flex-1 justify-center"><Save size={14}/> Save Changes</button>
      </div>
    </div>
  )
}

function EditEmergencyForm({ contacts, onSave, onClose }) {
  const [list, setList] = useState([...contacts])
  const update = (i,k,v) => setList(prev => prev.map((c,idx) => idx===i ? {...c,[k]:v} : c))
  const remove = (i) => setList(prev => prev.filter((_,idx) => idx !== i))
  const add = () => setList(prev => [...prev, {name:'',relation:'',phone:''}])
  return (
    <div className="space-y-4">
      {list.map((c,i) => (
        <div key={i} className="bg-[#f8faff] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-[#5a6c8a]">Contact {i+1}</p>
            <button onClick={() => remove(i)} className="text-red-400 hover:text-red-600"><Trash2 size={14}/></button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input value={c.name} onChange={e => update(i,'name',e.target.value)} placeholder="Name" className="input text-xs py-2"/>
            <input value={c.relation} onChange={e => update(i,'relation',e.target.value)} placeholder="Relation" className="input text-xs py-2"/>
            <input value={c.phone} onChange={e => update(i,'phone',e.target.value)} placeholder="Phone" className="input text-xs py-2"/>
          </div>
        </div>
      ))}
      <button onClick={add} className="btn-ghost border border-[#e8effc] w-full justify-center"><Plus size={14}/> Add Contact</button>
      <div className="flex gap-3">
        <button onClick={onClose} className="btn-ghost border border-[#e8effc] flex-1 justify-center">Cancel</button>
        <button onClick={() => onSave(list)} className="btn-primary flex-1 justify-center"><Save size={14}/> Save</button>
      </div>
    </div>
  )
}
