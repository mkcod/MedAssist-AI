import { useState, useEffect } from 'react'
import { recordsApi } from '../services/api'
import { useSocket } from '../contexts/SocketContext'
import {
  FileText, Download, Search, Eye, FlaskConical, Scan,
  Stethoscope, Pill, Loader2, X, Calendar, User, Tag,
  CheckCircle, AlertCircle, Clock
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const categories = ['All', 'Lab Results', 'Imaging', 'Consultations', 'Prescriptions']
const iconMap  = { 'Lab Results': FlaskConical, 'Imaging': Scan, 'Consultations': Stethoscope, 'Prescriptions': Pill }
const colorMap = { 'Lab Results': 'bg-blue-50 text-blue-600', 'Imaging': 'bg-purple-50 text-purple-600', 'Consultations': 'bg-pink-50 text-pink-600', 'Prescriptions': 'bg-teal-50 text-teal-600' }
const statusBadge = { Normal: 'badge-green', Elevated: 'badge-orange', Reviewed: 'badge-blue', Active: 'badge-green', Pending: 'badge-orange' }

// ─── Record View Modal ────────────────────────────────────────────────────────
function RecordViewModal({ record, onClose, onDownload, downloading }) {
  if (!record) return null

  const Icon = iconMap[record.type] || FileText
  const iconColor = colorMap[record.type] || 'bg-gray-50 text-gray-600'

  // Close on backdrop click
  const handleBackdrop = (e) => { if (e.target === e.currentTarget) onClose() }

  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const statusColor = {
    Normal:   'bg-emerald-50 text-emerald-700 border-emerald-200',
    Elevated: 'bg-amber-50 text-amber-700 border-amber-200',
    Reviewed: 'bg-blue-50 text-blue-700 border-blue-200',
    Active:   'bg-emerald-50 text-emerald-700 border-emerald-200',
    Pending:  'bg-amber-50 text-amber-700 border-amber-200',
  }[record.status] || 'bg-gray-50 text-gray-600 border-gray-200'

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={handleBackdrop}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-[#e8effc] w-full max-w-lg max-h-[90vh] flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-start gap-4 p-5 border-b border-[#f0f4ff]">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${iconColor}`}>
            <Icon size={22}/>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-bold text-[#0f1f3d] text-base leading-snug">{record.title}</h3>
            <p className="text-xs text-[#9aaec4] mt-0.5">{record.type}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-[#9aaec4] hover:bg-[#f4f7ff] hover:text-[#5a6c8a] transition-colors shrink-0"
          >
            <X size={16}/>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Status + Date row */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${statusColor}`}>
              {record.status === 'Normal' || record.status === 'Active' || record.status === 'Reviewed'
                ? <CheckCircle size={11}/>
                : <AlertCircle size={11}/>}
              {record.status}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-[#9aaec4]">
              <Calendar size={12}/>
              {new Date(record.date).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}
            </span>
          </div>

          {/* Doctor */}
          {record.doctorName && (
            <div className="flex items-center gap-3 bg-[#f8faff] rounded-xl px-4 py-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-teal-500 flex items-center justify-center text-white font-bold text-xs shrink-0">
                {record.doctorName.split(' ').map(n=>n[0]).join('').slice(0,2)}
              </div>
              <div>
                <p className="text-[10px] text-[#9aaec4] uppercase tracking-wide font-semibold">Attending Physician</p>
                <p className="text-sm font-semibold text-[#0f1f3d]">{record.doctorName}</p>
              </div>
            </div>
          )}

          {/* Description / Notes */}
          {record.description && (
            <div>
              <p className="text-[10px] text-[#9aaec4] uppercase tracking-widest font-bold mb-2">Description</p>
              <p className="text-sm text-[#374151] leading-relaxed bg-[#f8faff] rounded-xl p-4 border border-[#e8effc] whitespace-pre-wrap">
                {record.description}
              </p>
            </div>
          )}

          {/* Lab values — if present */}
          {record.results && record.results.length > 0 && (
            <div>
              <p className="text-[10px] text-[#9aaec4] uppercase tracking-widest font-bold mb-2">Results</p>
              <div className="space-y-2">
                {record.results.map((r, i) => (
                  <div key={i} className="flex items-center justify-between bg-[#f8faff] rounded-xl px-4 py-2.5 border border-[#e8effc]">
                    <span className="text-sm text-[#374151] font-medium">{r.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[#0f1f3d]">{r.value}</span>
                      {r.unit && <span className="text-xs text-[#9aaec4]">{r.unit}</span>}
                      {r.flag && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${r.flag==='H'?'bg-red-100 text-red-600':r.flag==='L'?'bg-blue-100 text-blue-600':'bg-gray-100 text-gray-500'}`}>{r.flag}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {record.tags?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {record.tags.map((t,i) => (
                <span key={i} className="flex items-center gap-1 text-[10px] font-medium px-2.5 py-1 rounded-full bg-[#f0f4ff] text-[#5a6c8a] border border-[#e8effc]">
                  <Tag size={9}/>{t}
                </span>
              ))}
            </div>
          )}

          {/* Notes */}
          {record.notes && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
              <p className="text-[10px] text-amber-600 uppercase tracking-wide font-bold mb-1">Notes</p>
              <p className="text-sm text-amber-800 leading-relaxed">{record.notes}</p>
            </div>
          )}

          {/* No description fallback */}
          {!record.description && !record.notes && (!record.results || record.results.length === 0) && (
            <div className="text-center py-6 text-[#9aaec4] text-sm">
              No additional details available for this record.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#f0f4ff] flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-[10px] text-[#c5d2e8]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"/>
            AES-256 Encrypted
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-xl border border-[#e8effc] text-sm font-semibold text-[#5a6c8a] hover:bg-[#f8faff] transition-colors">
              Close
            </button>
            {record.attachment?.blobName && (
              <button
                onClick={() => onDownload(record)}
                disabled={downloading === record._id}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-700 text-white text-sm font-semibold hover:bg-brand-800 transition-colors disabled:opacity-60"
              >
                {downloading === record._id
                  ? <Loader2 size={14} className="animate-spin"/>
                  : <Download size={14}/>}
                Download
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Records() {
  const { user } = useAuth()
  const { on } = useSocket()
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [cat, setCat] = useState('All')
  const [downloading, setDownloading] = useState(null)
  // ✅ NEW: view modal state
  const [viewRecord, setViewRecord] = useState(null)

  const load = (params = {}) =>
    recordsApi.list(params).then(res => setRecords(res.data)).catch(() => {}).finally(() => setLoading(false))

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (!on) return
    return on('record:created', () => load())
  }, [on])

  useEffect(() => {
    const params = {}
    if (cat !== 'All') params.category = cat
    if (search) params.search = search
    load(params)
  }, [cat, search])

  const handleDownload = async (record) => {
    if (!record.attachment?.blobName) return
    setDownloading(record._id)
    try {
      const res = await recordsApi.download(record._id)
      const a = document.createElement('a')
      a.href = res.url
      a.download = res.filename || 'record'
      a.click()
    } catch (e) {
      alert('Download failed: ' + e.message)
    } finally {
      setDownloading(null)
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-brand-600" size={32}/></div>

  return (
    <div className="p-6 max-w-[1000px] mx-auto space-y-6">
      {/* ✅ View Modal */}
      {viewRecord && (
        <RecordViewModal
          record={viewRecord}
          onClose={() => setViewRecord(null)}
          onDownload={handleDownload}
          downloading={downloading}
        />
      )}

      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <h2 className="font-display font-bold text-xl text-[#0f1f3d]">Medical Records</h2>
          <p className="text-sm text-[#9aaec4] mt-0.5">Your complete health history — encrypted & secure</p>
        </div>
        <div className="badge badge-green text-xs"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block mr-1.5"/>HIPAA Protected</div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9aaec4]"/>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search records, doctors…" className="input pl-9"/>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {categories.map(c => (
          <button key={c} onClick={() => setCat(c)} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${cat===c?'bg-brand-700 text-white shadow-sm':'bg-white border border-[#e8effc] text-[#5a6c8a] hover:border-brand-200 hover:text-brand-700'}`}>{c}</button>
        ))}
      </div>

      <div className="space-y-3">
        {records.length === 0 && <div className="card p-10 text-center text-[#9aaec4] text-sm">No records found.</div>}
        {records.map(r => {
          const Icon = iconMap[r.type] || FileText
          const iconColor = colorMap[r.type] || 'bg-gray-50 text-gray-600'
          return (
            <div
              key={r._id}
              className="card p-4 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer group"
              onClick={() => setViewRecord(r)}   // ✅ clicking the row also opens modal
            >
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${iconColor}`}><Icon size={18}/></div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[#0f1f3d] text-sm truncate group-hover:text-brand-700 transition-colors">{r.title}</p>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-[#9aaec4]">
                  <span>{new Date(r.date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span>
                  <span>·</span><span>{r.doctorName}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className={`badge ${statusBadge[r.status]||'badge-blue'}`}>{r.status}</span>
                <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                  {/* ✅ FIX: Eye button opens modal popup */}
                  <button
                    onClick={() => setViewRecord(r)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-[#9aaec4] hover:bg-brand-50 hover:text-brand-600 transition-colors"
                    title="View details"
                  >
                    <Eye size={15}/>
                  </button>
                  {r.attachment?.blobName && (
                    <button
                      onClick={() => handleDownload(r)}
                      disabled={downloading===r._id}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[#9aaec4] hover:bg-brand-50 hover:text-brand-600 transition-colors"
                      title="Download"
                    >
                      {downloading===r._id?<Loader2 size={15} className="animate-spin"/>:<Download size={15}/>}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <p className="text-center text-[11px] text-[#c5d2e8]">Showing {records.length} records · All data is AES-256 encrypted</p>
    </div>
  )
}
