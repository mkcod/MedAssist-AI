import { useState } from 'react'
import { FileText, Download, Search, Filter, Eye, FlaskConical, Scan, Stethoscope, Pill, ChevronRight, Upload, X } from 'lucide-react'
import Modal from '../components/Modal'
import { INITIAL_RECORDS } from '../data/store'
import { useAuth } from '../contexts/AuthContext'
import { ROLES } from '../contexts/AuthContext'

const categories = ['All', 'Lab Results', 'Imaging', 'Consultations', 'Prescriptions']
const iconMap = { 'Lab Results': FlaskConical, Imaging: Scan, Consultations: Stethoscope, Prescriptions: Pill }
const colorMap = { 'Lab Results':'bg-blue-50 text-blue-600', Imaging:'bg-purple-50 text-purple-600', Consultations:'bg-pink-50 text-pink-600', Prescriptions:'bg-teal-50 text-teal-600' }
const statusBadge = { Normal:'badge-green', Elevated:'badge-orange', Reviewed:'badge-blue', Active:'badge-green', Abnormal:'badge-red' }

export default function Records() {
  const { user } = useAuth()
  const [records, setRecords] = useState(INITIAL_RECORDS)
  const [search, setSearch] = useState('')
  const [cat, setCat] = useState('All')
  const [viewRecord, setViewRecord] = useState(null)
  const [uploadOpen, setUploadOpen] = useState(false)

  const filtered = records.filter(r => {
    const matchCat = cat === 'All' || r.category === cat
    const matchSearch = r.title.toLowerCase().includes(search.toLowerCase()) ||
                        r.doctor.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  const handleDownload = (e, r) => {
    e.stopPropagation()
    const content = `MEDICAL RECORD\n\nTitle: ${r.title}\nDate: ${r.date}\nDoctor: ${r.doctor}\nStatus: ${r.status}\nCategory: ${r.category}\n\nDetails:\n${r.details}`
    const blob = new Blob([content], {type:'text/plain'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${r.title.replace(/[^a-z0-9]/gi,'_')}.txt`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 max-w-[1000px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h2 className="font-display font-bold text-xl text-[#0f1f3d]">Medical Records</h2>
          <p className="text-sm text-[#9aaec4] mt-0.5">
            {user?.role === ROLES.PATIENT ? 'Your complete health history — encrypted & secure' : 'Patient medical records'}
          </p>
        </div>
        <div className="sm:ml-auto flex items-center gap-2">
          <div className="badge badge-green text-xs"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block mr-1.5"/>HIPAA Protected</div>
          {(user?.role === ROLES.DOCTOR || user?.role === ROLES.RECEPTIONIST) && (
            <button onClick={() => setUploadOpen(true)} className="btn-primary text-xs py-2"><Upload size={14}/> Upload</button>
          )}
        </div>
      </div>

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9aaec4]"/>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search records, doctors…" className="input pl-9"/>
        </div>
        <button className="btn-ghost border border-[#e8effc] bg-white"><Filter size={15}/> Filter</button>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 flex-wrap">
        {categories.map(c => (
          <button key={c} onClick={() => setCat(c)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${cat===c?'bg-brand-700 text-white shadow-sm':'bg-white border border-[#e8effc] text-[#5a6c8a] hover:border-brand-200 hover:text-brand-700'}`}>
            {c}
            <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${cat===c?'bg-white/20 text-white':'bg-[#f4f7ff] text-[#9aaec4]'}`}>
              {records.filter(r => c==='All' || r.category===c).length}
            </span>
          </button>
        ))}
      </div>

      {/* Records list */}
      <div className="space-y-3">
        {filtered.length === 0 && <div className="card p-10 text-center text-[#9aaec4] text-sm">No records found.</div>}
        {filtered.map(r => {
          const Icon = iconMap[r.category] || FileText
          const colorClass = colorMap[r.category] || 'bg-gray-50 text-gray-600'
          return (
            <div key={r.id} onClick={() => setViewRecord(r)}
              className="card p-4 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer group">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${colorClass}`}><Icon size={18}/></div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[#0f1f3d] text-sm truncate group-hover:text-brand-700 transition-colors">{r.title}</p>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-[#9aaec4]">
                  <span>{r.date}</span><span>·</span><span>{r.doctor}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className={`badge ${statusBadge[r.status]||'badge-blue'}`}>{r.status}</span>
                <div className="flex gap-1">
                  <button onClick={e => { e.stopPropagation(); setViewRecord(r) }}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-[#9aaec4] hover:bg-brand-50 hover:text-brand-600 transition-colors" title="View">
                    <Eye size={15}/>
                  </button>
                  <button onClick={e => handleDownload(e, r)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-[#9aaec4] hover:bg-brand-50 hover:text-brand-600 transition-colors" title="Download">
                    <Download size={15}/>
                  </button>
                </div>
                <ChevronRight size={15} className="text-[#c5d2e8] group-hover:text-brand-400 transition-colors"/>
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-center text-[11px] text-[#c5d2e8]">
        Showing {filtered.length} of {records.length} records · All data is AES-256 encrypted
      </p>

      {/* View Record Modal */}
      <Modal open={!!viewRecord} onClose={() => setViewRecord(null)} title="Record Details" size="lg">
        {viewRecord && (() => {
          const Icon = iconMap[viewRecord.category] || FileText
          const colorClass = colorMap[viewRecord.category] || 'bg-gray-50 text-gray-600'
          return (
            <div className="space-y-5">
              <div className="flex items-start gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${colorClass} shrink-0`}><Icon size={24}/></div>
                <div>
                  <h4 className="font-display font-semibold text-[#0f1f3d] text-lg">{viewRecord.title}</h4>
                  <p className="text-sm text-[#9aaec4]">{viewRecord.category}</p>
                </div>
                <span className={`badge ${statusBadge[viewRecord.status]||'badge-blue'} ml-auto`}>{viewRecord.status}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[{l:'Date',v:viewRecord.date},{l:'Doctor',v:viewRecord.doctor},{l:'Category',v:viewRecord.category},{l:'Patient',v:'Rahul Kumar'}].map(f => (
                  <div key={f.l} className="bg-[#f8faff] rounded-xl p-3">
                    <p className="text-[10px] text-[#9aaec4] uppercase tracking-wide font-semibold">{f.l}</p>
                    <p className="text-sm font-semibold text-[#0f1f3d] mt-0.5">{f.v}</p>
                  </div>
                ))}
              </div>

              <div className="bg-[#f8faff] rounded-xl p-4">
                <p className="text-[10px] text-[#9aaec4] uppercase tracking-wide font-semibold mb-2">Clinical Notes</p>
                <p className="text-sm text-[#5a6c8a] leading-relaxed">{viewRecord.details}</p>
              </div>

              <div className="flex gap-3">
                <button onClick={(e) => { handleDownload(e, viewRecord); setViewRecord(null) }} className="btn-primary flex-1 justify-center">
                  <Download size={15}/> Download Report
                </button>
                <button onClick={() => setViewRecord(null)} className="btn-ghost border border-[#e8effc] flex-1 justify-center">Close</button>
              </div>
            </div>
          )
        })()}
      </Modal>

      {/* Upload Modal */}
      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title="Upload Medical Record" size="md">
        <UploadForm onUpload={(rec) => {
          setRecords(prev => [rec, ...prev])
          setUploadOpen(false)
        }} onClose={() => setUploadOpen(false)}/>
      </Modal>
    </div>
  )
}

function UploadForm({ onUpload, onClose }) {
  const [form, setForm] = useState({ title:'', category:'Lab Results', doctor:'', status:'Normal', details:'' })
  const set = (k,v) => setForm(p => ({...p, [k]:v}))

  const handleSubmit = () => {
    if (!form.title || !form.doctor) return
    onUpload({
      id: Date.now(), patientId:'P001', type: form.category,
      title: form.title, date: 'Apr 15, 2026', doctor: form.doctor,
      status: form.status, category: form.category, details: form.details || 'No additional details.'
    })
  }

  return (
    <div className="space-y-4">
      <div><label className="text-xs font-semibold text-[#5a6c8a] uppercase tracking-wide block mb-1.5">Record Title *</label>
        <input value={form.title} onChange={e => set('title',e.target.value)} placeholder="e.g. Blood Test Report" className="input"/></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-xs font-semibold text-[#5a6c8a] uppercase tracking-wide block mb-1.5">Category</label>
          <select value={form.category} onChange={e => set('category',e.target.value)} className="input">
            {['Lab Results','Imaging','Consultations','Prescriptions'].map(c => <option key={c}>{c}</option>)}
          </select></div>
        <div><label className="text-xs font-semibold text-[#5a6c8a] uppercase tracking-wide block mb-1.5">Status</label>
          <select value={form.status} onChange={e => set('status',e.target.value)} className="input">
            {['Normal','Elevated','Abnormal','Reviewed','Active'].map(s => <option key={s}>{s}</option>)}
          </select></div>
      </div>
      <div><label className="text-xs font-semibold text-[#5a6c8a] uppercase tracking-wide block mb-1.5">Doctor *</label>
        <input value={form.doctor} onChange={e => set('doctor',e.target.value)} placeholder="e.g. Dr. Amit Sharma" className="input"/></div>
      <div><label className="text-xs font-semibold text-[#5a6c8a] uppercase tracking-wide block mb-1.5">Notes</label>
        <textarea value={form.details} onChange={e => set('details',e.target.value)} rows={3} className="input resize-none" placeholder="Clinical notes or details…"/></div>
      <div className="flex gap-3">
        <button onClick={onClose} className="btn-ghost border border-[#e8effc] flex-1 justify-center">Cancel</button>
        <button onClick={handleSubmit} disabled={!form.title || !form.doctor} className="btn-primary flex-1 justify-center disabled:opacity-40">Upload Record</button>
      </div>
    </div>
  )
}
