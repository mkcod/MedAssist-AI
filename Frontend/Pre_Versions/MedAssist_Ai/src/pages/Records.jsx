import { useState } from 'react'
import { FileText, Download, Search, Filter, Eye, FlaskConical, Scan, Stethoscope, Pill, ChevronRight } from 'lucide-react'

const categories = ['All', 'Lab Results', 'Imaging', 'Consultations', 'Prescriptions']

const records = [
  { id:1, type:'Lab Results',     title:'Complete Blood Count (CBC)',         date:'Apr 10, 2026', doctor:'Dr. Amit Sharma',  status:'Normal',   category:'Lab Results',    icon: FlaskConical, color:'bg-blue-50 text-blue-600' },
  { id:2, type:'Lab Results',     title:'HbA1c Blood Sugar Test',             date:'Apr 5, 2026',  doctor:'Dr. Sunita Rao',   status:'Elevated', category:'Lab Results',    icon: FlaskConical, color:'bg-blue-50 text-blue-600' },
  { id:3, type:'Imaging',         title:'Chest X-Ray',                        date:'Mar 28, 2026', doctor:'Dr. Vikram Mehta', status:'Normal',   category:'Imaging',        icon: Scan,         color:'bg-purple-50 text-purple-600' },
  { id:4, type:'Consultations',   title:'Cardiology Follow-up Notes',         date:'Mar 15, 2026', doctor:'Dr. Priya Nair',   status:'Reviewed', category:'Consultations',  icon: Stethoscope,  color:'bg-pink-50 text-pink-600' },
  { id:5, type:'Lab Results',     title:'Lipid Panel (Cholesterol)',           date:'Mar 8, 2026',  doctor:'Dr. Amit Sharma',  status:'Normal',   category:'Lab Results',    icon: FlaskConical, color:'bg-blue-50 text-blue-600' },
  { id:6, type:'Prescriptions',   title:'Metformin 500mg — Prescription',     date:'Feb 20, 2026', doctor:'Dr. Sunita Rao',   status:'Active',   category:'Prescriptions',  icon: Pill,         color:'bg-teal-50 text-teal-600' },
  { id:7, type:'Imaging',         title:'ECG / Electrocardiogram',            date:'Feb 12, 2026', doctor:'Dr. Priya Nair',   status:'Normal',   category:'Imaging',        icon: Scan,         color:'bg-purple-50 text-purple-600' },
  { id:8, type:'Consultations',   title:'Annual Physical Exam Summary',       date:'Jan 15, 2026', doctor:'Dr. Amit Sharma',  status:'Reviewed', category:'Consultations',  icon: Stethoscope,  color:'bg-pink-50 text-pink-600' },
]

const statusBadge = {
  Normal:   'badge-green',
  Elevated: 'badge-orange',
  Reviewed: 'badge-blue',
  Active:   'badge-green',
}

export default function Records() {
  const [search, setSearch] = useState('')
  const [cat, setCat] = useState('All')

  const filtered = records.filter(r => {
    const matchCat = cat === 'All' || r.category === cat
    const matchSearch = r.title.toLowerCase().includes(search.toLowerCase()) ||
                        r.doctor.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  return (
    <div className="p-6 max-w-[1000px] mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h2 className="font-display font-bold text-xl text-[#0f1f3d]">Medical Records</h2>
          <p className="text-sm text-[#9aaec4] mt-0.5">Your complete health history — encrypted & secure</p>
        </div>
        <div className="sm:ml-auto flex items-center gap-2">
          <div className="badge badge-green text-xs"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block mr-1.5" />HIPAA Protected</div>
        </div>
      </div>

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9aaec4]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search records, doctors…"
            className="input pl-9"
          />
        </div>
        <button className="btn-ghost border border-[#e8effc] bg-white">
          <Filter size={15} /> Filter
        </button>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 flex-wrap">
        {categories.map(c => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              cat === c ? 'bg-brand-700 text-white shadow-sm' : 'bg-white border border-[#e8effc] text-[#5a6c8a] hover:border-brand-200 hover:text-brand-700'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Records list */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="card p-10 text-center text-[#9aaec4] text-sm">No records found.</div>
        )}
        {filtered.map(r => {
          const Icon = r.icon
          return (
            <div key={r.id} className="card p-4 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer group">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${r.color}`}>
                <Icon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[#0f1f3d] text-sm truncate group-hover:text-brand-700 transition-colors">{r.title}</p>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-[#9aaec4]">
                  <span>{r.date}</span>
                  <span>·</span>
                  <span>{r.doctor}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className={`badge ${statusBadge[r.status] || 'badge-blue'}`}>{r.status}</span>
                <div className="flex gap-1">
                  <button className="w-8 h-8 rounded-lg flex items-center justify-center text-[#9aaec4] hover:bg-brand-50 hover:text-brand-600 transition-colors" title="View">
                    <Eye size={15} />
                  </button>
                  <button className="w-8 h-8 rounded-lg flex items-center justify-center text-[#9aaec4] hover:bg-brand-50 hover:text-brand-600 transition-colors" title="Download">
                    <Download size={15} />
                  </button>
                </div>
                <ChevronRight size={15} className="text-[#c5d2e8] group-hover:text-brand-400 transition-colors" />
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-center text-[11px] text-[#c5d2e8]">
        Showing {filtered.length} of {records.length} records · All data is AES-256 encrypted
      </p>
    </div>
  )
}
