import { useState, useEffect } from 'react'
import { usersApi } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import {
  User, Mail, Phone, MapPin, Calendar, Shield, Edit2, Camera,
  Save, X, Loader2, Plus, Trash2, Heart, AlertTriangle
} from 'lucide-react'

// ─── Tag Input (for conditions & allergies) ────────────────────────────────────
function TagInput({ value = [], onChange, placeholder, colorClass = 'badge-blue' }) {
  const [input, setInput] = useState('')
  const add = () => {
    const v = input.trim()
    if (v && !value.includes(v)) { onChange([...value, v]); setInput('') }
  }
  const remove = (i) => onChange(value.filter((_, idx) => idx !== i))
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder={placeholder}
          className="input text-sm flex-1"
        />
        <button type="button" onClick={add} className="px-3 py-2 rounded-xl bg-brand-700 text-white text-sm font-semibold hover:bg-brand-800 transition-colors">
          <Plus size={14}/>
        </button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((v, i) => (
            <span key={i} className={`badge ${colorClass} text-xs flex items-center gap-1`}>
              {v}
              <button onClick={() => remove(i)} className="ml-0.5 hover:opacity-70"><X size={10}/></button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Emergency Contact Editor ──────────────────────────────────────────────────
function EmergencyContactEditor({ contacts = [], onChange }) {
  const update = (i, field, val) => {
    const updated = contacts.map((c, idx) => idx === i ? { ...c, [field]: val } : c)
    onChange(updated)
  }
  const add = () => onChange([...contacts, { name: '', relation: '', phone: '' }])
  const remove = (i) => onChange(contacts.filter((_, idx) => idx !== i))

  return (
    <div className="space-y-3">
      {contacts.map((ec, i) => (
        <div key={i} className="bg-[#f8faff] rounded-xl p-3 border border-[#e8effc] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#5a6c8a]">Contact {i + 1}</span>
            <button onClick={() => remove(i)} className="text-red-400 hover:text-red-600"><Trash2 size={13}/></button>
          </div>
          <input value={ec.name} onChange={e=>update(i,'name',e.target.value)} placeholder="Full name" className="input text-sm"/>
          <div className="grid grid-cols-2 gap-2">
            <input value={ec.relation} onChange={e=>update(i,'relation',e.target.value)} placeholder="Relation (e.g. Spouse)" className="input text-sm"/>
            <input value={ec.phone} onChange={e=>update(i,'phone',e.target.value)} placeholder="Phone number" className="input text-sm"/>
          </div>
        </div>
      ))}
      <button onClick={add} className="w-full py-2 rounded-xl border-2 border-dashed border-[#e8effc] text-sm text-[#9aaec4] hover:border-brand-200 hover:text-brand-600 transition-colors flex items-center justify-center gap-2">
        <Plus size={14}/> Add Contact
      </button>
    </div>
  )
}

// ─── Main Profile Page ─────────────────────────────────────────────────────────
export default function Profile() {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({})

  useEffect(() => {
    usersApi.myProfile()
      .then(res => {
        const data = res.data
        setProfile(data)
        // ✅ FIX: Load ALL fields into form (patient + doctor)
        const p = data?.patientProfile || {}
        const d = data?.doctorProfile || {}
        setForm({
          name:    data.name || '',
          phone:   data.phone || '',
          // patient fields
          address:           p.address || '',
          dateOfBirth:       p.dateOfBirth ? p.dateOfBirth.split('T')[0] : '',
          bloodGroup:        p.bloodGroup || '',
          height:            p.height || '',
          weight:            p.weight || '',
          conditions:        p.conditions || [],
          allergies:         p.allergies || [],
          emergencyContacts: p.emergencyContacts || [],
          // doctor fields
          specialty:   d.specialty || '',
          department:  d.department || '',
          experience:  d.experience || '',
          regNumber:   d.regNumber || '',
        })
      })
      .catch(() => {
        setProfile(user)
        setForm({ name: user?.name || '', phone: user?.phone || '' })
      })
      .finally(() => setLoading(false))
  }, [])

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  // ✅ BMI auto-calculate: height in cm, weight in kg → BMI = kg / m²
  useEffect(() => {
    const h = parseFloat(form.height)
    const w = parseFloat(form.weight)
    if (h > 0 && w > 0) {
      const hm = h / 100
      const bmi = (w / (hm * hm)).toFixed(1)
      setForm(f => ({ ...f, bmi }))
    } else {
      setForm(f => ({ ...f, bmi: '' }))
    }
  }, [form.height, form.weight])

  // ✅ FIX: Save ALL fields to DB (including auto-calculated BMI)
  const save = async () => {
    setSaving(true)
    try {
      const payload = {
        name:  form.name,
        phone: form.phone,
        patientProfile: {
          address:           form.address,
          dateOfBirth:       form.dateOfBirth,
          bloodGroup:        form.bloodGroup,
          height:            form.height,
          weight:            form.weight,
          bmi:               form.bmi,        // ✅ auto-calculated BMI saved to DB
          conditions:        form.conditions,
          allergies:         form.allergies,
          emergencyContacts: form.emergencyContacts,
        },
        doctorProfile: {
          specialty:  form.specialty,
          department: form.department,
          experience: form.experience,
          regNumber:  form.regNumber,
        },
      }
      const res = await usersApi.updateProfile(payload)
      setProfile(res.data)
      setEditing(false)
    } catch (e) {
      alert(e.message || 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  const cancelEdit = () => {
    // Reset form to current profile values
    const p = profile?.patientProfile || {}
    const d = profile?.doctorProfile || {}
    setForm({
      name:    profile.name || '',
      phone:   profile.phone || '',
      address:           p.address || '',
      dateOfBirth:       p.dateOfBirth ? p.dateOfBirth.split('T')[0] : '',
      bloodGroup:        p.bloodGroup || '',
      height:            p.height || '',
      weight:            p.weight || '',
      conditions:        p.conditions || [],
      allergies:         p.allergies || [],
      emergencyContacts: p.emergencyContacts || [],
      specialty:   d.specialty || '',
      department:  d.department || '',
      experience:  d.experience || '',
      regNumber:   d.regNumber || '',
    })
    setEditing(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-brand-600" size={32}/>
    </div>
  )

  const p = profile?.patientProfile
  const d = profile?.doctorProfile

  return (
    <div className="p-6 max-w-[900px] mx-auto space-y-6">
      {/* Hero Card */}
      <div className="card p-6 mesh-bg">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <div className="relative">
            <div className={`w-24 h-24 rounded-2xl bg-gradient-to-br ${profile?.color||'from-brand-400 to-teal-500'} flex items-center justify-center text-white font-display font-bold text-3xl shadow-md`}>
              {profile?.initials}
            </div>
            <button className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl bg-white border border-[#e8effc] flex items-center justify-center text-brand-600 shadow-sm hover:bg-brand-50 transition-colors">
              <Camera size={14}/>
            </button>
          </div>
          <div className="flex-1 text-center sm:text-left">
            {editing ? (
              <input
                value={form.name}
                onChange={e => set('name', e.target.value)}
                className="input text-xl font-bold mb-2 max-w-xs"
                placeholder="Full name"
              />
            ) : (
              <h2 className="font-display font-bold text-2xl text-[#0f1f3d]">{profile?.name}</h2>
            )}
            <p className="text-[#9aaec4] text-sm mt-0.5">{profile?.subtitle}</p>
            <div className="flex flex-wrap gap-2 mt-3 justify-center sm:justify-start">
              <span className="badge badge-blue capitalize">{profile?.role}</span>
              <span className="badge badge-green"><Shield size={10} className="mr-1"/> Verified</span>
            </div>
          </div>
          {editing ? (
            <div className="flex gap-2">
              <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-1.5">
                {saving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Save
              </button>
              <button onClick={cancelEdit} className="btn-ghost border border-[#e8effc]"><X size={14}/></button>
            </div>
          ) : (
            <button onClick={() => setEditing(true)} className="btn-ghost border border-[#e8effc] bg-white/80 flex items-center gap-1.5">
              <Edit2 size={14}/> Edit Profile
            </button>
          )}
        </div>
      </div>

      {/* Medical metrics — patients only */}
      {p && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label:'Blood Group', key:'bloodGroup', color:'text-red-600 bg-red-50' },
            { label:'Height',      key:'height',     color:'text-brand-700 bg-brand-50' },
            { label:'Weight',      key:'weight',     color:'text-teal-700 bg-teal-50' },
            { label:'BMI',         key:'bmi',        color:'text-emerald-700 bg-emerald-50', readOnly: true },
          ].map(({ label, key, color, readOnly }) => (
            <div key={label} className={`card p-4 text-center ${color}`}>
              {editing && !readOnly ? (
                <input
                  value={form[key] || ''}
                  onChange={e => set(key, e.target.value)}
                  className="w-full text-center font-display font-bold text-xl bg-transparent border-b-2 border-current/30 focus:outline-none focus:border-current pb-0.5"
                  placeholder="—"
                />
              ) : (
                <p className="font-display font-bold text-xl">{(editing ? form[key] : p[key]) || '—'}</p>
              )}
              <p className="text-xs mt-1.5 opacity-70 font-medium">{label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Personal Info */}
        <div className="card p-5 space-y-4">
          <h3 className="font-display font-semibold text-[#0f1f3d]">Personal Information</h3>
          <div className="space-y-3">
            {/* Email — read only */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#f4f7ff] flex items-center justify-center shrink-0"><Mail size={14} className="text-brand-600"/></div>
              <div>
                <p className="text-[10px] text-[#9aaec4] uppercase tracking-wide font-semibold">Email</p>
                <p className="text-sm text-[#0f1f3d] font-medium">{profile?.email}</p>
              </div>
            </div>

            {/* Phone */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#f4f7ff] flex items-center justify-center shrink-0"><Phone size={14} className="text-brand-600"/></div>
              <div className="flex-1">
                <p className="text-[10px] text-[#9aaec4] uppercase tracking-wide font-semibold">Phone</p>
                {editing ? (
                  <input value={form.phone} onChange={e=>set('phone',e.target.value)} className="input text-sm py-1 mt-0.5" placeholder="+91 XXXXX XXXXX"/>
                ) : (
                  <p className="text-sm text-[#0f1f3d] font-medium">{profile?.phone || 'Not set'}</p>
                )}
              </div>
            </div>

            {/* Address / Department */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#f4f7ff] flex items-center justify-center shrink-0"><MapPin size={14} className="text-brand-600"/></div>
              <div className="flex-1">
                <p className="text-[10px] text-[#9aaec4] uppercase tracking-wide font-semibold">{p ? 'Address' : 'Department'}</p>
                {editing ? (
                  <input
                    value={p ? form.address : form.department}
                    onChange={e => set(p ? 'address' : 'department', e.target.value)}
                    className="input text-sm py-1 mt-0.5"
                    placeholder={p ? 'Your address' : 'Department'}
                  />
                ) : (
                  <p className="text-sm text-[#0f1f3d] font-medium">{p?.address || d?.department || 'Not set'}</p>
                )}
              </div>
            </div>

            {/* Date of Birth — patients only */}
            {(p || editing) && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#f4f7ff] flex items-center justify-center shrink-0"><Calendar size={14} className="text-brand-600"/></div>
                <div className="flex-1">
                  <p className="text-[10px] text-[#9aaec4] uppercase tracking-wide font-semibold">Date of Birth</p>
                  {editing ? (
                    <input type="date" value={form.dateOfBirth} onChange={e=>set('dateOfBirth',e.target.value)} className="input text-sm py-1 mt-0.5"/>
                  ) : (
                    <p className="text-sm text-[#0f1f3d] font-medium">
                      {p?.dateOfBirth ? new Date(p.dateOfBirth).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}) : 'Not set'}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {/* Conditions */}
          {(p || editing) && (
            <div className="card p-5">
              <h3 className="font-display font-semibold text-[#0f1f3d] mb-3 flex items-center gap-2">
                <Heart size={14} className="text-brand-500"/> Medical Conditions
              </h3>
              {editing ? (
                <TagInput
                  value={form.conditions}
                  onChange={v => set('conditions', v)}
                  placeholder="Type condition & press Enter"
                  colorClass="badge-blue"
                />
              ) : (
                <div className="space-y-2">
                  {(p?.conditions || []).length === 0
                    ? <p className="text-sm text-[#9aaec4]">No conditions on file</p>
                    : p.conditions.map(c => (
                        <div key={c} className="flex items-center gap-2 bg-[#f8faff] rounded-xl px-3 py-2">
                          <span className="w-2 h-2 rounded-full bg-brand-500 shrink-0"/>
                          <span className="text-sm text-[#5a6c8a]">{c}</span>
                        </div>
                      ))
                  }
                </div>
              )}
            </div>
          )}

          {/* Allergies */}
          {(p || editing) && (
            <div className="card p-5">
              <h3 className="font-display font-semibold text-[#0f1f3d] mb-3 flex items-center gap-2">
                <AlertTriangle size={14} className="text-amber-500"/> Known Allergies
              </h3>
              {editing ? (
                <TagInput
                  value={form.allergies}
                  onChange={v => set('allergies', v)}
                  placeholder="Type allergy & press Enter"
                  colorClass="badge-red"
                />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(p?.allergies || []).length === 0
                    ? <p className="text-sm text-[#9aaec4]">No allergies on file</p>
                    : p.allergies.map(a => <span key={a} className="badge badge-red text-xs">{a}</span>)
                  }
                </div>
              )}
            </div>
          )}

          {/* Doctor Profile */}
          {d && (
            <div className="card p-5">
              <h3 className="font-display font-semibold text-[#0f1f3d] mb-3">Doctor Profile</h3>
              {editing ? (
                <div className="space-y-2">
                  {[
                    { key:'specialty', label:'Specialty', placeholder:'e.g. Cardiologist' },
                    { key:'department', label:'Department', placeholder:'e.g. Cardiology' },
                    { key:'experience', label:'Experience', placeholder:'e.g. 12 years' },
                    { key:'regNumber', label:'Reg Number', placeholder:'Medical reg. no.' },
                  ].map(({ key, label, placeholder }) => (
                    <div key={key}>
                      <label className="text-[10px] text-[#9aaec4] uppercase tracking-wide font-semibold block mb-1">{label}</label>
                      <input value={form[key]} onChange={e=>set(key,e.target.value)} placeholder={placeholder} className="input text-sm"/>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2 text-sm text-[#5a6c8a]">
                  <p><span className="font-medium text-[#0f1f3d]">Specialty:</span> {d.specialty || 'Not set'}</p>
                  <p><span className="font-medium text-[#0f1f3d]">Department:</span> {d.department || 'Not set'}</p>
                  <p><span className="font-medium text-[#0f1f3d]">Experience:</span> {d.experience || 'Not set'}</p>
                  <p><span className="font-medium text-[#0f1f3d]">Reg No:</span> {d.regNumber || 'Not set'}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Emergency Contacts */}
      {(p || editing) && (
        <div className="card p-5">
          <h3 className="font-display font-semibold text-[#0f1f3d] mb-4">Emergency Contacts</h3>
          {editing ? (
            <EmergencyContactEditor
              contacts={form.emergencyContacts}
              onChange={v => set('emergencyContacts', v)}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(p?.emergencyContacts || []).length === 0
                ? <p className="text-sm text-[#9aaec4]">No emergency contacts on file</p>
                : p.emergencyContacts.map((ec, i) => (
                    <div key={i} className="flex items-center gap-3 bg-[#f8faff] rounded-xl px-4 py-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-300 to-teal-400 flex items-center justify-center text-white font-bold text-xs shrink-0">
                        {ec.name.split(' ').map(n=>n[0]).join('')}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#0f1f3d]">{ec.name}</p>
                        <p className="text-xs text-[#9aaec4]">{ec.relation} · {ec.phone}</p>
                      </div>
                    </div>
                  ))
              }
            </div>
          )}
        </div>
      )}

      {/* Save button — also at bottom for convenience on mobile */}
      {editing && (
        <div className="flex justify-end gap-3 pb-4">
          <button onClick={cancelEdit} className="btn-ghost border border-[#e8effc] flex items-center gap-1.5">
            <X size={14}/> Cancel
          </button>
          <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2">
            {saving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>}
            Save All Changes
          </button>
        </div>
      )}
    </div>
  )
}