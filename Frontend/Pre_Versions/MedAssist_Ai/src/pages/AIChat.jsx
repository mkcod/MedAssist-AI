import { useState, useRef, useEffect } from 'react'
import {
  Send, Sparkles, RefreshCw, Paperclip,
  Mic, ThumbsUp, ThumbsDown, Copy,
  ChevronDown, Bot, User
} from 'lucide-react'

const SUGGESTIONS = [
  'What do my latest blood test results mean?',
  'Can I take ibuprofen with Metformin?',
  'What are symptoms of high blood pressure?',
  'Explain my HbA1c reading of 6.2%',
]

const INITIAL_MESSAGES = [
  {
    id: 1,
    role: 'assistant',
    text: "Hello Rahul! 👋 I'm your MedAssist AI — here to help you understand your health data, answer medical questions, and guide you through your care journey.\n\nRemember, I provide health information and context, but always consult your doctor for medical decisions. How can I help you today?",
    time: '9:00 AM',
  },
]

const SIMULATED_RESPONSES = {
  'blood pressure': "Your recent blood pressure readings average **122/79 mmHg**, which falls in the **Elevated** category (Stage 1 range starts at 130/80). Here's what this means:\n\n• **Systolic (122)** — slightly above ideal (<120)\n• **Diastolic (79)** — within normal range (<80)\n\nRecommendations:\n1. Reduce sodium intake below 2,300mg/day\n2. Aim for 30 min of moderate exercise daily\n3. Monitor weekly and log readings\n\nYour next cardiology appointment with Dr. Priya Nair is **tomorrow at 10:30 AM** — this would be a great topic to discuss with her.",
  'default': "That's a great question! Based on your health profile and recent records, I can see some relevant context. Let me break this down clearly for you.\n\nFor personalized guidance, your care team at MedAssist can provide detailed insights. Would you like me to:\n\n1. Pull up your relevant medical records?\n2. Schedule a consultation with a specialist?\n3. Provide general health education on this topic?\n\nRemember that this information is educational — always verify with your healthcare provider for clinical decisions.",
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-3 animate-fade-in">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-teal-500 flex items-center justify-center shrink-0">
        <Bot size={15} className="text-white" />
      </div>
      <div className="bg-white border border-[#e8effc] rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
        <div className="typing-dots flex items-center gap-1.5 h-4">
          <span /><span /><span />
        </div>
      </div>
    </div>
  )
}

function Message({ msg }) {
  const isAI = msg.role === 'assistant'
  const [liked, setLiked] = useState(null)
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard?.writeText(msg.text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const renderText = (text) => {
    return text.split('\n').map((line, i) => {
      const bold = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      return (
        <p key={i} className={`${line === '' ? 'mt-2' : ''} text-sm leading-relaxed`}
           dangerouslySetInnerHTML={{ __html: bold }} />
      )
    })
  }

  return (
    <div className={`flex items-end gap-3 ${isAI ? '' : 'flex-row-reverse'} animate-slide-up`}>
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
        isAI
          ? 'bg-gradient-to-br from-brand-500 to-teal-500'
          : 'bg-gradient-to-br from-brand-400 to-violet-500'
      }`}>
        {isAI
          ? <Bot size={15} className="text-white" />
          : <User size={15} className="text-white" />
        }
      </div>

      <div className={`max-w-[78%] space-y-1 ${isAI ? '' : 'items-end flex flex-col'}`}>
        {/* Bubble */}
        <div className={`px-4 py-3 rounded-2xl text-sm ${
          isAI
            ? 'bg-white border border-[#e8effc] shadow-sm rounded-bl-sm text-[#0f1f3d]'
            : 'bg-brand-700 text-white rounded-br-sm'
        }`}>
          {renderText(msg.text)}
        </div>

        {/* Meta */}
        <div className={`flex items-center gap-2 px-1 ${isAI ? '' : 'flex-row-reverse'}`}>
          <span className="text-[11px] text-[#9aaec4]">{msg.time}</span>
          {isAI && (
            <div className="flex items-center gap-1.5">
              <button onClick={() => setLiked(true)}
                className={`w-5 h-5 flex items-center justify-center rounded hover:text-emerald-500 transition-colors ${liked === true ? 'text-emerald-500' : 'text-[#c5d2e8]'}`}>
                <ThumbsUp size={12} />
              </button>
              <button onClick={() => setLiked(false)}
                className={`w-5 h-5 flex items-center justify-center rounded hover:text-red-400 transition-colors ${liked === false ? 'text-red-400' : 'text-[#c5d2e8]'}`}>
                <ThumbsDown size={12} />
              </button>
              <button onClick={copy}
                className="w-5 h-5 flex items-center justify-center rounded text-[#c5d2e8] hover:text-brand-500 transition-colors">
                <Copy size={11} />
              </button>
              {copied && <span className="text-[10px] text-emerald-500">Copied!</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AIChat() {
  const [messages, setMessages] = useState(INITIAL_MESSAGES)
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing])

  const sendMessage = async (text = input.trim()) => {
    if (!text) return
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    setMessages(prev => [...prev, { id: Date.now(), role: 'user', text, time: now }])
    setInput('')
    setTyping(true)

    await new Promise(r => setTimeout(r, 1400 + Math.random() * 800))

    const key = Object.keys(SIMULATED_RESPONSES).find(k => text.toLowerCase().includes(k))
    const reply = SIMULATED_RESPONSES[key] || SIMULATED_RESPONSES.default

    setTyping(false)
    setMessages(prev => [...prev, {
      id: Date.now() + 1,
      role: 'assistant',
      text: reply,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }])
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">

      {/* Chat header */}
      <div className="px-6 py-4 bg-white border-b border-[#e8effc] flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-teal-500 flex items-center justify-center shadow-sm">
          <Sparkles size={18} className="text-white" />
        </div>
        <div className="flex-1">
          <h2 className="font-display font-semibold text-[#0f1f3d] text-sm">MedAssist AI</h2>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-slow" />
            <span className="text-xs text-[#9aaec4]">Online · GPT-powered health assistant</span>
          </div>
        </div>
        <button className="btn-ghost text-xs">
          <RefreshCw size={14} /> New chat
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">

        {/* Context banner */}
        <div className="flex items-center gap-2 bg-brand-50 border border-brand-100 rounded-xl px-4 py-2.5 text-xs text-brand-700">
          <Sparkles size={13} className="shrink-0" />
          <span>I have access to your health profile, latest vitals, and medical history for personalized responses.</span>
        </div>

        {messages.map(msg => <Message key={msg.id} msg={msg} />)}
        {typing && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {messages.length < 3 && (
        <div className="px-6 pb-3 flex gap-2 flex-wrap">
          {SUGGESTIONS.map(s => (
            <button
              key={s}
              onClick={() => sendMessage(s)}
              className="text-xs bg-white border border-[#e8effc] rounded-full px-3 py-1.5 text-[#5a6c8a] hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50 transition-all"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-6 pb-6 pt-2">
        <div className="bg-white border border-[#e8effc] rounded-2xl shadow-sm flex items-end gap-2 p-2 focus-within:border-brand-300 focus-within:ring-2 focus-within:ring-brand-50 transition-all">
          <button className="w-9 h-9 rounded-xl flex items-center justify-center text-[#9aaec4] hover:text-brand-600 hover:bg-brand-50 transition-colors shrink-0">
            <Paperclip size={17} />
          </button>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask about your health, symptoms, medications…"
            rows={1}
            className="flex-1 bg-transparent resize-none text-sm text-[#0f1f3d] placeholder:text-[#9aaec4] focus:outline-none py-2 leading-relaxed max-h-32 overflow-y-auto"
            style={{ scrollbarWidth: 'none' }}
          />
          <div className="flex items-center gap-1.5 shrink-0">
            <button className="w-9 h-9 rounded-xl flex items-center justify-center text-[#9aaec4] hover:text-brand-600 hover:bg-brand-50 transition-colors">
              <Mic size={17} />
            </button>
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || typing}
              className="w-9 h-9 rounded-xl bg-brand-700 flex items-center justify-center text-white hover:bg-brand-800 active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none shadow-sm"
            >
              <Send size={15} />
            </button>
          </div>
        </div>
        <p className="text-center text-[10px] text-[#c5d2e8] mt-2">
          MedAssist AI provides general health information, not medical advice. Always consult a healthcare professional.
        </p>
      </div>
    </div>
  )
}
