import { useState, useEffect } from 'react'
import { usersApi } from '../services/api'
import { Search, User, Phone, Loader2, ChevronRight } from 'lucide-react'

export default function Patients() {
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const load = (q='') => {
    setLoading(true)
    usersApi.patients(q).then(res => setPatients(res.data)).catch(()=>{}).finally(()=>setLoading(false))
  }

  useEffect(() => { load() }, [])
  useEffect(() => { const t = setTimeout(()=>load(search), 350); return ()=>clearTimeout(t) }, [search])

  return (
    <div className="p-6 max-w-[1000px] mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <h2 className="font-display font-bold text-xl text-[#0f1f3d]">Patient Directory</h2>
          <p className="text-sm text-[#9aaec4] mt-0.5">{patients.length} registered patients</p>
        </div>
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9aaec4]"/>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name, phone, email…" className="input pl-9"/>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-brand-600" size={28}/></div>
      ) : (
        <div className="space-y-3 stagger">
          {patients.length===0 && <div className="card p-10 text-center text-[#9aaec4]">No patients found.</div>}
          {patients.map(p => (
            <div key={p.id} className="card p-4 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer group animate-slide-up opacity-0" style={{animationFillMode:'forwards'}}>
              <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${p.color||'from-brand-400 to-teal-500'} flex items-center justify-center text-white font-bold text-sm shrink-0`}>{p.initials}</div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[#0f1f3d] group-hover:text-brand-700 transition-colors">{p.name}</p>
                <p className="text-xs text-[#9aaec4] mt-0.5">{p.condition || 'No conditions on file'}</p>
              </div>
              <div className="hidden sm:flex items-center gap-4 text-xs text-[#9aaec4]">
                {p.age && <span>{p.age} yrs</span>}
                {p.bloodGroup && <span className="badge badge-red">{p.bloodGroup}</span>}
                {p.phone && <span className="flex items-center gap-1"><Phone size={11}/>{p.phone}</span>}
              </div>
              <span className="badge badge-green text-xs">{p.status}</span>
              <ChevronRight size={15} className="text-[#c5d2e8] group-hover:text-brand-400 transition-colors shrink-0"/>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
