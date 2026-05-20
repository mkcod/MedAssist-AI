import { useState, useRef, useEffect, useCallback } from 'react'
import { orchestratorApi, chatApi, usersApi } from '../services/api'
import { useSocket } from '../contexts/SocketContext'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import {
  Mic, MicOff, Trash2, Download, Loader2, CheckCircle2,
  AlertCircle, Clock, Volume2, Cpu, FileText, Send,
  Sparkles, ChevronRight, Bell, Shield, User, Search
} from 'lucide-react'

// ─── Waveform bars ────────────────────────────────────────────────────────────
function WaveformBars({ active, amplitude }) {
  const COUNT = 42
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2.5px', height: 96, width: '100%' }}>
      {Array.from({ length: COUNT }, (_, i) => {
        const amp    = amplitude[i % Math.max(amplitude.length, 1)] || 0
        const mirror = i < COUNT / 2 ? i : COUNT - 1 - i
        const pos    = mirror / (COUNT / 2)
        const base   = 3 + pos * 6
        const h      = active ? base + amp * 64 + Math.sin(i * 0.45) * 5 : base + Math.sin(i * 0.5) * 2.5
        const hue    = 250 + (i / COUNT) * 85
        const alpha  = active ? 0.4 + amp * 0.6 : 0.18 + pos * 0.14
        return (
          <div
            key={i}
            style={{
              width: 3, height: Math.max(3, h),
              background: `hsla(${hue},78%,68%,${alpha})`,
              borderRadius: 9,
              transition: 'height 70ms ease, background 140ms ease',
            }}
          />
        )
      })}
    </div>
  )
}

// ─── Pipeline progress stages ─────────────────────────────────────────────────
const PATIENT_STAGES = [
  { key: 'conversational', icon: Mic,          label: 'Capturing your conversation',    desc: 'Listening to your consultation…' },
  { key: 'summarizer',     icon: Cpu,          label: 'Analysing your health concerns', desc: 'Identifying symptoms and health conditions…' },
  { key: 'purged',         icon: Shield,       label: 'Privacy protected',              desc: 'Your recording has been securely erased — not stored anywhere' },
  { key: 'publishing',     icon: FileText,     label: 'Preparing your health summary',  desc: 'Creating a structured note for your doctor…' },
  { key: 'complete',       icon: CheckCircle2, label: 'Summary sent to your doctor',    desc: 'Your doctor will review and respond' },
]

const DOCTOR_STAGES = [
  { key: 'conversational', icon: Mic,          label: 'Capturing consultation',          desc: 'Recording patient conversation…' },
  { key: 'summarizer',     icon: Cpu,          label: 'Analysing clinical details',      desc: 'Extracting symptoms and conditions…' },
  { key: 'purged',         icon: Shield,       label: 'Privacy protected',               desc: 'Recording securely erased — not stored anywhere' },
  { key: 'publishing',     icon: FileText,     label: 'Generating SOAP note',            desc: 'Creating a structured clinical note…' },
  { key: 'complete',       icon: CheckCircle2, label: 'SOAP note created',               desc: 'Ready for your review and approval' },
]

const MIC_CAPTURE_CONSTRAINTS = {
  audio: {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    channelCount: 1,
  },
}

function mergeAudioChunks(chunks) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const merged = new Float32Array(totalLength)
  let offset = 0
  chunks.forEach((chunk) => {
    merged.set(chunk, offset)
    offset += chunk.length
  })
  return merged
}

function encodeWavBlob(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)

  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i += 1) {
      view.setUint8(offset + i, string.charCodeAt(i))
    }
  }

  const writePCM = (offset, input) => {
    for (let i = 0; i < input.length; i += 1) {
      const clamped = Math.max(-1, Math.min(1, input[i]))
      view.setInt16(offset + i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true)
    }
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, samples.length * 2, true)
  writePCM(44, samples)

  return new Blob([buffer], { type: 'audio/wav' })
}

const fmtDoctor = (name) => {
  if (!name || name === 'your doctor') return 'your doctor'
  const t = name.trim()
  return /^Dr\.?\s/i.test(t) ? t : ` ${t}`
}

function PipelineProgress({ stage, progress, jobStatus, sopId, doctorName, onViewSOP, isDoctor }) {
  const STAGES = isDoctor ? DOCTOR_STAGES : PATIENT_STAGES
  const activeIdx = STAGES.findIndex(s => s.key === stage)
  const isDone    = jobStatus === 'complete'
  const isError   = jobStatus === 'error'

  return (
    <div style={{
      background: 'rgba(255,255,255,0.06)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 20,
      padding: '20px 22px',
      width: '100%',
      maxWidth: 520,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 10,
          background: isDone ? 'linear-gradient(135deg,#34d399,#10b981)' : isError ? 'linear-gradient(135deg,#f87171,#ef4444)' : 'linear-gradient(135deg,#a78bfa,#7c3aed)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: isDone ? '0 4px 12px rgba(52,211,153,0.4)' : '0 4px 12px rgba(124,58,237,0.4)',
        }}>
          {isDone ? <CheckCircle2 size={15} color="white" /> : <Sparkles size={15} color="white" style={{ animation: 'spin 2s linear infinite' }} />}
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>
            {isDone ? 'All done!' : isError ? 'Something went wrong' : 'Processing your consultation…'}
          </p>
          <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>
            {isDone ? (isDoctor ? 'SOAP note ready — please review and approve' : `Summary sent to ${fmtDoctor(doctorName)}`) : 'Please wait while we process your visit'}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 99, marginBottom: 18, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${progress}%`,
          background: isDone ? 'linear-gradient(90deg,#34d399,#10b981)' : 'linear-gradient(90deg,#a78bfa,#60a5fa,#22d3ee)',
          borderRadius: 99,
          transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
        }} />
      </div>

      {/* Stages */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {STAGES.map((s, idx) => {
          const Icon      = s.icon
          const isActive  = idx === activeIdx && !isDone
          const isDoneStg = idx < activeIdx || isDone
          const isPending = idx > activeIdx && !isDone

          const isPurgedStep = s.key === 'purged'
          const isPurgedActive = isActive && isPurgedStep

          return (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: isPending ? 0.35 : 1, transition: 'opacity 0.3s' }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                background: isDoneStg
                  ? 'linear-gradient(135deg,#34d399,#10b981)'
                  : isPurgedActive
                    ? 'linear-gradient(135deg,#2dd4bf,#0d9488)'
                    : isActive
                      ? 'linear-gradient(135deg,#a78bfa,#7c3aed)'
                      : 'rgba(255,255,255,0.06)',
                border: isActive ? 'none' : '1px solid rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: isPurgedActive ? '0 0 16px rgba(13,148,136,0.6)' : isActive ? '0 0 16px rgba(124,58,237,0.5)' : 'none',
                transition: 'all 0.4s',
              }}>
                <Icon size={12} color={isDoneStg || isActive ? 'white' : 'rgba(255,255,255,0.3)'}
                  style={isActive && !isPurgedActive ? { animation: 'vaPulse 1.2s ease-in-out infinite' } : {}} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: isDoneStg || isActive ? 600 : 400, color: isDoneStg ? '#34d399' : isPurgedActive ? '#2dd4bf' : isActive ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)' }}>
                  {s.label}
                </p>
                {isActive && (
                  <p style={{ margin: '2px 0 0', fontSize: 10, color: isPurgedActive ? 'rgba(45,212,191,0.6)' : 'rgba(255,255,255,0.4)' }}>{s.desc}</p>
                )}
              </div>
              {isDoneStg && <CheckCircle2 size={12} color="#34d399" />}
              {isActive && !isPurgedActive && (
                <div style={{ display: 'flex', gap: 3 }}>
                  {[0, 1, 2].map(d => (
                    <div key={d} style={{
                      width: 4, height: 4, borderRadius: '50%',
                      background: '#a78bfa',
                      animation: `vaPulse 1s ease-in-out ${d * 0.25}s infinite`,
                    }} />
                  ))}
                </div>
              )}
              {isPurgedActive && <Shield size={12} color="#2dd4bf" />}
            </div>
          )
        })}
      </div>

      {/* Done CTA */}
      {isDone && (
        <div style={{
          marginTop: 16, padding: '12px 14px',
          background: 'rgba(52,211,153,0.1)',
          border: '1px solid rgba(52,211,153,0.25)',
          borderRadius: 12,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <Bell size={14} color="#34d399" />
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#34d399' }}>
              {isDoctor ? 'SOAP note ready for review' : 'Waiting for your doctor'}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>
              {isDoctor ? 'Please review and approve the consultation note' : `You'll be notified once ${fmtDoctor(doctorName)} reviews your summary`}
            </p>
          </div>
          <button
            onClick={onViewSOP}
            style={{
              padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(52,211,153,0.4)',
              background: 'rgba(52,211,153,0.15)', color: '#34d399',
              fontSize: 11, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            View <ChevronRight size={10} />
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Session card ─────────────────────────────────────────────────────────────
function SessionCard({ session, onDelete }) {
  const wc  = session.wordCount ?? session.transcript?.split(' ').filter(Boolean).length ?? 0
  const ds  = session.durationSec
  const dur = ds ? `${Math.floor(ds / 60)}:${String(ds % 60).padStart(2, '0')}` : null

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', padding: '8px 10px 8px 14px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, top: 6, bottom: 6, width: 2, borderRadius: 9, background: 'linear-gradient(to bottom,#a78bfa,#60a5fa,#22d3ee)' }} />
      <div style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, background: 'linear-gradient(135deg,#7c3aed,#2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Volume2 size={11} color="white" />
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.55)', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
          {new Date(session.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
        </span>
        {dur && <span style={{ fontSize: 10, color: '#22d3ee', display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' }}><Clock size={9} />{dur}</span>}
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {session.transcript}
        </span>
        <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.07)', borderRadius: 20, padding: '1px 7px', color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap', flexShrink: 0 }}>{wc}w</span>
      </div>
      <button
        onClick={e => { e.stopPropagation(); onDelete(session._id || session.id) }}
        style={{ flexShrink: 0, width: 24, height: 24, borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.22)', transition: 'all 0.2s' }}
        onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.background = 'rgba(248,113,113,0.12)' }}
        onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.22)'; e.currentTarget.style.background = 'transparent' }}
      >
        <Trash2 size={11} />
      </button>
    </div>
  )
}

// ─── Patient Assistant Component ──────────────────────────────────────────────
function PatientAssistant() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [messages, setMessages]     = useState([])
  const [input, setInput]           = useState('')
  const [sending, setSending]       = useState(false)
  const [recording, setRecording]   = useState(false)
  const [liveText, setLiveText]     = useState('')
  const [pendingAction, setPendingAction] = useState(null)
  const [loadingHist, setLoadingHist] = useState(true)

  const messagesEndRef = useRef(null)
  const audioCtxRef    = useRef(null)
  const processorRef   = useRef(null)
  const streamRef      = useRef(null)
  const audioChunksRef = useRef([])
  const sampleRateRef  = useRef(44100)
  const recRef         = useRef(false)

  const supported = typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

  // Load chat history
  useEffect(() => {
    chatApi.history()
      .then(r => {
        const hist = (r?.data || []).map(m => ({
          id: m._id, role: m.role, text: m.text,
          time: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }))
        setMessages(hist)
      })
      .catch(() => {})
      .finally(() => setLoadingHist(false))
  }, [])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Add welcome message if empty
  useEffect(() => {
    if (!loadingHist && messages.length === 0) {
      setMessages([{
        id: 'welcome', role: 'assistant',
        text: `Hello ${user?.name?.split(' ')[0] || ''}! 👋 I'm your MedAssist AI assistant. I can help you with:\n\n• **Book appointments** — "book appointment with Dr. Priya"\n• **Check appointments** — "show my appointments"\n• **Health summary** — "show my health summary"\n• **Medications** — "what are my medications"\n• **Vitals** — "check my vitals"\n• **Records** — "show my records"\n\nYou can type or use the 🎤 mic button to speak!`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }])
    }
  }, [loadingHist])

  // Send message
  const sendMessage = async (text) => {
    const msg = (text || input).trim()
    if (!msg || sending) return

    // Check if this is a confirmation for a pending booking
    const isConfirm = pendingAction?.type === 'confirm_booking' &&
      /\b(yes|confirm|book it|go ahead|sure|okay|ok)\b/i.test(msg)

    setMessages(p => [...p, { id: Date.now(), role: 'user', text: msg, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }])
    setInput('')
    setSending(true)

    try {
      if (isConfirm) {
        // Actually book the appointment
        const res = await chatApi.bookConfirm({
          doctorId: pendingAction.doctorId,
          date: pendingAction.date,
          time: pendingAction.time,
          mode: 'in-person',
        })
        const reply = res.data?.message || 'Appointment booked!'
        setMessages(p => [...p, { id: Date.now() + 1, role: 'assistant', text: reply, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }])
        setPendingAction(null)
      } else {
        const res = await chatApi.sendMessage(msg)
        const data = res.data
        setMessages(p => [...p, {
          id: data.id, role: 'assistant', text: data.text,
          time: data.time, action: data.action,
        }])
        // Store pending action for confirmations
        if (data.action?.type === 'confirm_booking') {
          setPendingAction(data.action)
        } else {
          setPendingAction(null)
        }
      }
    } catch (err) {
      setMessages(p => [...p, { id: Date.now() + 1, role: 'assistant', text: 'Sorry, something went wrong. Please try again.', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }])
    } finally {
      setSending(false)
    }
  }

  // Voice input
  const startVoice = async () => {
    if (!supported || recRef.current) return
    audioChunksRef.current = []
    setLiveText('')
    recRef.current = true
    setRecording(true)

    try {
      const s = await navigator.mediaDevices.getUserMedia(MIC_CAPTURE_CONSTRAINTS)
      streamRef.current = s
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      audioCtxRef.current = ctx

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : ''
      const recorder = new MediaRecorder(s, mimeType ? { mimeType } : {})
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data)
      }
      processorRef.current = recorder
      recorder.start(250)
    } catch (_) {
      recRef.current = false
      setRecording(false)
    }
  }

  const stopVoice = async () => {
    recRef.current = false
    setRecording(false)

    await new Promise((resolve) => {
      const recorder = processorRef.current
      if (recorder && recorder.state !== 'inactive') {
        recorder.onstop = resolve
        recorder.stop()
      } else {
        resolve()
      }
    })
    processorRef.current = null

    streamRef.current?.getTracks().forEach(t => t.stop())
    try { await audioCtxRef.current?.close() } catch (_) {}
    audioCtxRef.current = null

    if (!audioChunksRef.current.length) {
      setLiveText('')
      return
    }

    try {
      // Decode WebM/Opus → 16 kHz mono PCM → WAV in the browser
      const webmBlob = new Blob(audioChunksRef.current, { type: audioChunksRef.current[0]?.type || 'audio/webm' })
      audioChunksRef.current = []
      const arrayBuffer = await webmBlob.arrayBuffer()
      const decodeCtx = new AudioContext({ sampleRate: 16000 })
      let audioBuffer
      try {
        audioBuffer = await decodeCtx.decodeAudioData(arrayBuffer)
      } finally {
        decodeCtx.close().catch(() => {})
      }
      const wavBlob = encodeWavBlob(audioBuffer.getChannelData(0), 16000)

      const formData = new FormData()
      formData.append('audio', wavBlob, 'voice-message.wav')
      formData.append('language', 'en-IN')

      const transcription = await orchestratorApi.transcribeAudio(formData)
      const text = (transcription?.transcript || '').trim()
      setLiveText('')

      if (text) {
        setInput(text)
        sendMessage(text)
      }
    } catch (_) {
      setLiveText('')
    }
  }

  const toggleVoice = () => recording ? stopVoice() : startVoice()

  // Quick action buttons
  const quickActions = [
    { label: '📅 Book Appointment', msg: 'I want to book an appointment' },
    { label: '📋 My Appointments', msg: 'Show my appointments' },
    { label: '💊 Medications', msg: 'What are my medications' },
    { label: '❤️ Health Summary', msg: 'Show my health summary' },
  ]

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', overflow: 'hidden', fontFamily: "'DM Sans',sans-serif" }}>
      {/* Background */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, background: 'linear-gradient(135deg,#0c0c1e 0%,#0a0e28 55%,#0d1630 100%)' }} />
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, background: 'radial-gradient(ellipse 55% 45% at 18% 0%,rgba(120,80,255,0.15) 0%,transparent 100%)' }} />

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 12, background: 'linear-gradient(135deg,#7c3aed,#2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 18px rgba(124,58,237,0.45)' }}>
              <Sparkles size={15} color="white" />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.9)', fontFamily: "'Sora',sans-serif" }}>MedAssist AI Assistant</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', display: 'inline-block', background: '#34d399' }} />
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>Online — Voice & Text</span>
              </div>
            </div>
          </div>
          <button onClick={() => { chatApi.clearHistory(); setMessages([]); setPendingAction(null) }}
            style={{ height: 32, padding: '0 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.38)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Trash2 size={11} />Clear
          </button>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {loadingHist ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <Loader2 size={22} color="rgba(255,255,255,0.3)" style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          ) : (
            messages.map(m => (
              <div key={m.id} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', gap: 8 }}>
                {m.role === 'assistant' && (
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#7c3aed,#2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                    <Sparkles size={11} color="white" />
                  </div>
                )}
                <div style={{
                  maxWidth: '75%', padding: '10px 14px', borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  background: m.role === 'user' ? 'linear-gradient(135deg,#7c3aed,#2563eb)' : 'rgba(255,255,255,0.07)',
                  border: m.role === 'user' ? 'none' : '1px solid rgba(255,255,255,0.1)',
                }}>
                  <p style={{ margin: 0, fontSize: 13, color: m.role === 'user' ? 'white' : 'rgba(255,255,255,0.85)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}
                     dangerouslySetInnerHTML={{ __html: formatMarkdown(m.text) }} />
                  <p style={{ margin: '4px 0 0', fontSize: 9, color: m.role === 'user' ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.25)', textAlign: 'right' }}>{m.time}</p>
                </div>
                {m.role === 'user' && (
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                    <User size={11} color="rgba(255,255,255,0.6)" />
                  </div>
                )}
              </div>
            ))
          )}

          {/* Typing indicator */}
          {sending && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#7c3aed,#2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Sparkles size={11} color="white" />
              </div>
              <div style={{ padding: '10px 14px', borderRadius: '14px 14px 14px 4px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', gap: 4 }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#a78bfa', animation: `vaPulse 1s ease-in-out ${i * 0.2}s infinite` }} />
                ))}
              </div>
            </div>
          )}

          {/* Voice recording indicator */}
          {recording && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <div style={{ padding: '10px 14px', borderRadius: '14px 14px 4px 14px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', animation: 'vaPulse 1s ease-in-out infinite' }} />
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{liveText || 'Listening…'}</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Actions */}
        {messages.length <= 1 && !sending && (
          <div style={{ padding: '0 20px 8px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {quickActions.map(qa => (
              <button key={qa.label} onClick={() => sendMessage(qa.msg)}
                style={{ padding: '6px 12px', borderRadius: 20, border: '1px solid rgba(167,139,250,0.3)', background: 'rgba(167,139,250,0.08)', color: '#a78bfa', fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(167,139,250,0.18)'; e.currentTarget.style.borderColor = 'rgba(167,139,250,0.5)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(167,139,250,0.08)'; e.currentTarget.style.borderColor = 'rgba(167,139,250,0.3)' }}
              >{qa.label}</button>
            ))}
          </div>
        )}

        {/* Confirm booking button */}
        {pendingAction?.type === 'confirm_booking' && (
          <div style={{ padding: '0 20px 8px', display: 'flex', gap: 8 }}>
            <button onClick={() => sendMessage('Yes, confirm the booking')}
              style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#34d399,#10b981)', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle2 size={13} /> Confirm Booking
            </button>
            <button onClick={() => { setPendingAction(null); sendMessage("No, let me choose a different time") }}
              style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              Change
            </button>
          </div>
        )}

        {/* Input area */}
        <div style={{ padding: '12px 20px 16px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 14, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <input
              value={recording ? liveText : input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder={recording ? 'Listening…' : 'Type a message or use voice…'}
              disabled={recording || sending}
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'rgba(255,255,255,0.85)', fontSize: 13, fontFamily: 'inherit' }}
            />
          </div>
          {/* Voice button */}
          <button onClick={toggleVoice} disabled={!supported}
            style={{
              width: 40, height: 40, borderRadius: 12, border: 'none', flexShrink: 0,
              background: recording ? 'linear-gradient(135deg,#ef4444,#dc2626)' : 'rgba(255,255,255,0.08)',
              cursor: supported ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: recording ? '0 0 20px rgba(239,68,68,0.4)' : 'none',
              transition: 'all 0.2s',
            }}>
            {recording ? <MicOff size={16} color="white" /> : <Mic size={16} color="rgba(255,255,255,0.6)" />}
          </button>
          {/* Send button */}
          <button onClick={() => sendMessage()} disabled={(!input.trim() && !recording) || sending}
            style={{
              width: 40, height: 40, borderRadius: 12, border: 'none', flexShrink: 0,
              background: (input.trim() || sending) ? 'linear-gradient(135deg,#7c3aed,#2563eb)' : 'rgba(255,255,255,0.06)',
              cursor: input.trim() ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: (input.trim() || sending) ? 1 : 0.4,
              transition: 'all 0.2s',
            }}>
            {sending ? <Loader2 size={16} color="white" style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={16} color="white" />}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes vaPulse{0%,100%{opacity:1}50%{opacity:0.25}}
        @keyframes vaRing{0%{opacity:0.65;transform:scale(1)}100%{opacity:0;transform:scale(1.13)}}
        @keyframes vaWordIn{0%{opacity:0;transform:translateY(5px)}100%{opacity:1;transform:translateY(0)}}
        @keyframes vaCaret{0%,100%{opacity:1}50%{opacity:0}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes vaSlideIn{0%{opacity:0;transform:translateX(24px)}100%{opacity:1;transform:translateX(0)}}
      `}</style>
    </div>
  )
}

// ─── Markdown-lite formatter ──────────────────────────────────────────────────
function formatMarkdown(text) {
  if (!text) return ''
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>')
}


// ─── Main component ───────────────────────────────────────────────────────────
export default function AIChat() {
  const navigate = useNavigate()
  const { on, emit, connected } = useSocket()
  const { user } = useAuth()
  const isDoctor = user?.role === 'doctor'

  // Recording state
  const [recording, setRecording] = useState(false)
  const [liveText, setLiveText]   = useState('')
  const [amplitude, setAmplitude] = useState([])
  const [sessions, setSessions]   = useState([])
  const [status, setStatus]       = useState('idle')
  const [loadingHist, setLoadHist]= useState(true)

  // Pipeline state
  const [pipelineActive, setPipelineActive] = useState(false)
  const [jobId, setJobId]         = useState(null)
  const [pipelineStage, setPipelineStage] = useState('conversational')
  const [pipelineProgress, setPipelineProgress] = useState(0)
  const [pipelineStatus, setPipelineStatus] = useState('running')
  const [sopId, setSopId]         = useState(null)
  const [doctorName, setDoctorName] = useState('your doctor')
  const [notification, setNotification] = useState(null)

  // Doctor patient-selection state
  const [patients, setPatients]           = useState([])
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [patientSearch, setPatientSearch] = useState('')
  const [loadingPatients, setLoadingPatients] = useState(false)
  const [showPatientPicker, setShowPatientPicker] = useState(false)

  const analyserRef = useRef(null)
  const rafRef      = useRef(null)
  const audioCtxRef = useRef(null)
  const processorRef = useRef(null)
  const streamRef   = useRef(null)
  const startRef    = useRef(null)
  const audioChunksRef = useRef([])
  const sampleRateRef  = useRef(44100)
  const recRef      = useRef(false)
  const pollRef     = useRef(null)
  const speechRecRef = useRef(null)   // browser SpeechRecognition — live display only
  const liveTranscriptRef = useRef(null)

  const supported = typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

  // ─── Real-time orchestrator log display ─────────────────────────────
  const [orchestratorLogs, setOrchestratorLogs] = useState([])

  useEffect(() => {
    if (!jobId || !on) return
    // Logs are emitted to user:{id} rooms (always joined on auth) so no
    // extra room-join handshake is needed — just subscribe to the event.
    const unsub = on('orchestrator:log', (log) => {
      // Only accept logs belonging to the current job
      if (log.job_id && log.job_id !== jobId) return
      setOrchestratorLogs((prev) => {
        const key = `${log.stage}|${log.message}`
        if (prev.some(item => `${item.stage}|${item.message}` === key)) return prev
        return [...prev, log].slice(-100)
      })
    })
    return unsub
  }, [jobId, on])

  // Load history
  useEffect(() => {
    chatApi.history?.()
      .then(r => setSessions(r?.data || []))
      .catch(() => {})
      .finally(() => setLoadHist(false))
    if (!supported) setStatus('unsupported')
  }, [])

  // Load patients list for doctor
  useEffect(() => {
    if (!isDoctor) return
    setLoadingPatients(true)
    usersApi.patients('')
      .then(r => setPatients(r?.data || []))
      .catch(() => {})
      .finally(() => setLoadingPatients(false))
  }, [isDoctor])

  // Listen for SOP socket notifications
  useEffect(() => {
    const unsub = on('notification:received', (data) => {
      if (data.type === 'sop:approved') {
        setNotification({ type: 'success', msg: data.message })
        setTimeout(() => setNotification(null), 6000)
      } else if (data.type === 'sop:rejected') {
        setNotification({ type: 'warning', msg: data.message })
        setTimeout(() => setNotification(null), 6000)
      }
    })
    return unsub
  }, [on])

  useEffect(() => {
    if (!liveTranscriptRef.current) return
    liveTranscriptRef.current.scrollTop = liveTranscriptRef.current.scrollHeight
  }, [liveText, recording])

  // Amplitude loop
  const startLoop = useCallback(() => {
    if (!analyserRef.current) return
    const a   = analyserRef.current
    const buf = new Uint8Array(a.frequencyBinCount)
    const tick = () => {
      a.getByteFrequencyData(buf)
      setAmplitude(Array.from(buf.slice(0, 42)).map(v => v / 255))
      rafRef.current = requestAnimationFrame(tick)
    }
    tick()
  }, [])
  const stopLoop = () => { cancelAnimationFrame(rafRef.current); setAmplitude([]) }

  // ─── Start recording ────────────────────────────────────────────────────
  const startRec = async () => {
    if (!supported || recRef.current) return
    audioChunksRef.current = []
    setLiveText('')
    setStatus('listening')
    startRef.current = Date.now(); recRef.current = true; setRecording(true)

    try {
      const s = await navigator.mediaDevices.getUserMedia(MIC_CAPTURE_CONSTRAINTS)
      streamRef.current = s

      // Waveform analyser (kept for visualisation only)
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      audioCtxRef.current = ctx
      const src = ctx.createMediaStreamSource(s)
      const an  = ctx.createAnalyser(); an.fftSize = 128
      src.connect(an)
      analyserRef.current = an
      startLoop()

      // MediaRecorder — much more reliable than deprecated ScriptProcessorNode
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : ''
      const recorder = new MediaRecorder(s, mimeType ? { mimeType } : {})
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data)
      }
      processorRef.current = recorder
      recorder.start(250) // collect a chunk every 250 ms

      // ── Live display: browser SpeechRecognition (interim results only) ──
      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition
      if (SpeechRec) {
        const rec = new SpeechRec()
        rec.continuous = true
        rec.interimResults = true
        rec.lang = 'en-IN'
        let finalSoFar = ''
        rec.onresult = (event) => {
          let interim = ''
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const t = event.results[i][0].transcript
            if (event.results[i].isFinal) finalSoFar += t + ' '
            else interim += t
          }
          setLiveText((finalSoFar + interim).trimStart())
        }
        rec.onerror = () => {}
        rec.onend = () => {}
        speechRecRef.current = rec
        try { rec.start() } catch (_) {}
      }
    } catch (_) {
      recRef.current = false; setRecording(false); setStatus('idle')
    }
  }

  // ─── Stop recording + trigger orchestrator ──────────────────────────────
  const stopRec = async () => {
    recRef.current = false; setRecording(false)
    stopLoop()

    // Stop live-display SpeechRecognition (best-effort)
    try { speechRecRef.current?.stop() } catch (_) {}
    speechRecRef.current = null

    const durationSec = Math.round((Date.now() - startRef.current) / 1000)

    // Stop MediaRecorder and wait for its final `dataavailable` / `stop` event
    await new Promise((resolve) => {
      const recorder = processorRef.current
      if (recorder && recorder.state !== 'inactive') {
        recorder.onstop = resolve
        recorder.stop()
      } else {
        resolve()
      }
    })
    processorRef.current = null

    streamRef.current?.getTracks().forEach(t => t.stop())
    try { await audioCtxRef.current?.close() } catch (_) {}
    audioCtxRef.current = null

    if (!audioChunksRef.current.length) { setStatus('idle'); return }

    setStatus('transcribing')

    try {
      // Decode WebM/Opus → 16 kHz mono PCM → WAV entirely in the browser.
      // This avoids any server-side ffmpeg / GStreamer dependency and gives
      // Azure Speech REST API a format it handles perfectly.
      const webmBlob = new Blob(audioChunksRef.current, { type: audioChunksRef.current[0]?.type || 'audio/webm' })
      audioChunksRef.current = []
      const arrayBuffer = await webmBlob.arrayBuffer()
      const decodeCtx = new AudioContext({ sampleRate: 16000 })
      let audioBuffer
      try {
        audioBuffer = await decodeCtx.decodeAudioData(arrayBuffer)
      } finally {
        decodeCtx.close().catch(() => {})
      }
      const wavBlob = encodeWavBlob(audioBuffer.getChannelData(0), 16000)

      const formData = new FormData()
      formData.append('audio', wavBlob, 'consultation.wav')
      formData.append('language', 'en-IN')

      const transcription = await orchestratorApi.transcribeAudio(formData)
      const transcript = (transcription?.transcript || '').trim()

      if (!transcript) {
        setStatus('idle')
        setNotification({
          type: 'warning',
          msg: 'No speech was detected. Please try recording again.',
        })
        setTimeout(() => setNotification(null), 5000)
        return
      }

      setLiveText(transcript)

      // Save to session history (local)
      const sessionEntry = {
        id:          Date.now(),
        transcript,
        durationSec,
        createdAt:   new Date().toISOString(),
        wordCount:   transcript.split(/\s+/).filter(Boolean).length,
      }
      setSessions(p => [sessionEntry, ...p])

      // ─── Trigger Orchestrator Pipeline ─────────────────────────────────
      setStatus('processing')
      setPipelineActive(true)
      setPipelineStage('conversational')
      setPipelineProgress(5)
      setPipelineStatus('running')
      setSopId(null)
      setOrchestratorLogs([])

      const res = await orchestratorApi.trigger(transcript, durationSec, selectedPatient?.id || selectedPatient?._id || undefined)
      const jid = res.jobId
      setJobId(jid)
      setOrchestratorLogs([])  // clear logs from previous job
      startPolling(jid)
    } catch (err) {
      setStatus('error')
      setPipelineStatus('error')
      setTimeout(() => { setStatus('idle'); setPipelineActive(false) }, 4000)
    }
  }

  // ─── Poll job status ────────────────────────────────────────────────────
  const startPolling = (jid) => {
    if (pollRef.current) clearInterval(pollRef.current)
    let shownPurged = false
    pollRef.current = setInterval(async () => {
      try {
        const data = await orchestratorApi.getStatus(jid)
        if (Array.isArray(data.logs)) {
          setOrchestratorLogs((prev) => {
            const seen = new Set(prev.map(log => `${log.timestamp || ''}|${log.stage}|${log.message}`))
            const merged = [...prev]
            data.logs.forEach((log) => {
              const key = `${log.timestamp || ''}|${log.stage}|${log.message}`
              if (!seen.has(key)) {
                seen.add(key)
                merged.push(log)
              }
            })
            return merged.slice(-100)
          })
        }

        // When transitioning from summarizer → publishing, show "purged" step first
        if (data.stage === 'publishing' && !shownPurged) {
          shownPurged = true
          setPipelineStage('purged')
          setPipelineProgress(data.progress)
          setTimeout(() => {
            setPipelineStage('publishing')
          }, 1800)
        } else if (data.stage !== 'publishing' || shownPurged) {
          setPipelineStage(data.stage)
          setPipelineProgress(data.progress)
        }
        setPipelineStatus(data.status)

        if (data.status === 'complete') {
          clearInterval(pollRef.current)
          setSopId(data.sopId)
          setDoctorName(data.doctorName || 'your doctor')
          setStatus('idle')
          // Show toast notification
          setNotification({
            type: 'info',
            msg:  isDoctor
              ? 'SOAP note created! Please review and approve.'
              : `Health summary created! Sent to ${fmtDoctor(data.doctorName)} for review.`,
          })
          setTimeout(() => setNotification(null), 8000)
        } else if (data.status === 'error') {
          clearInterval(pollRef.current)
          setPipelineStatus('error')
          setStatus('error')
          setNotification({
            type: 'warning',
            msg: data.error || 'Something went wrong. Please try again.',
          })
          setTimeout(() => { setNotification(null); setStatus('idle'); setPipelineActive(false) }, 7000)
        }
      } catch (_) {}
    }, 1500)
  }

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  const toggle = () => {
    if (pipelineActive && pipelineStatus === 'complete') {
      setPipelineActive(false); setSopId(null); setPipelineStatus('running')
    }
    recording ? stopRec() : startRec()
  }

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(sessions, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url; a.download = `voice-transcripts-${Date.now()}.json`; a.click()
    URL.revokeObjectURL(url)
  }

  const words = liveText.split(' ').filter(Boolean)

  // Patient / non-doctor: show AI assistant chat
  if (!isDoctor) return <PatientAssistant />

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', overflow: 'hidden', fontFamily: "'DM Sans',sans-serif" }}>
      {/* Background */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, background: 'linear-gradient(135deg,#0c0c1e 0%,#0a0e28 55%,#0d1630 100%)' }} />
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, background: 'radial-gradient(ellipse 55% 45% at 18% 0%,rgba(120,80,255,0.20) 0%,transparent 100%)' }} />
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, background: 'radial-gradient(ellipse 38% 38% at 88% 88%,rgba(30,100,255,0.14) 0%,transparent 100%)' }} />
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, background: 'radial-gradient(ellipse 28% 28% at 50% 55%,rgba(34,211,238,0.07) 0%,transparent 100%)' }} />

      {/* Toast Notification */}
      {notification && (
        <div style={{
          position: 'fixed', top: 80, right: 24, zIndex: 999,
          maxWidth: 360, padding: '12px 16px',
          background: notification.type === 'success' ? 'rgba(52,211,153,0.15)' : notification.type === 'warning' ? 'rgba(251,191,36,0.15)' : 'rgba(96,165,250,0.15)',
          border: `1px solid ${notification.type === 'success' ? 'rgba(52,211,153,0.35)' : notification.type === 'warning' ? 'rgba(251,191,36,0.35)' : 'rgba(96,165,250,0.35)'}`,
          borderRadius: 14,
          display: 'flex', alignItems: 'flex-start', gap: 10,
          animation: 'vaSlideIn 0.35s cubic-bezier(0.34,1.56,0.64,1)',
          backdropFilter: 'blur(12px)',
        }}>
          <Bell size={14} color={notification.type === 'success' ? '#34d399' : notification.type === 'warning' ? '#fbbf24' : '#60a5fa'} style={{ marginTop: 2, flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>{notification.msg}</p>
          <button onClick={() => setNotification(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 14, lineHeight: 1, flexShrink: 0 }}>×</button>
        </div>
      )}

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 12, background: 'linear-gradient(135deg,#7c3aed,#2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 18px rgba(124,58,237,0.45)' }}>
              <Mic size={15} color="white" />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.9)', fontFamily: "'Sora',sans-serif" }}>AI Conversation Capture</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', display: 'inline-block', background: recording ? '#f87171' : pipelineActive ? '#fbbf24' : '#34d399', animation: (recording || pipelineActive) ? 'vaPulse 1s ease-in-out infinite' : 'none' }} />
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.04em' }}>
                  {recording ? 'Recording live…' : pipelineActive && pipelineStatus !== 'complete' ? 'Processing your consultation…' : pipelineStatus === 'complete' ? 'Awaiting approval' : 'Ready to record'}
                </span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {sessions.length > 0 && (
              <>
                <button onClick={exportJSON} style={{ height: 32, padding: '0 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: 5 }} onMouseEnter={e => e.currentTarget.style.color = 'white'} onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}>
                  <Download size={11} />Export
                </button>
                <button onClick={() => setSessions([])} style={{ height: 32, padding: '0 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.38)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Trash2 size={11} />Clear
                </button>
              </>
            )}
          </div>
        </div>

        {/* Main area */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 24px 0', gap: 18, overflowY: 'auto' }}>

          {/* Title */}
          {!pipelineActive && (
            <div style={{ textAlign: 'center', lineHeight: 1.15 }}>
              <h2 style={{ fontSize: 'clamp(20px,3vw,28px)', fontWeight: 800, margin: 0, color: 'rgba(255,255,255,0.92)', fontFamily: "'Sora',sans-serif" }}>
                {recording ? 'Listening…' : status === 'transcribing' ? 'Transcribing…' : status === 'processing' ? 'Getting started…' : 'AI Conversation Capture'}
              </h2>
              <p style={{ fontSize: 'clamp(16px,2.2vw,22px)', fontWeight: 700, margin: '5px 0 0', fontFamily: "'Sora',sans-serif", background: 'linear-gradient(90deg,#a78bfa,#60a5fa,#22d3ee)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                {recording ? 'Speak clearly — recording conversation' : status === 'transcribing' ? 'Transcribing with Azure Speech…' : status === 'processing' ? 'Submitting your consultation…' : isDoctor ? 'Select a patient and record consultation' : 'Record your conversation now'}
              </p>
            </div>
          )}

          {/* Doctor: Patient Selector */}
          {isDoctor && !pipelineActive && !recording && (
            <div style={{ width: '100%', maxWidth: 500 }}>
              {/* Selected patient badge or picker trigger */}
              {selectedPatient ? (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                  background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)',
                  borderRadius: 14,
                }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg,#34d399,#10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <User size={14} color="white" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#34d399' }}>{selectedPatient.name}</p>
                    <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Patient selected for this consultation</p>
                  </div>
                  <button
                    onClick={() => { setSelectedPatient(null); setShowPatientPicker(true) }}
                    style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}
                  >Change</button>
                </div>
              ) : (
                <button
                  onClick={() => setShowPatientPicker(true)}
                  style={{
                    width: '100%', padding: '12px 16px', borderRadius: 14,
                    border: '1px dashed rgba(167,139,250,0.4)', background: 'rgba(167,139,250,0.08)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(167,139,250,0.7)'; e.currentTarget.style.background = 'rgba(167,139,250,0.14)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(167,139,250,0.4)'; e.currentTarget.style.background = 'rgba(167,139,250,0.08)' }}
                >
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(167,139,250,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <User size={14} color="#a78bfa" />
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#a78bfa' }}>Select Patient</p>
                    <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>Choose the patient for this consultation</p>
                  </div>
                  <ChevronRight size={14} color="#a78bfa" style={{ marginLeft: 'auto' }} />
                </button>
              )}

              {/* Patient picker dropdown */}
              {showPatientPicker && (
                <div style={{
                  marginTop: 8, borderRadius: 14, overflow: 'hidden',
                  background: 'rgba(15,15,40,0.95)', border: '1px solid rgba(255,255,255,0.12)',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
                }}>
                  {/* Search */}
                  <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Search size={13} color="rgba(255,255,255,0.35)" />
                    <input
                      value={patientSearch}
                      onChange={e => setPatientSearch(e.target.value)}
                      placeholder="Search patient by name…"
                      autoFocus
                      style={{
                        flex: 1, background: 'transparent', border: 'none', outline: 'none',
                        color: 'rgba(255,255,255,0.85)', fontSize: 12, fontFamily: 'inherit',
                      }}
                    />
                    <button onClick={() => { setShowPatientPicker(false); setPatientSearch('') }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>×</button>
                  </div>
                  {/* List */}
                  <div style={{ maxHeight: 200, overflowY: 'auto', padding: '6px' }}>
                    {loadingPatients ? (
                      <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}>
                        <Loader2 size={16} color="rgba(255,255,255,0.3)" style={{ animation: 'spin 1s linear infinite' }} />
                      </div>
                    ) : (
                      patients
                        .filter(p => !patientSearch || p.name.toLowerCase().includes(patientSearch.toLowerCase()))
                        .map(p => (
                          <div
                            key={p.id || p._id}
                            onClick={() => { setSelectedPatient(p); setShowPatientPicker(false); setPatientSearch('') }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                              borderRadius: 10, cursor: 'pointer', transition: 'background 0.15s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#7c3aed,#2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <span style={{ fontSize: 10, fontWeight: 700, color: 'white' }}>{p.initials || p.name?.charAt(0)}</span>
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.85)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</p>
                              {p.phone && <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{p.phone}</p>}
                            </div>
                            {p.condition && <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 6 }}>{p.condition}</span>}
                          </div>
                        ))
                    )}
                    {!loadingPatients && patients.filter(p => !patientSearch || p.name.toLowerCase().includes(patientSearch.toLowerCase())).length === 0 && (
                      <p style={{ margin: 0, textAlign: 'center', padding: 16, fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>No patients found</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Pipeline progress (when active) */}

          {pipelineActive && (
            <>
              <PipelineProgress
                stage={pipelineStage}
                progress={pipelineProgress}
                jobStatus={pipelineStatus}
                sopId={sopId}
                doctorName={doctorName}
                onViewSOP={() => navigate('/sop')}
                isDoctor={isDoctor}
              />
              {/* Live agent log — always visible during processing */}
              <div
                ref={el => { if (el) el.scrollTop = el.scrollHeight }}
                style={{
                  width: '100%', maxWidth: 520,
                  maxHeight: 160, minHeight: 52,
                  overflowY: 'auto',
                  background: 'rgba(0,0,0,0.28)',
                  border: '1px solid rgba(167,139,250,0.18)',
                  borderRadius: 12,
                  padding: '10px 14px',
                  fontSize: 11,
                  fontFamily: 'monospace',
                  lineHeight: 1.75,
                }}>
                {orchestratorLogs.length === 0 ? (
                  <span style={{ color: 'rgba(167,139,250,0.38)' }}>● Waiting for agent logs…</span>
                ) : (
                  orchestratorLogs.map((log, i) => (
                    <div key={i} style={{
                      color: log.level === 'error'    ? '#f87171'
                           : log.stage === 'complete' ? '#34d399'
                           : '#a78bfa',
                      marginBottom: 1,
                    }}>
                      <span style={{ opacity: 0.4 }}>[{log.stage}]</span>{' '}{log.message}
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {/* Waveform */}
          {!pipelineActive && (
            <div style={{ width: '100%', maxWidth: 500, position: 'relative' }}>
              <div style={{ borderRadius: 24, padding: '22px 18px', background: recording ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)', border: recording ? '1px solid rgba(139,92,246,0.40)' : '1px solid rgba(255,255,255,0.06)', boxShadow: recording ? '0 0 60px rgba(139,92,246,0.18),inset 0 0 30px rgba(139,92,246,0.06)' : 'none', transition: 'all 0.4s ease' }}>
                <WaveformBars active={recording} amplitude={amplitude} />
              </div>
              {recording && <div style={{ position: 'absolute', inset: -3, borderRadius: 27, border: '1px solid rgba(139,92,246,0.22)', animation: 'vaRing 2s ease-in-out infinite', pointerEvents: 'none' }} />}
            </div>
          )}

          {/* Live transcript */}
          {!pipelineActive && (
            <div ref={liveTranscriptRef} style={{ width: '100%', maxWidth: 500, maxHeight: 180, minHeight: 72, overflowY: 'auto', borderRadius: 16, padding: liveText ? '13px 17px' : 0, background: liveText ? 'rgba(255,255,255,0.07)' : 'transparent', border: liveText ? '1px solid rgba(255,255,255,0.11)' : '1px solid transparent', transition: 'all 0.3s ease' }}>
              {liveText ? (
                <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.84)', lineHeight: 1.75, fontWeight: 300, letterSpacing: '0.02em', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                  {words.map((w, i) => (
                    <span key={`${i}-${w}`} style={{ display: 'inline', animation: 'vaWordIn 0.18s ease forwards', opacity: 0, animationFillMode: 'forwards', animationDelay: `${i * 12}ms` }}>{w}{' '}</span>
                  ))}
                  {recording && <span style={{ display: 'inline-block', width: 2, height: 14, background: '#a78bfa', marginLeft: 2, verticalAlign: 'text-bottom', animation: 'vaCaret 1s step-end infinite' }} />}
                </p>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 72 }}>
                  {status === 'unsupported'
                    ? <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f87171', fontSize: 12 }}><AlertCircle size={14} />Enable microphone access in your browser</span>
                    : status === 'transcribing'
                      ? <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.4)', fontSize: 12 }}><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />Transcribing your audio…</span>
                      : status === 'processing'
                      ? <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.4)', fontSize: 12 }}><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />Sending your consultation…</span>
                      : <p style={{ margin: 0, color: 'rgba(255,255,255,0.18)', fontSize: 12, textAlign: 'center' }}>Your transcript will appear here after recording ends…</p>
                  }
                </div>
              )}
            </div>
          )}

          {/* Mic button */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, paddingBottom: 4 }}>
            <button
              onClick={toggle}
              disabled={!supported || status === 'transcribing' || status === 'processing' || (pipelineActive && pipelineStatus === 'running') || (isDoctor && !selectedPatient && !recording)}
              style={{
                width: 80, height: 80, borderRadius: '50%', border: 'none', flexShrink: 0,
                cursor: (supported && status !== 'transcribing' && status !== 'processing' && !(pipelineActive && pipelineStatus === 'running') && !(isDoctor && !selectedPatient && !recording)) ? 'pointer' : 'not-allowed',
                background: recording ? 'linear-gradient(135deg,#ef4444,#dc2626)' : 'linear-gradient(135deg,#7c3aed,#2563eb)',
                boxShadow: recording ? '0 0 44px rgba(239,68,68,0.6),0 8px 28px rgba(239,68,68,0.4)' : '0 0 44px rgba(124,58,237,0.55),0 8px 28px rgba(37,99,235,0.35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
                transform: recording ? 'scale(1.1)' : 'scale(1)',
                transition: 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)',
                opacity: (!supported || status === 'transcribing' || status === 'processing' || (pipelineActive && pipelineStatus === 'running') || (isDoctor && !selectedPatient && !recording)) ? 0.4 : 1,
              }}
            >
              {recording && (
                <>
                  <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid rgba(239,68,68,0.55)', animation: 'vaRing 1.4s ease-in-out infinite' }} />
                  <span style={{ position: 'absolute', inset: -14, borderRadius: '50%', border: '1px solid rgba(239,68,68,0.22)', animation: 'vaRing 1.4s ease-in-out 0.45s infinite' }} />
                </>
              )}
              {status === 'transcribing' || status === 'processing'
                ? <Loader2 size={28} color="white" style={{ animation: 'spin 1s linear infinite' }} />
                : recording
                  ? <MicOff size={28} color="white" />
                  : <Mic size={28} color="white" />
              }
            </button>
            <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.24)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              {recording ? 'Tap to stop & process' : status === 'transcribing' ? 'Transcribing audio…' : pipelineActive && pipelineStatus === 'running' ? 'Processing your consultation…' : (isDoctor && !selectedPatient) ? 'Select a patient first' : 'Tap to record'}
            </p>
          </div>
        </div>

        {/* Session history */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', flexShrink: 0, maxHeight: '22vh', minHeight: 44 }}>
          <div style={{ padding: '10px 24px 8px' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Transcripts · {sessions.length}</span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {loadingHist
              ? <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}><Loader2 size={18} color="rgba(255,255,255,0.22)" style={{ animation: 'spin 1s linear infinite' }} /></div>
              : sessions.length === 0
                ? <p style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.18)', padding: '14px 0', margin: 0 }}>No transcripts yet — start speaking!</p>
                : sessions.map(s => (
                    <SessionCard
                      key={s._id || s.id}
                      session={s}
                      onDelete={id => setSessions(p => p.filter(x => (x._id || x.id) !== id))}
                    />
                  ))
            }
          </div>
        </div>
      </div>

      <style>{`
        @keyframes vaPulse{0%,100%{opacity:1}50%{opacity:0.25}}
        @keyframes vaRing{0%{opacity:0.65;transform:scale(1)}100%{opacity:0;transform:scale(1.13)}}
        @keyframes vaWordIn{0%{opacity:0;transform:translateY(5px)}100%{opacity:1;transform:translateY(0)}}
        @keyframes vaCaret{0%,100%{opacity:1}50%{opacity:0}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes vaSlideIn{0%{opacity:0;transform:translateX(24px)}100%{opacity:1;transform:translateX(0)}}
      `}</style>
    </div>
  )
}


