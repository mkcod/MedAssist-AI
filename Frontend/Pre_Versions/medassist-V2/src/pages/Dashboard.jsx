import {
  Heart, Thermometer, Droplets, Wind, TrendingUp, TrendingDown,
  Calendar, ChevronRight, AlertCircle, CheckCircle2, Clock,
  Stethoscope, Activity, Users, CalendarDays, ClipboardCheck
} from 'lucide-react'
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar
} from 'recharts'
import { useAuth } from '../contexts/AuthContext'
import { ROLES } from '../contexts/AuthContext'
import { INITIAL_APPOINTMENTS, PATIENTS } from '../data/store'

// ─── Data ────────────────────────────────────────────────────────────────────
const heartRateData = [
  { time:'6am',bpm:62},{time:'8am',bpm:75},{time:'10am',bpm:80},{time:'12pm',bpm:72},
  {time:'2pm',bpm:78},{time:'4pm',bpm:85},{time:'6pm',bpm:70},{time:'8pm',bpm:65},
]
const bloodPressureData = [
  {day:'Mon',sys:120,dia:78},{day:'Tue',sys:118,dia:76},{day:'Wed',sys:125,dia:82},
  {day:'Thu',sys:122,dia:80},{day:'Fri',sys:119,dia:77},{day:'Sat',sys:116,dia:74},{day:'Sun',sys:121,dia:79},
]
const sleepData = [
  {day:'M',hours:7.2},{day:'T',hours:6.5},{day:'W',hours:8.1},{day:'T',hours:7.8},
  {day:'F',hours:6.9},{day:'S',hours:9.0},{day:'S',hours:8.4},
]
const vitals = [
  {label:'Heart Rate',value:'72',unit:'bpm',icon:Heart,color:'#ef4444',bg:'#fef2f2',trend:'+2',good:true},
  {label:'Temperature',value:'98.6',unit:'°F',icon:Thermometer,color:'#f97316',bg:'#fff7ed',trend:'Normal',good:true},
  {label:'Blood Glucose',value:'94',unit:'mg/dL',icon:Droplets,color:'#3395f5',bg:'#eff6ff',trend:'-3',good:true},
  {label:'SpO₂',value:'98',unit:'%',icon:Wind,color:'#14b8a6',bg:'#f0fdfa',trend:'Stable',good:true},
]
const alerts = [
  {type:'warning',msg:'Refill Metformin — 3 days remaining',icon:AlertCircle},
  {type:'success',msg:'HbA1c test results ready to view',icon:CheckCircle2},
  {type:'info',msg:'Annual health checkup due this month',icon:Clock},
]

const CustomTooltip = ({active,payload,label}) => {
  if (active && payload?.length) return (
    <div className="bg-white border border-[#e8effc] rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="text-[#9aaec4] mb-1">{label}</p>
      {payload.map((p,i) => (
        <p key={i} style={{color:p.color}} className="font-semibold">{p.name}: {p.value}</p>
      ))}
    </div>
  )
  return null
}

// ─── Patient Dashboard ────────────────────────────────────────────────────────
function PatientDashboard() {
  const upcoming = INITIAL_APPOINTMENTS.filter(a => a.patientId === 'P001' && a.status === 'upcoming').slice(0,2)
  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Welcome */}
      <div className="mesh-bg rounded-2xl p-6 border border-[#e8effc] flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <p className="text-sm text-brand-600 font-semibold mb-1">Good morning 👋</p>
          <h2 className="font-display font-bold text-2xl text-[#0f1f3d] leading-tight">Welcome back, Rahul</h2>
          <p className="text-sm text-[#5a6c8a] mt-1">Your health looks great today. Keep it up!</p>
        </div>
        <div className="flex gap-3">
          <div className="card px-4 py-3 text-center min-w-[80px]">
            <p className="font-display font-bold text-2xl text-brand-700">87</p>
            <p className="text-xs text-[#9aaec4] mt-0.5">Health Score</p>
          </div>
          <div className="card px-4 py-3 text-center min-w-[80px]">
            <p className="font-display font-bold text-2xl text-emerald-600">Good</p>
            <p className="text-xs text-[#9aaec4] mt-0.5">Overall Status</p>
          </div>
        </div>
      </div>

      {/* Vitals */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger">
        {vitals.map(v => { const Icon = v.icon; return (
          <div key={v.label} className="stat-card opacity-0" style={{animationFillMode:'forwards'}}>
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{background:v.bg}}>
                <Icon size={18} style={{color:v.color}} />
              </div>
              <span className={`badge ${v.good?'badge-green':'badge-red'}`}>{v.trend}</span>
            </div>
            <div>
              <p className="text-[11px] text-[#9aaec4] font-medium uppercase tracking-wide">{v.label}</p>
              <p className="font-display font-bold text-2xl text-[#0f1f3d] mt-0.5">
                {v.value} <span className="text-sm font-normal text-[#9aaec4]">{v.unit}</span>
              </p>
            </div>
          </div>
        )})}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div><h3 className="font-display font-semibold text-[#0f1f3d] text-base">Heart Rate</h3><p className="text-xs text-[#9aaec4]">Today's readings</p></div>
            <div className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full text-xs font-semibold"><TrendingDown size={12}/> Normal</div>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={heartRateData} margin={{top:5,right:5,bottom:0,left:-20}}>
              <defs><linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
              </linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f4ff"/>
              <XAxis dataKey="time" tick={{fontSize:11,fill:'#9aaec4'}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fontSize:11,fill:'#9aaec4'}} axisLine={false} tickLine={false} domain={[55,95]}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Area type="monotone" dataKey="bpm" name="BPM" stroke="#ef4444" strokeWidth={2} fill="url(#hrGrad)" dot={false} activeDot={{r:5,fill:'#ef4444'}}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div><h3 className="font-display font-semibold text-[#0f1f3d] text-base">Blood Pressure</h3><p className="text-xs text-[#9aaec4]">This week</p></div>
            <div className="flex gap-3 text-[11px] text-[#9aaec4]">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-brand-500 inline-block"/>Systolic</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-teal-500 inline-block"/>Diastolic</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={bloodPressureData} margin={{top:5,right:5,bottom:0,left:-20}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f4ff"/>
              <XAxis dataKey="day" tick={{fontSize:11,fill:'#9aaec4'}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fontSize:11,fill:'#9aaec4'}} axisLine={false} tickLine={false} domain={[65,135]}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Line type="monotone" dataKey="sys" name="Systolic" stroke="#3395f5" strokeWidth={2.5} dot={false} activeDot={{r:5}}/>
              <Line type="monotone" dataKey="dia" name="Diastolic" stroke="#14b8a6" strokeWidth={2.5} dot={false} activeDot={{r:5}}/>
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div><h3 className="font-display font-semibold text-[#0f1f3d] text-base">Sleep Quality</h3><p className="text-xs text-[#9aaec4]">Avg 7.7 hrs/night</p></div>
            <div className="flex items-center gap-1 text-brand-600 bg-brand-50 px-2.5 py-1 rounded-full text-xs font-semibold"><TrendingUp size={11}/> +0.3</div>
          </div>
          <ResponsiveContainer width="100%" height={110}>
            <BarChart data={sleepData} margin={{top:0,right:0,bottom:0,left:-30}}>
              <XAxis dataKey="day" tick={{fontSize:11,fill:'#9aaec4'}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fontSize:11,fill:'#9aaec4'}} axisLine={false} tickLine={false} domain={[0,10]}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Bar dataKey="hours" name="Hours" fill="#3395f5" radius={[4,4,0,0]} opacity={0.85}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-[#0f1f3d] text-base">Upcoming</h3>
            <button className="text-xs text-brand-600 font-medium hover:underline">View all</button>
          </div>
          <div className="space-y-3">
            {upcoming.map((a,i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-[#f8faff] hover:bg-brand-50 transition-colors cursor-pointer">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${a.color} flex items-center justify-center text-white text-xs font-bold shrink-0`}>{a.avatar}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#0f1f3d] truncate">{a.doctor}</p>
                  <p className="text-xs text-[#9aaec4]">{a.specialty}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-semibold text-brand-600">{a.date}</p>
                  <p className="text-xs text-[#9aaec4]">{a.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-[#0f1f3d] text-base">Alerts</h3>
            <span className="badge badge-blue">3 new</span>
          </div>
          <div className="space-y-3">
            {alerts.map((a,i) => {
              const Icon = a.icon
              const s = {warning:{bg:'bg-orange-50',text:'text-orange-600'},success:{bg:'bg-emerald-50',text:'text-emerald-600'},info:{bg:'bg-brand-50',text:'text-brand-600'}}[a.type]
              return (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-xl ${s.bg}`}>
                  <Icon size={16} className={`${s.text} shrink-0 mt-0.5`}/>
                  <p className="text-xs text-[#5a6c8a] leading-relaxed">{a.msg}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Doctor Dashboard ─────────────────────────────────────────────────────────
function DoctorDashboard() {
  const { user } = useAuth()
  const todayAppts = INITIAL_APPOINTMENTS.filter(a => a.doctorId === 'D001' && a.status === 'upcoming').slice(0,4)
  const stats = [
    { label:'Today\'s Appointments', value:'8', icon:CalendarDays, color:'text-brand-700', bg:'bg-brand-50' },
    { label:'Total Patients', value:'248', icon:Users, color:'text-pink-700', bg:'bg-pink-50' },
    { label:'Completed Today', value:'3', icon:CheckCircle2, color:'text-emerald-700', bg:'bg-emerald-50' },
    { label:'Pending Reports', value:'5', icon:ClipboardCheck, color:'text-amber-700', bg:'bg-amber-50' },
  ]
  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      <div className="mesh-bg rounded-2xl p-6 border border-[#e8effc] flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <p className="text-sm text-pink-600 font-semibold mb-1">Good morning 👋</p>
          <h2 className="font-display font-bold text-2xl text-[#0f1f3d]">Welcome, {user?.name}</h2>
          <p className="text-sm text-[#5a6c8a] mt-1">You have 8 appointments scheduled today.</p>
        </div>
        <div className="flex gap-3">
          <div className="card px-4 py-3 text-center"><p className="font-display font-bold text-2xl text-brand-700">Wed</p><p className="text-xs text-[#9aaec4]">Apr 15</p></div>
          <div className="card px-4 py-3 text-center"><p className="font-display font-bold text-2xl text-pink-600">OPD</p><p className="text-xs text-[#9aaec4]">Cardiology</p></div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger">
        {stats.map(s => { const Icon = s.icon; return (
          <div key={s.label} className="card p-5 flex flex-col gap-3 animate-slide-up opacity-0" style={{animationFillMode:'forwards'}}>
            <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center`}><Icon size={20} className={s.color}/></div>
            <div><p className="text-xs text-[#9aaec4] font-medium">{s.label}</p><p className={`font-display font-bold text-2xl ${s.color} mt-0.5`}>{s.value}</p></div>
          </div>
        )})}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h3 className="font-display font-semibold text-[#0f1f3d] mb-4">Today's Schedule</h3>
          <div className="space-y-3">
            {todayAppts.map(a => (
              <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#f8faff] hover:bg-brand-50 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-100 to-brand-200 flex items-center justify-center text-brand-700 font-bold text-xs shrink-0">{a.patientName.split(' ').map(n=>n[0]).join('')}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#0f1f3d]">{a.patientName}</p>
                  <p className="text-xs text-[#9aaec4]">{a.notes}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-semibold text-brand-600">{a.time}</p>
                  <span className={`badge ${a.mode === 'video' ? 'badge-blue' : 'badge-green'} text-[10px]`}>{a.mode}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-5">
          <h3 className="font-display font-semibold text-[#0f1f3d] mb-4">Recent Patients</h3>
          <div className="space-y-3">
            {PATIENTS.slice(0,4).map(p => (
              <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#f8faff]">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${p.color} flex items-center justify-center text-white font-bold text-xs shrink-0`}>{p.initials}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#0f1f3d]">{p.name}</p>
                  <p className="text-xs text-[#9aaec4]">{p.condition} · Age {p.age}</p>
                </div>
                <span className="badge badge-green text-[10px]">{p.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Receptionist Dashboard ───────────────────────────────────────────────────
function ReceptionistDashboard() {
  const { user } = useAuth()
  const todayAppts = INITIAL_APPOINTMENTS.filter(a => a.status === 'upcoming').slice(0,5)
  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      <div className="mesh-bg rounded-2xl p-6 border border-[#e8effc] flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <p className="text-sm text-violet-600 font-semibold mb-1">Morning Shift · OPD Wing B 👋</p>
          <h2 className="font-display font-bold text-2xl text-[#0f1f3d]">Welcome, {user?.name}</h2>
          <p className="text-sm text-[#5a6c8a] mt-1">12 patients scheduled today · 3 checked in</p>
        </div>
        <div className="flex gap-3">
          {[{v:'12',l:'Scheduled'},{v:'3',l:'Checked In'},{v:'9',l:'Pending'}].map(s=>(
            <div key={s.l} className="card px-4 py-3 text-center"><p className="font-display font-bold text-2xl text-brand-700">{s.v}</p><p className="text-xs text-[#9aaec4]">{s.l}</p></div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h3 className="font-display font-semibold text-[#0f1f3d] mb-4">Today's Queue</h3>
          <div className="space-y-2">
            {todayAppts.map((a,i) => (
              <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#f8faff]">
                <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center shrink-0">{i+1}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#0f1f3d]">{a.patientName}</p>
                  <p className="text-xs text-[#9aaec4]">{a.doctor} · {a.time}</p>
                </div>
                <button className="btn-ghost text-xs py-1 px-3 border border-[#e8effc] bg-white">Check In</button>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-5">
          <h3 className="font-display font-semibold text-[#0f1f3d] mb-4">Quick Stats</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              {l:'Total Patients',v:'1,248',c:'text-brand-700',bg:'bg-brand-50'},
              {l:'Avg Wait Time',v:'18 min',c:'text-amber-700',bg:'bg-amber-50'},
              {l:'No Shows Today',v:'1',c:'text-red-600',bg:'bg-red-50'},
              {l:'New Registrations',v:'3',c:'text-emerald-700',bg:'bg-emerald-50'},
            ].map(s=>(
              <div key={s.l} className={`${s.bg} rounded-xl p-4`}>
                <p className={`font-display font-bold text-2xl ${s.c}`}>{s.v}</p>
                <p className="text-xs text-[#9aaec4] mt-0.5">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Attendee Dashboard ───────────────────────────────────────────────────────
function AttendeeDashboard() {
  const { user } = useAuth()
  const upcoming = INITIAL_APPOINTMENTS.filter(a => a.patientId === 'P001' && a.status === 'upcoming').slice(0,3)
  return (
    <div className="p-6 max-w-[900px] mx-auto space-y-6">
      <div className="mesh-bg rounded-2xl p-6 border border-[#e8effc]">
        <p className="text-sm text-amber-600 font-semibold mb-1">Attendee View 👋</p>
        <h2 className="font-display font-bold text-2xl text-[#0f1f3d]">Welcome, {user?.name}</h2>
        <p className="text-sm text-[#5a6c8a] mt-1">Viewing appointments for <span className="font-semibold">Rahul Kumar</span></p>
      </div>
      <div className="card p-5">
        <h3 className="font-display font-semibold text-[#0f1f3d] mb-4">Upcoming Appointments</h3>
        <div className="space-y-3">
          {upcoming.map(a => (
            <div key={a.id} className="flex items-center gap-4 p-4 rounded-xl bg-[#f8faff]">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${a.color} flex items-center justify-center text-white font-bold shrink-0`}>{a.avatar}</div>
              <div className="flex-1">
                <p className="font-semibold text-[#0f1f3d]">{a.doctor}</p>
                <p className="text-sm text-[#9aaec4]">{a.specialty}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-brand-600">{a.date}</p>
                <p className="text-xs text-[#9aaec4]">{a.time} · {a.mode}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user } = useAuth()
  if (user?.role === ROLES.DOCTOR) return <DoctorDashboard/>
  if (user?.role === ROLES.RECEPTIONIST) return <ReceptionistDashboard/>
  if (user?.role === ROLES.ATTENDEE) return <AttendeeDashboard/>
  return <PatientDashboard/>
}
