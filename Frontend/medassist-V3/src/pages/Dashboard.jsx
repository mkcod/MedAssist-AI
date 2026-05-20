import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useSocket } from '../contexts/SocketContext'
import { dashboardApi } from '../services/api'
import { Heart, Thermometer, Droplets, Wind, AlertCircle, Clock, Activity, Loader2 } from 'lucide-react'
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-[#e8effc] rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="text-[#9aaec4] mb-1">{label}</p>
      {payload.map((p, i) => <p key={i} style={{ color: p.color }} className="font-semibold">{p.name}: {p.value}</p>)}
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const { on } = useSocket()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [liveVitals, setLiveVitals] = useState(null)

  useEffect(() => {
    dashboardApi.get()
      .then(res => setData(res.data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!on) return
    return on('vitals:new', v => setLiveVitals(v))
  }, [on])

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-brand-600" size={32} /></div>
  if (error) return <div className="p-6"><div className="card p-6 text-center text-red-500"><AlertCircle className="mx-auto mb-2" size={24}/><p>{error}</p></div></div>

  const vitals = liveVitals || data?.vitals

  if (user.role === 'doctor') return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">
      <div className="mesh-bg rounded-2xl p-6 border border-[#e8effc]">
        <h2 className="font-display font-bold text-2xl text-[#0f1f3d]">Doctor Dashboard</h2>
        <p className="text-sm text-[#5a6c8a] mt-1">Today's schedule and patient overview</p>
      </div>
      <div className="grid grid-cols-3 gap-4 stagger">
        {[{ label:"Today's Appointments",value:data?.todayAppointments?.length||0},{label:'Total Patients',value:data?.totalPatients||0},{label:'Pending Records',value:data?.pendingRecords||0}].map(s=>(
          <div key={s.label} className="stat-card opacity-0" style={{animationFillMode:'forwards'}}>
            <p className="text-[11px] text-[#9aaec4] font-medium uppercase tracking-wide">{s.label}</p>
            <p className="font-display font-bold text-3xl text-brand-700">{s.value}</p>
          </div>
        ))}
      </div>
      <div className="card p-5">
        <h3 className="font-display font-semibold text-[#0f1f3d] mb-4">Today's Appointments</h3>
        {data?.todayAppointments?.length===0?<p className="text-sm text-[#9aaec4]">No appointments today.</p>:data?.todayAppointments?.map(a=>(
          <div key={a._id} className="flex items-center gap-3 p-3 rounded-xl bg-[#f8faff] mb-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-400 to-teal-500 flex items-center justify-center text-white text-xs font-bold">{(a.patientId?.initials)||'P'}</div>
            <div className="flex-1"><p className="text-sm font-semibold text-[#0f1f3d]">{a.patientName}</p><p className="text-xs text-[#9aaec4]">{a.time} · {a.mode}</p></div>
            <span className={`badge ${a.status==='upcoming'?'badge-blue':'badge-green'}`}>{a.status}</span>
          </div>
        ))}
      </div>
    </div>
  )

  if (user.role === 'receptionist') return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">
      <div className="mesh-bg rounded-2xl p-6 border border-[#e8effc]">
        <h2 className="font-display font-bold text-2xl text-[#0f1f3d]">Reception Desk</h2>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[{label:"Today's Appointments",value:data?.todayAppointments?.length||0},{label:'Total Patients',value:data?.totalPatients||0},{label:'Doctors On Duty',value:data?.totalDoctors||0}].map(s=>(
          <div key={s.label} className="stat-card"><p className="text-[11px] text-[#9aaec4] font-medium uppercase tracking-wide">{s.label}</p><p className="font-display font-bold text-3xl text-brand-700">{s.value}</p></div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      <div className="mesh-bg rounded-2xl p-6 border border-[#e8effc] flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <p className="text-sm text-brand-600 font-semibold mb-1">Good morning 👋</p>
          <h2 className="font-display font-bold text-2xl text-[#0f1f3d]">Welcome back, {user.name.split(' ')[0]}</h2>
          {liveVitals && <div className="mt-2 inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-xs font-semibold px-3 py-1 rounded-full"><Activity size={11}/> Live vitals updating</div>}
        </div>
      </div>
      {vitals && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger">
          {[{label:'Heart Rate',value:vitals.heartRate,unit:'bpm',icon:Heart,color:'#ef4444',bg:'#fef2f2'},{label:'Temperature',value:vitals.temperature?.toFixed(1),unit:'°F',icon:Thermometer,color:'#f97316',bg:'#fff7ed'},{label:'Blood Glucose',value:vitals.bloodGlucose,unit:'mg/dL',icon:Droplets,color:'#3395f5',bg:'#eff6ff'},{label:'SpO₂',value:vitals.spo2,unit:'%',icon:Wind,color:'#14b8a6',bg:'#f0fdfa'}].filter(v=>v.value).map(v=>{
            const Icon=v.icon
            return (
              <div key={v.label} className="stat-card opacity-0" style={{animationFillMode:'forwards'}}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{background:v.bg}}><Icon size={18} style={{color:v.color}}/></div>
                <div><p className="text-[11px] text-[#9aaec4] font-medium uppercase tracking-wide">{v.label}</p><p className="font-display font-bold text-2xl text-[#0f1f3d] mt-0.5">{v.value} <span className="text-sm font-normal text-[#9aaec4]">{v.unit}</span></p></div>
              </div>
            )
          })}
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {data?.heartRateChart?.length>0&&(
          <div className="card p-5">
            <h3 className="font-display font-semibold text-[#0f1f3d] text-base mb-4">Heart Rate</h3>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={data.heartRateChart}>
                <defs><linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.15}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f4ff"/><XAxis dataKey="time" tick={{fontSize:11,fill:'#9aaec4'}} axisLine={false} tickLine={false}/><YAxis tick={{fontSize:11,fill:'#9aaec4'}} axisLine={false} tickLine={false} domain={['auto','auto']}/><Tooltip content={<CustomTooltip/>}/>
                <Area type="monotone" dataKey="bpm" name="BPM" stroke="#ef4444" strokeWidth={2} fill="url(#hrGrad)" dot={false}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
        {data?.bpChart?.length>0&&(
          <div className="card p-5">
            <h3 className="font-display font-semibold text-[#0f1f3d] text-base mb-4">Blood Pressure</h3>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={data.bpChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f4ff"/><XAxis dataKey="day" tick={{fontSize:11,fill:'#9aaec4'}} axisLine={false} tickLine={false}/><YAxis tick={{fontSize:11,fill:'#9aaec4'}} axisLine={false} tickLine={false}/><Tooltip content={<CustomTooltip/>}/>
                <Line type="monotone" dataKey="sys" name="Systolic" stroke="#3395f5" strokeWidth={2.5} dot={false}/><Line type="monotone" dataKey="dia" name="Diastolic" stroke="#14b8a6" strokeWidth={2.5} dot={false}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h3 className="font-display font-semibold text-[#0f1f3d] mb-4">Upcoming Appointments</h3>
          {!data?.upcomingAppointments?.length?<p className="text-sm text-[#9aaec4]">No upcoming appointments.</p>:data.upcomingAppointments.map(a=>(
            <div key={a._id} className="flex items-center gap-3 p-3 rounded-xl bg-[#f8faff] mb-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center text-white text-xs font-bold">{a.doctorInitials||'DR'}</div>
              <div className="flex-1"><p className="text-sm font-semibold text-[#0f1f3d]">{a.doctorName}</p><p className="text-xs text-[#9aaec4]">{a.specialty}</p></div>
              <div className="text-right"><p className="text-xs font-semibold text-brand-600">{new Date(a.date).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</p><p className="text-xs text-[#9aaec4]">{a.time}</p></div>
            </div>
          ))}
        </div>
        <div className="card p-5">
          <h3 className="font-display font-semibold text-[#0f1f3d] mb-4">Alerts</h3>
          {data?.lowStockMeds?.map(m=>(
            <div key={m._id} className="flex items-start gap-2 bg-orange-50 rounded-xl px-3 py-2 mb-2"><AlertCircle size={14} className="text-orange-500 mt-0.5 shrink-0"/><p className="text-xs text-[#5a6c8a]">Refill <strong>{m.name}</strong> — only {m.daysLeft} days remaining</p></div>
          ))}
          <div className="flex items-start gap-2 bg-brand-50 rounded-xl px-3 py-2"><Clock size={14} className="text-brand-600 mt-0.5 shrink-0"/><p className="text-xs text-[#5a6c8a]">You have {data?.activeMedications||0} active medications today</p></div>
        </div>
      </div>
    </div>
  )
}
