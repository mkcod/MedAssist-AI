import { useState, useEffect, useCallback } from 'react'
import { sopApi } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { useSocket } from '../contexts/SocketContext'
import {
  FileText, CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp,
  Edit3, Trash2, Loader2, AlertCircle, RefreshCw, User, Stethoscope,
  Activity, Shield, Calendar, Tag, Save, X
} from 'lucide-react'

// ─── Status badge ──────────────────────────────────────────────────────────────
const fmtDoctor = (name) => {
  if (!name || name === 'your doctor') return 'your doctor'
  const t = name.trim()
  return /^Dr\.?\s/i.test(t) ? t : `Dr. ${t}`
}

function StatusBadge({ status }) {
  const cfg = {
    pending:  { bg: 'bg-amber-50',   text: 'text-amber-700',  border: 'border-amber-200', dot: 'bg-amber-400', label: 'Pending Approval', icon: Clock },
    approved: { bg: 'bg-emerald-50', text: 'text-emerald-700',border: 'border-emerald-200',dot: 'bg-emerald-500',label: 'Approved',         icon: CheckCircle2 },
    rejected: { bg: 'bg-red-50',     text: 'text-red-700',    border: 'border-red-200',   dot: 'bg-red-400',   label: 'Rejected',          icon: XCircle },
  }[status] || {}
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <Icon size={11} />
      {cfg.label}
    </span>
  )
}

// ─── SOAP section ──────────────────────────────────────────────────────────────
function SOAPSection({ label, value, color = '#0f1f3d' }) {
  if (!value) return null
  return (
    <div className="mb-4">
      <p className="text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color }}>{label}</p>
      <p className="text-sm text-[#374151] leading-relaxed bg-[#f8faff] rounded-xl p-3 border border-[#e8effc] whitespace-pre-line">{value}</p>
    </div>
  )
}

// ─── Editable SOAP form ────────────────────────────────────────────────────────
function EditSOAPForm({ sop, onSave, onCancel }) {
  const [form, setForm] = useState({
    subjective:  sop.soapData?.subjective  || '',
    objective:   sop.soapData?.objective   || '',
    assessment:  sop.soapData?.assessment  || '',
    plan:        sop.soapData?.plan        || '',
    doctorNote:  sop.doctorNote            || '',
  })
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    await onSave({ soapData: form, doctorNote: form.doctorNote })
    setSaving(false)
  }

  return (
    <div className="space-y-3 pt-3 border-t border-[#e8effc]">
      {[
        { key: 'subjective', label: 'Subjective (Patient\'s complaint)' },
        { key: 'objective',  label: 'Objective (Examination findings)' },
        { key: 'assessment', label: 'Assessment (Diagnosis)' },
        { key: 'plan',       label: 'Plan (Treatment)' },
        { key: 'doctorNote', label: 'Doctor\'s Note' },
      ].map(({ key, label }) => (
        <div key={key}>
          <label className="text-xs font-semibold text-[#5a6c8a] uppercase tracking-wide block mb-1">{label}</label>
          <textarea
            value={form[key]}
            onChange={e => set(key, e.target.value)}
            rows={key === 'doctorNote' ? 2 : 3}
            className="w-full rounded-xl border border-[#e8effc] bg-white px-3 py-2 text-sm text-[#0f1f3d] focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
          />
        </div>
      ))}
      <div className="flex gap-2 justify-end pt-1">
        <button onClick={onCancel} className="px-4 py-2 rounded-xl border border-[#e8effc] text-sm font-semibold text-[#5a6c8a] hover:bg-[#f8faff] transition-colors">
          Cancel
        </button>
        <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-xl bg-brand-700 text-white text-sm font-semibold hover:bg-brand-800 transition-colors flex items-center gap-2 disabled:opacity-60">
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save Changes
        </button>
      </div>
    </div>
  )
}

// ─── SOP Card ──────────────────────────────────────────────────────────────────
function SOPCard({ sop, isDoctor, onRefresh }) {
  const [expanded, setExpanded]   = useState(false)
  const [editing, setEditing]     = useState(false)
  const [actionLoading, setActL]  = useState(null)
  const [rejectNote, setRejectNote] = useState('')
  const [showReject, setShowReject] = useState(false)

  const patient = sop.patientId
  const doctor  = sop.doctorId
  const soap    = sop.soapData || {}
  const icd10Code = soap.icd10Code || soap.icd10_code || 'N/A'

  const handleApprove = async () => {
    setActL('approve')
    try { await sopApi.approve(sop._id, ''); onRefresh() }
    catch (_) {}
    setActL(null)
  }

  const handleReject = async () => {
    setActL('reject')
    try { await sopApi.reject(sop._id, rejectNote); setShowReject(false); onRefresh() }
    catch (_) {}
    setActL(null)
  }

  const handleDelete = async () => {
    if (!confirm('Delete this SOAP record permanently?')) return
    setActL('delete')
    try { await sopApi.delete(sop._id); onRefresh() }
    catch (_) {}
    setActL(null)
  }

  const handleSaveEdit = async (data) => {
    await sopApi.update(sop._id, data)
    setEditing(false)
    onRefresh()
  }

  return (
    <div className="bg-white rounded-2xl border border-[#e8effc] shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md">
      {/* Card header — click anywhere to expand/collapse */}
      <div
        className="px-5 py-4 flex items-start gap-4 cursor-pointer select-none"
        onClick={() => { setExpanded(e => !e); setEditing(false) }}
      >
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shrink-0 shadow-sm">
          <FileText size={16} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-display font-semibold text-[#0f1f3d] text-sm">
                  {soap.possibleCondition || 'Clinical Consultation'}
                </p>
                <StatusBadge status={sop.status} />
              </div>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {patient && (
                  <span className="flex items-center gap-1 text-xs text-[#9aaec4]">
                    <User size={10} /> {patient.name}
                  </span>
                )}
                {doctor && (
                  <span className="flex items-center gap-1 text-xs text-[#9aaec4]">
                    <Stethoscope size={10} /> {fmtDoctor(doctor.name)}
                  </span>
                )}
                <span className="flex items-center gap-1 text-xs text-[#9aaec4]">
                  <Calendar size={10} /> {new Date(sop.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                </span>
                <span className="flex items-center gap-1 text-xs text-brand-600 font-mono bg-brand-50 px-2 py-0.5 rounded-full">
                  <Tag size={15} /> ICD Code: {icd10Code}
                </span>
              </div>
            </div>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[#9aaec4] pointer-events-none shrink-0">
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </div>

          {/* Symptoms chips */}
          {soap.symptoms?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {soap.symptoms.map((s, i) => (
                <span key={i} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#f0f4ff] text-[#5a6c8a] border border-[#e8effc]">
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-[#f0f4ff]">
          <div className="pt-4">
            {!editing ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                  <SOAPSection label="Subjective" value={soap.subjective} color="#7c3aed" />
                  <SOAPSection label="Objective"  value={soap.objective}  color="#2563eb" />
                  <SOAPSection label="Assessment" value={soap.assessment} color="#0891b2" />
                  <SOAPSection label="Plan"       value={soap.plan}       color="#059669" />
                </div>

                {sop.doctorNote && (
                  <div className="mt-2 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                    <p className="text-xs font-bold text-amber-700 mb-1">Doctor's Note</p>
                    <p className="text-sm text-amber-800">{sop.doctorNote}</p>
                  </div>
                )}

                {soap.confidenceScore && (
                  <div className="mt-3 flex items-center gap-2">
                    <Activity size={12} className="text-[#9aaec4]" />
                    <span className="text-xs text-[#9aaec4]">AI Confidence:</span>
                    <div className="flex-1 h-1.5 bg-[#e8effc] rounded-full max-w-[120px]">
                      <div className="h-full bg-brand-500 rounded-full" style={{ width: `${Math.min(100, Math.round(soap.confidenceScore > 1 ? soap.confidenceScore : soap.confidenceScore * 100))}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-brand-600">{Math.min(100, Math.round(soap.confidenceScore > 1 ? soap.confidenceScore : soap.confidenceScore * 100))}%</span>
                  </div>
                )}
              </>
            ) : (
              <EditSOAPForm sop={sop} onSave={handleSaveEdit} onCancel={() => setEditing(false)} />
            )}
          </div>

          {/* Doctor actions */}
          {isDoctor && !editing && (
            <div className="mt-4 flex flex-wrap gap-2 pt-4 border-t border-[#f0f4ff]">
              {sop.status !== 'approved' && (
                <button
                  onClick={handleApprove}
                  disabled={!!actionLoading}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-60"
                >
                  {actionLoading === 'approve' ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                  Approve
                </button>
              )}

              {sop.status !== 'rejected' && (
                <button
                  onClick={() => setShowReject(r => !r)}
                  disabled={!!actionLoading}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 text-red-600 border border-red-200 text-xs font-semibold hover:bg-red-100 transition-colors disabled:opacity-60"
                >
                  <XCircle size={12} /> Reject
                </button>
              )}

              <button
                onClick={() => setEditing(true)}
                disabled={!!actionLoading || sop.status === 'approved'}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#f4f7ff] text-brand-600 border border-[#e8effc] text-xs font-semibold hover:bg-brand-50 transition-colors disabled:opacity-60"
              >
                <Edit3 size={12} /> Edit
              </button>

              <button
                onClick={handleDelete}
                disabled={!!actionLoading}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-red-400 border border-[#e8effc] text-xs font-semibold hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition-colors disabled:opacity-60 ml-auto"
              >
                {actionLoading === 'delete' ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                Delete
              </button>
            </div>
          )}

          {/* Reject note input */}
          {showReject && (
            <div className="mt-3 space-y-2">
              <textarea
                value={rejectNote}
                onChange={e => setRejectNote(e.target.value)}
                placeholder="Reason for rejection (optional)…"
                rows={2}
                className="w-full rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-[#0f1f3d] focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
              />
              <div className="flex gap-2">
                <button onClick={handleReject} disabled={actionLoading === 'reject'} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-60">
                  {actionLoading === 'reject' ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />} Confirm Reject
                </button>
                <button onClick={() => setShowReject(false)} className="px-3 py-2 rounded-xl text-xs font-semibold text-[#5a6c8a] border border-[#e8effc] hover:bg-[#f8faff]">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main SOP Page ─────────────────────────────────────────────────────────────
export default function SOPPage() {
  const { user } = useAuth()
  const { on }   = useSocket()
  const isDoctor = user?.role === 'doctor'

  const [sops, setSops]     = useState([])
  const [loading, setLoad]  = useState(true)
  const [error, setError]   = useState('')
  const [filter, setFilter] = useState('all')   // all | pending | approved | rejected

  const load = useCallback(async () => {
    setLoad(true); setError('')
    try {
      const res = await sopApi.list()
      setSops(res.data || [])
    } catch (err) {
      setError(err.message || 'Failed to load SOAP records')
    } finally {
      setLoad(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Real-time refresh on SOP events
  useEffect(() => {
    const unsub = on('notification:received', (data) => {
      if (['sop:new', 'sop:approved', 'sop:rejected', 'sop:submitted'].includes(data.type)) {
        load()
      }
    })
    return unsub
  }, [on, load])

  const filtered = filter === 'all' ? sops : sops.filter(s => s.status === filter)

  const counts = {
    all:      sops.length,
    pending:  sops.filter(s => s.status === 'pending').length,
    approved: sops.filter(s => s.status === 'approved').length,
    rejected: sops.filter(s => s.status === 'rejected').length,
  }

  const FILTERS = [
    { key: 'all',      label: 'All',      color: 'brand' },
    { key: 'pending',  label: 'Pending',  color: 'amber' },
    { key: 'approved', label: 'Approved', color: 'emerald' },
    { key: 'rejected', label: 'Rejected', color: 'red' },
  ]

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-sm">
              <FileText size={18} className="text-white" />
            </div>
            <div>
              <h1 className="font-display font-bold text-[#0f1f3d] text-xl">SOAP Records</h1>
              <p className="text-xs text-[#9aaec4] mt-0.5">
                {isDoctor
                  ? 'Review, edit and approve patient SOAP records'
                  : 'View your doctor-approved SOAP records'}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-xs font-semibold px-3 py-1.5 rounded-full border border-emerald-200">
            <Shield size={11} /> HIPAA Secure
          </div>
          <button
            onClick={load}
            className="w-9 h-9 rounded-xl bg-[#f4f7ff] flex items-center justify-center text-[#5a6c8a] hover:bg-brand-50 hover:text-brand-700 transition-colors border border-[#e8effc]"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Patient notice */}
      {!isDoctor && (
        <div className="mb-4 px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-2">
          <AlertCircle size={14} className="text-blue-500 mt-0.5 shrink-0" />
          <p className="text-xs text-blue-700">
            Only doctor-approved SOAP records are visible here. Generate a new SOAP record by using the <strong>AI Conversation</strong> page.
          </p>
        </div>
      )}

      {/* Filter tabs */}
      {isDoctor && (
        <div className="flex gap-2 mb-5 flex-wrap">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                filter === f.key
                  ? 'bg-brand-700 text-white border-brand-700 shadow-sm'
                  : 'bg-white text-[#5a6c8a] border-[#e8effc] hover:border-brand-200 hover:text-brand-700'
              }`}
            >
              {f.label}
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${filter === f.key ? 'bg-white/20 text-white' : 'bg-[#f0f4ff] text-[#5a6c8a]'}`}>
                {counts[f.key]}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 size={28} className="animate-spin text-brand-400" />
          <p className="text-sm text-[#9aaec4]">Loading SOAP records…</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
            <AlertCircle size={22} className="text-red-400" />
          </div>
        <p className="text-sm text-[#9aaec4]">{error}</p>
          <button onClick={load} className="btn-primary">Retry</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[#f4f7ff] border border-[#e8effc] flex items-center justify-center">
            <FileText size={28} className="text-[#c5d0e6]" />
          </div>
          <div className="text-center">
            <p className="font-display font-semibold text-[#0f1f3d] text-sm">
              {filter !== 'all' ? `No ${filter} SOAP records` : 'No SOAP records yet'}
            </p>
            <p className="text-xs text-[#9aaec4] mt-1">
              {isDoctor
                ? 'Patient SOAP records will appear here for your review'
                : 'Use the AI Assistant to start a consultation and generate a SOAP record'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(sop => (
            <SOPCard
              key={sop._id}
              sop={sop}
              isDoctor={isDoctor}
              onRefresh={load}
            />
          ))}
        </div>
      )}
    </div>
  )
}
