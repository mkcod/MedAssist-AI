import { useState, useRef, useEffect, useCallback } from 'react'
import { Mic, MicOff, Download, Trash2, Loader2, Stethoscope, UserRound, Radio, Upload, FileAudio, X, ChevronRight, Copy, Check, ArrowLeftRight } from 'lucide-react'

const SPEAKERS = {
  doctor: { label: 'Doctor', color: '#818cf8', bubble: 'rgba(99,102,241,0.15)', border: 'rgba(99,102,241,0.30)', bg: 'rgba(99,102,241,0.20)', side: 'right' },
  patient: { label: 'Patient', color: '#34d399', bubble: 'rgba(52,211,153,0.11)', border: 'rgba(52,211,153,0.26)', bg: 'rgba(52,211,153,0.18)', side: 'left' },
}

// ── Waveform bars ─────────────────────────────────────────────────────────────
function Waveform({ amplitude, speaker, active }) {
  const sp = SPEAKERS[speaker] || SPEAKERS.doctor
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2.5, height: 40 }}>
      {Array.from({ length: 28 }, (_, i) => {
        const amp = amplitude[i % Math.max(amplitude.length, 1)] || 0
        const h = active ? 3 + amp * 30 + Math.sin(i * 0.55) * 4 : 3 + Math.sin(i * 0.4) * 2
        return (
          <div key={i} style={{
            width: 3, height: Math.max(2, h),
            background: sp.color, borderRadius: 4,
            opacity: active ? 0.35 + amp * 0.65 : 0.15,
            transition: 'height 65ms ease, opacity 65ms ease',
          }} />
        )
      })}
    </div>
  )
}

// ── Chat bubble ───────────────────────────────────────────────────────────────
function Bubble({ msg }) {
  const sp = SPEAKERS[msg.speaker]
  const isRight = sp.side === 'right'
  const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isRight ? 'flex-end' : 'flex-start', marginBottom: 10, animation: 'fadeUp 0.22s ease forwards', opacity: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3, flexDirection: isRight ? 'row-reverse' : 'row' }}>
        <div style={{ width: 24, height: 24, borderRadius: '50%', background: sp.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {msg.speaker === 'doctor' ? <Stethoscope size={11} color={sp.color} /> : <UserRound size={11} color={sp.color} />}
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, color: sp.color, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{sp.label}</span>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.22)' }}>{time}</span>
        {msg.source === 'upload' && (
          <span style={{ fontSize: 9, background: 'rgba(255,255,255,0.06)', borderRadius: 4, padding: '1px 5px', color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', gap: 3 }}>
            <FileAudio size={8} /> audio
          </span>
        )}
        {msg.source === 'live' && (
          <span style={{ fontSize: 9, background: 'rgba(255,255,255,0.05)', borderRadius: 4, padding: '1px 5px', color: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', gap: 3 }}>
            <Radio size={8} /> live
          </span>
        )}
      </div>
      <div style={{ maxWidth: '74%', padding: '9px 13px', borderRadius: isRight ? '16px 4px 16px 16px' : '4px 16px 16px 16px', background: sp.bubble, border: `1px solid ${sp.border}` }}>
        <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.7, fontWeight: 300, letterSpacing: '0.01em' }}>{msg.text}</p>
      </div>
      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.18)', marginTop: 2 }}>✓ saved</span>
    </div>
  )
}

// ── Live strip shown while speaking ──────────────────────────────────────────
function LiveStrip({ speaker, text }) {
  const sp = SPEAKERS[speaker]
  if (!text) return null
  return (
    <div style={{ margin: '0 0 8px', padding: '8px 12px', borderRadius: 10, background: `linear-gradient(90deg,${sp.bubble},rgba(0,0,0,0))`, border: `1px solid ${sp.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: sp.color, flexShrink: 0, animation: 'pulse 1s ease-in-out infinite' }} />
      <span style={{ fontSize: 10, fontWeight: 700, color: sp.color, textTransform: 'uppercase', letterSpacing: '0.07em', flexShrink: 0 }}>{sp.label}:</span>
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, fontWeight: 300 }}>{text}</span>
      <span style={{ display: 'inline-block', width: 2, height: 12, background: sp.color, marginLeft: 2, flexShrink: 0, animation: 'caret 0.9s step-end infinite' }} />
    </div>
  )
}

// ── Speaker Switch Button ─────────────────────────────────────────────────────
function SwitchBtn({ currentSpeaker, onSwitch, flash }) {
  const from = SPEAKERS[currentSpeaker]
  const to = SPEAKERS[currentSpeaker === 'doctor' ? 'patient' : 'doctor']
  return (
    <button
      onClick={onSwitch}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 22px', borderRadius: 24,
        border: `1.5px solid ${from.border}`,
        background: flash ? from.bubble : 'rgba(255,255,255,0.04)',
        cursor: 'pointer',
        transition: 'all 0.18s',
        transform: flash ? 'scale(0.96)' : 'scale(1)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <div style={{ width: 20, height: 20, borderRadius: '50%', background: from.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {currentSpeaker === 'doctor' ? <Stethoscope size={10} color={from.color} /> : <UserRound size={10} color={from.color} />}
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: from.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{from.label}</span>
      </div>
      <ArrowLeftRight size={13} color="rgba(255,255,255,0.3)" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, opacity: 0.45 }}>
        <div style={{ width: 20, height: 20, borderRadius: '50%', background: to.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {currentSpeaker === 'patient' ? <Stethoscope size={10} color={to.color} /> : <UserRound size={10} color={to.color} />}
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color: to.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{to.label}</span>
      </div>
    </button>
  )
}

// ── Upload overlay ────────────────────────────────────────────────────────────
function UploadOverlay({ filename }) {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 10, background: 'rgba(9,13,34,0.9)', backdropFilter: 'blur(14px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
      <div style={{ width: 68, height: 68, borderRadius: '50%', background: 'rgba(99,102,241,0.14)', border: '1.5px solid rgba(99,102,241,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'pulse 1.2s ease-in-out infinite' }}>
        <FileAudio size={28} color="#818cf8" />
      </div>
      <div style={{ textAlign: 'center' }}>
        <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>Transcribing Audio…</p>
        <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{filename}</p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {['Detecting speakers', 'Labelling turns', 'Building conversation'].map((s, i) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', animation: `fadeIn 0.5s ${i * 0.5}s both` }}>{s}</span>
            {i < 2 && <ChevronRight size={10} color="rgba(255,255,255,0.15)" />}
          </div>
        ))}
      </div>
      <Loader2 size={18} color="rgba(99,102,241,0.6)" style={{ animation: 'spin 1s linear infinite' }} />
    </div>
  )
}

// ── JSON panel ────────────────────────────────────────────────────────────────
function JSONPanel({ messages, onClose, onDownload }) {
  const [copied, setCopied] = useState(false)
  const payload = {
    sessionDate: new Date().toISOString(),
    totalMessages: messages.length,
    doctorMessages: messages.filter(m => m.speaker === 'doctor').length,
    patientMessages: messages.filter(m => m.speaker === 'patient').length,
    conversation: messages.map((m, i) => ({
      index: i + 1,
      speaker: SPEAKERS[m.speaker].label,
      text: m.text,
      timestamp: m.createdAt,
      source: m.source || 'microphone',
    })),
  }
  const jsonStr = JSON.stringify(payload, null, 2)

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonStr)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 20, background: 'rgba(5,8,20,0.97)', backdropFilter: 'blur(16px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399' }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Consultation JSON</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleCopy} style={{ display: 'flex', alignItems: 'center', gap: 5, height: 28, padding: '0 10px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', cursor: 'pointer', fontSize: 11, color: copied ? '#34d399' : 'rgba(255,255,255,0.45)', transition: 'color 0.2s' }}>
            {copied ? <Check size={11} /> : <Copy size={11} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button onClick={onDownload} style={{ display: 'flex', alignItems: 'center', gap: 5, height: 28, padding: '0 10px', borderRadius: 7, border: '1px solid rgba(99,102,241,0.35)', background: 'rgba(99,102,241,0.1)', cursor: 'pointer', fontSize: 11, color: '#818cf8' }}>
            <Download size={11} /> Download
          </button>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid rgba(255,255,255,0.07)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={13} color="rgba(255,255,255,0.4)" />
          </button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 1, padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
        {[
          { label: 'Total', value: payload.totalMessages, color: 'rgba(255,255,255,0.5)' },
          { label: 'Doctor', value: payload.doctorMessages, color: '#818cf8' },
          { label: 'Patient', value: payload.patientMessages, color: '#34d399' },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, textAlign: 'center', padding: '6px 0', borderRadius: 6, background: 'rgba(255,255,255,0.02)' }}>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: s.color }}>{s.value}</p>
            <p style={{ margin: 0, fontSize: 9, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{s.label}</p>
          </div>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        <pre style={{ margin: 0, fontSize: 11, lineHeight: 1.8, fontFamily: "'Fira Code','Cascadia Code',monospace", whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {jsonStr.split('\n').map((line, i) => {
            let color = 'rgba(255,255,255,0.45)'
            if (line.includes('"Doctor"')) color = '#818cf8'
            if (line.includes('"Patient"')) color = '#34d399'
            if (line.includes('"text"')) color = 'rgba(255,255,255,0.75)'
            if (line.includes('"speaker"')) color = 'rgba(255,255,255,0.55)'
            if (line.match(/^\s*[{}\[\],]/)) color = 'rgba(255,255,255,0.18)'
            return <span key={i} style={{ color, display: 'block' }}>{line}</span>
          })}
        </pre>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AIChat() {
  const [recording, setRecording] = useState(false)
  const [messages, setMessages] = useState([])
  const [liveText, setLiveText] = useState('')
  const [currentSpeaker, setCurrentSpeaker] = useState('doctor') // always start doctor
  const [amplitude, setAmplitude] = useState([])
  const [status, setStatus] = useState('idle')
  const [switchFlash, setSwitchFlash] = useState(false)
  const [audioUploading, setAudioUploading] = useState(false)
  const [uploadFilename, setUploadFilename] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [showJSON, setShowJSON] = useState(false)

  const recogRef = useRef(null)
  const analyserRef = useRef(null)
  const rafRef = useRef(null)
  const audioCtxRef = useRef(null)
  const streamRef = useRef(null)
  const recRef = useRef(false)
  const finalRef = useRef('')
  const speakerRef = useRef('doctor')
  const bottomRef = useRef(null)
  const fileInputRef = useRef(null)

  const supported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, liveText])

  // ── Commit current segment as a saved message ──────────────────────────────
  const commitSegment = useCallback((text, speaker) => {
    const trimmed = text.trim()
    if (!trimmed || trimmed.length < 2) return
    setMessages(prev => [...prev, {
      id: Date.now() + Math.random(),
      speaker,
      text: trimmed,
      createdAt: new Date().toISOString(),
      source: 'live',
    }])
    finalRef.current = ''
    setLiveText('')
  }, [])

  // ── Manual speaker switch — no silence timer, purely on tap ───────────────
  const switchSpeaker = useCallback(() => {
    const text = finalRef.current.trim()
    const current = speakerRef.current
    if (text) commitSegment(text, current)          // save whatever was spoken
    const next = current === 'doctor' ? 'patient' : 'doctor'
    speakerRef.current = next
    setCurrentSpeaker(next)
    setSwitchFlash(true)
    setTimeout(() => setSwitchFlash(false), 180)
  }, [commitSegment])

  // ── Amplitude loop — visual only, no silence detection ────────────────────
  const startAmplitudeLoop = useCallback(() => {
    if (!analyserRef.current) return
    const analyser = analyserRef.current
    const buf = new Uint8Array(analyser.frequencyBinCount)
    const tick = () => {
      analyser.getByteFrequencyData(buf)
      setAmplitude(Array.from(buf.slice(0, 28)).map(v => v / 255))
      rafRef.current = requestAnimationFrame(tick)
    }
    tick()
  }, [])

  // ── Start recording ────────────────────────────────────────────────────────
  const startRecording = async () => {
    if (!supported || recRef.current) return
    finalRef.current = ''
    speakerRef.current = 'doctor'      // always doctor first
    setCurrentSpeaker('doctor')
    setLiveText('')
    setStatus('listening')
    recRef.current = true
    setRecording(true)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      audioCtxRef.current = ctx
      const src = ctx.createMediaStreamSource(stream)
      const an = ctx.createAnalyser()
      an.fftSize = 64
      src.connect(an)
      analyserRef.current = an
      startAmplitudeLoop()
    } catch {
      setStatus('error'); recRef.current = false; setRecording(false); return
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const r = new SR()
    recogRef.current = r
    r.continuous = true
    r.interimResults = true
    r.lang = 'en-IN'
    r.maxAlternatives = 1

    r.onresult = e => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalRef.current += e.results[i][0].transcript + ' '
        else interim = e.results[i][0].transcript
      }
      setLiveText(finalRef.current + interim)
    }
    r.onerror = e => { if (e.error !== 'no-speech') setStatus('error') }
    r.onend = () => { if (recRef.current) r.start() }   // keep alive continuously
    r.start()
  }

  // ── Stop recording ─────────────────────────────────────────────────────────
  const stopRecording = () => {
    recRef.current = false
    setRecording(false)
    setStatus('processing')
    cancelAnimationFrame(rafRef.current)
    setAmplitude([])
    if (recogRef.current) { recogRef.current.onend = null; recogRef.current.stop() }
    streamRef.current?.getTracks().forEach(t => t.stop())
    audioCtxRef.current?.close()
    const remaining = finalRef.current.trim()
    if (remaining) commitSegment(remaining, speakerRef.current)
    setLiveText('')
    finalRef.current = ''
    setStatus('idle')
  }

  const toggle = () => recording ? stopRecording() : startRecording()

  // ── Audio upload → Claude API transcription ────────────────────────────────
  const handleAudioUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError('')
    setUploadFilename(file.name)
    setAudioUploading(true)

    try {
      const base64 = await new Promise((res, rej) => {
        const reader = new FileReader()
        reader.onload = () => res(reader.result.split(',')[1])
        reader.onerror = () => rej(new Error('Read failed'))
        reader.readAsDataURL(file)
      })

      const mediaType = file.type || 'audio/wav'

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          messages: [{
            role: 'user',
            content: [
              { type: 'document', source: { type: 'base64', media_type: mediaType, data: base64 } },
              {
                type: 'text',
                text: `This is a doctor-patient consultation audio recording.
Transcribe the entire conversation. Identify each speaker as "doctor" or "patient".
The doctor asks clinical questions, discusses diagnosis, treatment, medications.
The patient describes symptoms and asks about their condition.

Return ONLY a raw JSON array, no explanation, no markdown:
[
  {"speaker":"doctor","text":"Good morning, what brings you in today?"},
  {"speaker":"patient","text":"I have had a fever for three days."}
]`,
              }
            ]
          }]
        })
      })

      const data = await response.json()
      const rawText = data.content?.find(c => c.type === 'text')?.text || ''
      const match = rawText.match(/\[[\s\S]*\]/)
      if (!match) throw new Error('no_json')

      const conversation = JSON.parse(match[0])
      if (!Array.isArray(conversation) || !conversation.length) throw new Error('empty')

      const now = Date.now()
      const newMsgs = conversation
        .map((item, i) => ({
          id: now + i,
          speaker: (item.speaker || '').toLowerCase().includes('doc') ? 'doctor' : 'patient',
          text: (item.text || '').trim(),
          createdAt: new Date(now + i * 2000).toISOString(),
          source: 'upload',
        }))
        .filter(m => m.text)

      setMessages(prev => [...prev, ...newMsgs])
      setTimeout(() => setShowJSON(true), 500)
    } catch (err) {
      setUploadError(
        err.message === 'empty' ? 'No conversation detected in audio.' :
          err.message === 'no_json' ? 'Could not parse transcription. Try again.' :
            'Failed to process audio. Check connection and try again.'
      )
    } finally {
      setAudioUploading(false)
      setUploadFilename('')
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // ── Export JSON download ───────────────────────────────────────────────────
  const exportJSON = () => {
    const payload = {
      sessionDate: new Date().toISOString(),
      totalMessages: messages.length,
      doctorMessages: messages.filter(m => m.speaker === 'doctor').length,
      patientMessages: messages.filter(m => m.speaker === 'patient').length,
      conversation: messages.map((m, i) => ({
        index: i + 1,
        speaker: SPEAKERS[m.speaker].label,
        text: m.text,
        timestamp: m.createdAt,
        source: m.source || 'microphone',
      })),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `consultation-${Date.now()}.json`; a.click()
    URL.revokeObjectURL(url)
  }

  const sp = SPEAKERS[currentSpeaker]

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', fontFamily: "'DM Sans',sans-serif", overflow: 'hidden' }}>

      {/* Background */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,#080814,#090d22 55%,#0b1228)' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 50% 40% at 15% 0%,rgba(99,102,241,0.18),transparent)' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 40% 40% at 90% 90%,rgba(52,211,153,0.12),transparent)' }} />

      {audioUploading && <UploadOverlay filename={uploadFilename} />}
      {showJSON && <JSONPanel messages={messages} onClose={() => setShowJSON(false)} onDownload={exportJSON} />}

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ position: 'relative', width: 44, height: 34 }}>
              <div style={{ position: 'absolute', top: 0, left: 0, width: 34, height: 34, borderRadius: '50%', background: 'rgba(99,102,241,0.2)', border: '1.5px solid rgba(99,102,241,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Stethoscope size={14} color="#818cf8" />
              </div>
              <div style={{ position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: '50%', background: 'rgba(52,211,153,0.18)', border: '1.5px solid rgba(52,211,153,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <UserRound size={12} color="#34d399" />
              </div>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.88)', fontFamily: "'Sora',sans-serif" }}>Consultation Room</p>
              <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
                {messages.length} messages · Doctor first · Manual switch
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {messages.length > 0 && (<>
              <button onClick={() => setShowJSON(true)}
                style={{ height: 30, padding: '0 12px', borderRadius: 9, border: '1px solid rgba(52,211,153,0.25)', background: 'rgba(52,211,153,0.06)', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: 'rgba(52,211,153,0.7)', display: 'flex', alignItems: 'center', gap: 5 }}>
                {'{ }'} JSON
              </button>
              <button onClick={exportJSON}
                style={{ height: 30, padding: '0 12px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.45)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Download size={11} /> Export
              </button>
              <button onClick={() => { setMessages([]); setCurrentSpeaker('doctor'); speakerRef.current = 'doctor' }}
                style={{ height: 30, padding: '0 12px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.07)', background: 'transparent', cursor: 'pointer', fontSize: 11, color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Trash2 size={11} /> Clear
              </button>
            </>)}
          </div>
        </div>

        {/* ── Error banner ─────────────────────────────────────────────────── */}
        {uploadError && (
          <div style={{ padding: '8px 20px', background: 'rgba(239,68,68,0.08)', borderBottom: '1px solid rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <span style={{ fontSize: 11, color: 'rgba(239,68,68,0.8)' }}>⚠ {uploadError}</span>
            <button onClick={() => setUploadError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: 18, lineHeight: 1 }}>×</button>
          </div>
        )}

        {/* ── Messages ────────────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 8px', display: 'flex', flexDirection: 'column' }}>
          {messages.length === 0 && !liveText && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, opacity: 0.5, textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <div>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px' }}>
                    <Stethoscope size={20} color="#818cf8" />
                  </div>
                  <span style={{ fontSize: 11, color: '#818cf8' }}>Doctor</span>
                </div>
                <ArrowLeftRight size={16} color="rgba(255,255,255,0.15)" />
                <div>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px' }}>
                    <UserRound size={20} color="#34d399" />
                  </div>
                  <span style={{ fontSize: 11, color: '#34d399' }}>Patient</span>
                </div>
              </div>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', margin: 0, lineHeight: 1.8 }}>
                Tap <strong style={{ color: 'rgba(255,255,255,0.4)' }}>mic</strong> to begin — Doctor speaks first<br />
                Tap <strong style={{ color: 'rgba(255,255,255,0.4)' }}>Switch</strong> to change speaker anytime<br />
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.14)' }}>Or upload an audio file to transcribe</span>
              </p>
            </div>
          )}

          {messages.map(msg => <Bubble key={msg.id} msg={msg} />)}
          {liveText && <LiveStrip speaker={currentSpeaker} text={liveText} />}
          <div ref={bottomRef} />
        </div>

        {/* ── Speaking indicator ───────────────────────────────────────────── */}
        {recording && (
          <div style={{ padding: '6px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, borderTop: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: sp.color, animation: 'pulse 1s ease-in-out infinite' }} />
            <span style={{ fontSize: 11, color: sp.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{sp.label} speaking</span>
          </div>
        )}

        {/* ── Controls ────────────────────────────────────────────────────── */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '12px 20px 16px', flexShrink: 0, background: 'rgba(0,0,0,0.22)', backdropFilter: 'blur(10px)' }}>

          {/* Mic row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 22 }}>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', opacity: recording ? 1 : 0.18, transition: 'opacity 0.4s' }}>
              <Waveform amplitude={amplitude} speaker={currentSpeaker} active={recording} />
            </div>

            <button onClick={toggle} disabled={audioUploading}
              style={{ width: 72, height: 72, borderRadius: '50%', border: 'none', flexShrink: 0, cursor: audioUploading ? 'not-allowed' : 'pointer', background: recording ? 'linear-gradient(135deg,#ef4444,#dc2626)' : `linear-gradient(135deg,${sp.color},${sp.color}99)`, boxShadow: recording ? '0 0 44px rgba(239,68,68,0.6)' : `0 0 44px ${sp.color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', transform: recording ? 'scale(1.1)' : 'scale(1)', transition: 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)', opacity: audioUploading ? 0.4 : 1 }}>
              {recording && <>
                <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid rgba(239,68,68,0.5)', animation: 'ring 1.4s ease-in-out infinite' }} />
                <span style={{ position: 'absolute', inset: -13, borderRadius: '50%', border: '1px solid rgba(239,68,68,0.2)', animation: 'ring 1.4s ease-in-out 0.4s infinite' }} />
              </>}
              {status === 'processing'
                ? <Loader2 size={28} color="white" style={{ animation: 'spin 1s linear infinite' }} />
                : recording ? <MicOff size={28} color="white" /> : <Mic size={28} color="white" />}
            </button>

            <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start', opacity: recording ? 1 : 0.18, transition: 'opacity 0.4s', transform: 'scaleX(-1)' }}>
              <Waveform amplitude={amplitude} speaker={currentSpeaker} active={recording} />
            </div>
          </div>

          {/* Status */}
          <p style={{ margin: '8px 0 10px', textAlign: 'center', fontSize: 11, fontWeight: 500, color: recording ? sp.color : 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase', transition: 'color 0.3s' }}>
            {!supported ? '⚠ Use Chrome or Edge'
              : recording ? `${sp.label} speaking`
                : status === 'processing' ? 'Saving…'
                  : messages.length ? 'Tap mic to continue'
                    : 'Tap mic to begin'}
          </p>

          {/* Switch speaker — only visible while recording */}
          {recording && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <SwitchBtn currentSpeaker={currentSpeaker} onSwitch={switchSpeaker} flash={switchFlash} />
            </div>
          )}

          {/* Upload audio */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <input ref={fileInputRef} type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac,.aac,.webm" style={{ display: 'none' }} onChange={handleAudioUpload} />
            <button
              onClick={() => !recording && !audioUploading && fileInputRef.current?.click()}
              disabled={recording || audioUploading}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 18px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', cursor: recording || audioUploading ? 'not-allowed' : 'pointer', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.38)', opacity: recording ? 0.3 : 1, transition: 'all 0.2s' }}
              onMouseEnter={e => { if (!recording && !audioUploading) { e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)' } }}
              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.38)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
            >
              {audioUploading
                ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Transcribing…</>
                : <><Upload size={12} /> Upload Audio</>}
            </button>
          </div>
          <p style={{ margin: '5px 0 0', textAlign: 'center', fontSize: 9, color: 'rgba(255,255,255,0.13)', letterSpacing: '0.04em' }}>
            MP3 · WAV · M4A · OGG · FLAC
          </p>
        </div>
      </div>

      <style>{`
        @keyframes ring   { 0%{opacity:0.65;transform:scale(1)}100%{opacity:0;transform:scale(1.16)} }
        @keyframes caret  { 0%,100%{opacity:1}50%{opacity:0} }
        @keyframes spin   { to{transform:rotate(360deg)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:translateY(0)} }
        @keyframes pulse  { 0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.4;transform:scale(0.85)} }
        @keyframes fadeIn { from{opacity:0}to{opacity:1} }
      `}</style>
    </div>
  )
}
