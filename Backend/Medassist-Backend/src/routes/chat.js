const express = require('express')
const router = express.Router()
const https = require('https')
const ChatMessage = require('../models/ChatMessage')
const Vitals = require('../models/Vitals')
const Medication = require('../models/Medication')

const Appointment = require('../models/Appointment')
const User = require('../models/User')
const SOP = require('../models/SOP')
const { protect } = require('../middleware/auth')

router.use(protect)

// ─── GET /api/chat/history ────────────────────────────────────────────────
router.get('/history', async (req, res, next) => {
  try {
    const messages = await ChatMessage.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()
    res.json({ success: true, data: messages.reverse() })
  } catch (err) { next(err) }
})

// ─── POST /api/chat/message ───────────────────────────────────────────────
router.post('/message', async (req, res, next) => {
  try {
    const { message, sessionId } = req.body
    if (!message?.trim()) return res.status(400).json({ success: false, message: 'Message required' })

    const userId = req.user._id

    // Save user message
    await ChatMessage.create({ userId, role: 'user', text: message, sessionId })


    // Build health context from DB
    const [latestVitals, activeMeds] = await Promise.all([
      Vitals.findOne({ patientId: userId }).sort({ recordedAt: -1 }).lean(),
      Medication.find({ patientId: userId, isActive: true }).lean(),
    ])

    const healthContext = latestVitals
      ? `Patient's latest vitals: HR=${latestVitals.heartRate}bpm, BP=${latestVitals.systolic}/${latestVitals.diastolic}mmHg, SpO2=${latestVitals.spo2}%, Glucose=${latestVitals.bloodGlucose}mg/dL, Temp=${latestVitals.temperature}°F.`
      : 'No recent vitals on file.'

    const medsContext = activeMeds.length
      ? `Current medications: ${activeMeds.map(m => `${m.name} ${m.dose} (${m.frequency})`).join(', ')}.`
      : 'No active medications.'

    const systemPrompt = `You are MedAssist AI, a helpful and empathetic medical assistant.
Patient name: ${req.user.name}. Role: ${req.user.role}.
${healthContext}
${medsContext}
IMPORTANT: Always remind the patient to consult their doctor for clinical decisions. You provide general health information only. Keep responses concise and caring.`

    // Get recent conversation history for context
    const recentHistory = await ChatMessage.find({ userId })
      .sort({ createdAt: -1 }).limit(10).lean()
    const messages = recentHistory.reverse().map(m => ({ role: m.role, content: m.text }))
    messages.push({ role: 'user', content: message })

    let aiReply = ''

    // ── Call OpenAI (graceful fallback if key missing) ──────────────────
    const openAiKey = process.env.OPENAI_API_KEY
    if (openAiKey && openAiKey.startsWith('sk-')) {
      try {
        const payload = JSON.stringify({
          model: 'gpt-4o-mini',
          max_tokens: 500,
          messages: [{ role: 'system', content: systemPrompt }, ...messages],
        })

        aiReply = await new Promise((resolve, reject) => {
          const options = {
            hostname: 'api.openai.com',
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${openAiKey}`,
              'Content-Length': Buffer.byteLength(payload),
            },
          }
          const reqHttp = https.request(options, (resp) => {
            let data = ''
            resp.on('data', chunk => { data += chunk })
            resp.on('end', () => {
              try {
                const parsed = JSON.parse(data)
                resolve(parsed.choices?.[0]?.message?.content || 'I could not generate a response.')
              } catch { reject(new Error('Parse error')) }
            })
          })
          reqHttp.on('error', reject)
          reqHttp.write(payload)
          reqHttp.end()
        })
      } catch (openAiErr) {
        aiReply = getFallbackReply(message)
      }
    } else {
      // Demo fallback when OpenAI key not configured
      aiReply = getFallbackReply(message)

    // ── Intent detection ───────────────────────────────────────────────
    const intent = detectIntent(message)
    let aiReply = ''
    let action = null

    if (intent.type === 'book_appointment') {
      const result = await handleBookAppointment(req.user, intent)
      aiReply = result.reply
      action = result.action
    } else if (intent.type === 'list_appointments') {
      const result = await handleListAppointments(req.user)
      aiReply = result.reply
      action = result.action
    } else if (intent.type === 'health_summary') {
      const result = await handleHealthSummary(req.user)
      aiReply = result.reply
      action = result.action
    } else if (intent.type === 'medications') {
      const result = await handleMedications(req.user)
      aiReply = result.reply
      action = result.action
    } else if (intent.type === 'vitals') {
      const result = await handleVitals(req.user)
      aiReply = result.reply
      action = result.action
    } else if (intent.type === 'records') {
      const result = await handleRecords(req.user)
      aiReply = result.reply
      action = result.action
    } else {
      // General AI chat
      const [latestVitals, activeMeds] = await Promise.all([
        Vitals.findOne({ patientId: userId }).sort({ recordedAt: -1 }).lean(),
        Medication.find({ patientId: userId, isActive: true }).lean(),
      ])

      const healthContext = latestVitals
        ? `Patient's latest vitals: HR=${latestVitals.heartRate}bpm, BP=${latestVitals.systolic}/${latestVitals.diastolic}mmHg, SpO2=${latestVitals.spo2}%, Glucose=${latestVitals.bloodGlucose}mg/dL, Temp=${latestVitals.temperature}°F.`
        : 'No recent vitals on file.'

      const medsContext = activeMeds.length
        ? `Current medications: ${activeMeds.map(m => `${m.name} ${m.dose} (${m.frequency})`).join(', ')}.`
        : 'No active medications.'

      const systemPrompt = `You are MedAssist AI, a helpful and empathetic medical assistant.
Patient name: ${req.user.name}. Role: ${req.user.role}.
${healthContext}
${medsContext}
IMPORTANT: Always remind the patient to consult their doctor for clinical decisions. You provide general health information only. Keep responses concise and caring.
You can help patients with: booking appointments, checking their health summary, reviewing medications, checking vitals, and answering health questions.
If the patient asks to book an appointment or check records, guide them to use voice commands like "book appointment with Dr..." or "show my health summary".`

      const recentHistory = await ChatMessage.find({ userId })
        .sort({ createdAt: -1 }).limit(10).lean()
      const messages = recentHistory.reverse().map(m => ({ role: m.role, content: m.text }))
      messages.push({ role: 'user', content: message })

      const openAiKey = process.env.OPENAI_API_KEY
      if (openAiKey && openAiKey.startsWith('sk-')) {
        try {
          const payload = JSON.stringify({
            model: 'gpt-4o-mini',
            max_tokens: 500,
            messages: [{ role: 'system', content: systemPrompt }, ...messages],
          })

          aiReply = await new Promise((resolve, reject) => {
            const options = {
              hostname: 'api.openai.com',
              path: '/v1/chat/completions',
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${openAiKey}`,
                'Content-Length': Buffer.byteLength(payload),
              },
            }
            const reqHttp = https.request(options, (resp) => {
              let data = ''
              resp.on('data', chunk => { data += chunk })
              resp.on('end', () => {
                try {
                  const parsed = JSON.parse(data)
                  resolve(parsed.choices?.[0]?.message?.content || 'I could not generate a response.')
                } catch { reject(new Error('Parse error')) }
              })
            })
            reqHttp.on('error', reject)
            reqHttp.write(payload)
            reqHttp.end()
          })
        } catch (openAiErr) {
          aiReply = getFallbackReply(message)
        }
      } else {
        aiReply = getFallbackReply(message)
      }
    }

    // Save AI reply
    const saved = await ChatMessage.create({ userId, role: 'assistant', text: aiReply, sessionId })

    res.json({
      success: true,
      data: {
        id: saved._id,
        role: 'assistant',
        text: aiReply,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    })
  } 
}catch (err) { next(err) }})

// ─── DELETE /api/chat/history ─────────────────────────────────────────────
router.delete('/history', async (req, res, next) => {
  try {
    await ChatMessage.deleteMany({ userId: req.user._id })
    res.json({ success: true, message: 'Chat history cleared' })
  } catch (err) { next(err) }
})

// ─── POST /api/chat/book-confirm ─────────────────────────────────────────
// Confirm and book an appointment from the chat assistant
router.post('/book-confirm', async (req, res, next) => {
  try {
    const { doctorId, date, time, mode } = req.body
    if (!doctorId || !date || !time) {
      return res.status(400).json({ success: false, message: 'Doctor, date, and time are required' })
    }

    const doctor = await User.findById(doctorId)
    if (!doctor || doctor.role !== 'doctor') {
      return res.status(404).json({ success: false, message: 'Doctor not found' })
    }

    // Conflict check
    const conflict = await Appointment.findOne({
      doctorId, date: new Date(date), time, status: 'upcoming',
    })
    if (conflict) {
      return res.json({
        success: true,
        data: {
          booked: false,
          message: `Sorry, that slot is already taken. Dr. ${doctor.name} is not available at ${time} on ${date}. Would you like to try a different time?`,
        },
      })
    }

    const appt = await Appointment.create({
      patientId: req.user._id,
      patientName: req.user.name,
      doctorId: doctor._id,
      doctorName: doctor.name,
      specialty: doctor.doctorProfile?.specialty,
      doctorInitials: doctor.initials,
      doctorColor: doctor.color,
      date: new Date(date),
      time,
      mode: mode || 'in-person',
    })

    // Emit real-time event
    const io = req.app.get('io')
    io?.to(`user:${req.user._id}`).emit('appointment:created', appt)
    io?.to(`user:${doctor._id}`).emit('appointment:created', appt)

    // Save confirmation messages to chat
    const confirmMsg = `✅ Appointment booked successfully!\n\n• **Doctor:** Dr. ${doctor.name}\n• **Date:** ${new Date(date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}\n• **Time:** ${time}\n• **Mode:** ${mode || 'In-person'}\n\nYou'll receive a reminder before your appointment.`
    await ChatMessage.create({ userId: req.user._id, role: 'assistant', text: confirmMsg })

    res.json({
      success: true,
      data: {
        booked: true,
        appointment: appt,
        message: confirmMsg,
      },
    })
  } catch (err) { next(err) }
})

// ─── Demo fallback replies ────────────────────────────────────────────────
function getFallbackReply(message) {
  const msg = message.toLowerCase()
  if (msg.includes('blood pressure') || msg.includes('bp'))

    return 'Your recent blood pressure readings look slightly elevated (systolic above 120). I recommend reducing sodium intake, exercising 30 min/day, and discussing this with Dr. Priya Nair at your next appointment.'
  if (msg.includes('metformin') || msg.includes('medication') || msg.includes('ibuprofen'))
    return 'Taking ibuprofen with Metformin can increase the risk of lactic acidosis and kidney issues. Please use paracetamol as an alternative, and consult Dr. Sunita Rao before making changes to your medication.'
  if (msg.includes('hba1c') || msg.includes('sugar') || msg.includes('diabetes'))
    return 'An HbA1c of 6.2% is in the pre-diabetic range (5.7–6.4%). Your Metformin regimen is helping control it. Continue monitoring your blood glucose levels and maintain a low-carb diet.'
  if (msg.includes('appointment') || msg.includes('book'))
    return 'You have an upcoming appointment with Dr. Priya Nair tomorrow at 10:30 AM. Would you like me to help you prepare, or would you like to book another appointment?'
  return "Thank you for your question! Based on your health profile, I recommend consulting with your care team for personalized advice. Is there anything specific from your health records or medications you'd like me to explain?"

    return 'Your recent blood pressure readings look slightly elevated (systolic above 120). I recommend reducing sodium intake, exercising 30 min/day, and discussing this with your doctor at your next appointment.'
  if (msg.includes('metformin') || msg.includes('medication') || msg.includes('ibuprofen'))
    return 'Taking ibuprofen with Metformin can increase the risk of lactic acidosis and kidney issues. Please use paracetamol as an alternative, and consult your doctor before making changes to your medication.'
  if (msg.includes('hba1c') || msg.includes('sugar') || msg.includes('diabetes'))
    return 'An HbA1c of 6.2% is in the pre-diabetic range (5.7–6.4%). Your Metformin regimen is helping control it. Continue monitoring your blood glucose levels and maintain a low-carb diet.'
  if (msg.includes('hello') || msg.includes('hi') || msg.includes('hey'))
    return "Hello! I'm your MedAssist AI assistant. I can help you with:\n\n• **Book appointments** — Say \"book appointment with Dr. Priya\"\n• **Check appointments** — Say \"show my appointments\"\n• **Health summary** — Say \"show my health summary\"\n• **Medications** — Say \"what are my medications\"\n• **Vitals** — Say \"check my vitals\"\n• **Records** — Say \"show my records\"\n\nHow can I help you today?"
  return "I'm your MedAssist AI assistant! I can help you book appointments, check your health summary, review medications, or answer health questions. Just ask me anything or use voice commands like \"book appointment\" or \"show my summary\"."
}

// ─── Intent detection ─────────────────────────────────────────────────────
function detectIntent(message) {
  const msg = message.toLowerCase()

  // Book appointment intent (includes common voice-recognition misheard words)
  if (/\b(book|booking|cooking|looking|schedule|make|set|fix|need|want)\b.*\b(appointment|appt|meeting|visit|consultation|consult)\b/.test(msg) ||
      /\b(appointment|appt)\b.*\b(book|booking|cooking|schedule|make|set)\b/.test(msg) ||
      /\bi (want|need|like|would like) to (see|visit|meet|consult|book)\b.*\b(doctor|dr)\b/.test(msg) ||
      /\b(book|booking|cooking)\b.*\b(doctor|dr)\b/.test(msg) ||
      /\b(appointment|appt)\b.*\b(doctor|dr)\b/.test(msg) ||
      /\b(doctor|dr)\b.*\b(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/.test(msg) ||
      /\b(appointment|appt|book|booking|cooking)\b.*\b(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/.test(msg)) {
    // Try to extract doctor name
    const drMatch = msg.match(/(?:dr\.?|doctor)\s+([a-z]+(?:\s+[a-z]+)?)/i)
    const timeMatch = msg.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i)
    const dateMatch = msg.match(/\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i)
    return {
      type: 'book_appointment',
      doctorName: drMatch?.[1] || null,
      time: timeMatch?.[1] || null,
      date: dateMatch?.[1] || null,
    }
  }

  // List/check appointments
  if (/\b(show|list|check|view|see|what|my|upcoming)\b.*\b(appointment|appt|schedule|booking)\b/.test(msg) ||
      /\b(appointment|appt|schedule)\b.*\b(show|list|check|view|when)\b/.test(msg) ||
      /\bwhen.*(next|upcoming).*(appointment|visit|consult)\b/.test(msg)) {
    return { type: 'list_appointments' }
  }

  // Health summary / patient records summary
  if (/\b(health|medical|patient)\b.*\b(summary|overview|report|status)\b/.test(msg) ||
      /\b(summary|overview)\b.*\b(health|medical|patient)\b/.test(msg) ||
      /\bhow.*(am i|i doing|my health)\b/.test(msg) ||
      /\b(show|get|give|check)\b.*\b(summary|overview)\b/.test(msg)) {
    return { type: 'health_summary' }
  }

  // Medications
  if (/\b(medication|medicine|med|drug|prescription|pill|tablet)\b/.test(msg) ||
      /\bwhat.*(am i|i'm) taking\b/.test(msg)) {
    return { type: 'medications' }
  }

  // Vitals
  if (/\b(vital|heart rate|blood pressure|bp|spo2|oxygen|glucose|temperature|pulse)\b/.test(msg) &&
      (/\b(check|show|my|latest|current|what)\b/.test(msg))) {
    return { type: 'vitals' }
  }

  // Records
  if (/\b(record|report|lab|test result|document|file)\b/.test(msg) &&
      (/\b(show|list|check|view|see|my|get)\b/.test(msg))) {
    return { type: 'records' }
  }

  return { type: 'general' }
}

// ─── Action handlers ──────────────────────────────────────────────────────
async function handleBookAppointment(user, intent) {
  try {
    // Find doctors
    const doctors = await User.find({ role: 'doctor', isActive: true }).select('_id name doctorProfile').lean()
    if (!doctors.length) {
      return { reply: 'Sorry, no doctors are currently available. Please try again later.', action: null }
    }

    // Try to match doctor by name
    let matchedDoctor = null
    if (intent.doctorName) {
      matchedDoctor = doctors.find(d => d.name.toLowerCase().includes(intent.doctorName.toLowerCase()))
    }

    if (matchedDoctor) {
      // Calculate next available date
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const dateStr = tomorrow.toISOString().split('T')[0]
      const time = intent.time || '10:00 AM'

      return {
        reply: `I found **Dr. ${matchedDoctor.name}**${matchedDoctor.doctorProfile?.specialty ? ` (${matchedDoctor.doctorProfile.specialty})` : ''}. Would you like me to book an appointment for **${dateStr}** at **${time}**?\n\nSay "yes, confirm" to book or tell me a different time.`,
        action: {
          type: 'confirm_booking',
          doctorId: matchedDoctor._id,
          doctorName: matchedDoctor.name,
          specialty: matchedDoctor.doctorProfile?.specialty,
          date: dateStr,
          time,
        },
      }
    }

    // No specific doctor mentioned — show available doctors
    const doctorList = doctors.map(d =>
      `• **Dr. ${d.name}**${d.doctorProfile?.specialty ? ` — ${d.doctorProfile.specialty}` : ''}`
    ).join('\n')

    return {
      reply: `Here are the available doctors:\n\n${doctorList}\n\nWho would you like to see? Say "book appointment with Dr. [name]"`,
      action: { type: 'show_doctors', doctors: doctors.map(d => ({ id: d._id, name: d.name, specialty: d.doctorProfile?.specialty })) },
    }
  } catch (err) {
    return { reply: 'Sorry, I had trouble looking up available doctors. Please try again.', action: null }
  }
}

async function handleListAppointments(user) {
  try {
    const appointments = await Appointment.find({
      patientId: user._id,
      status: { $in: ['upcoming'] },
    }).sort({ date: 1 }).limit(5).lean()

    if (!appointments.length) {
      return {
        reply: "You don't have any upcoming appointments. Would you like me to book one? Just say \"book appointment\".",
        action: { type: 'no_appointments' },
      }
    }

    const list = appointments.map(a => {
      const d = new Date(a.date)
      const dateStr = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
      return `• **${dateStr}** at **${a.time}** — ${a.doctorName || 'Doctor'}${a.mode ? ` (${a.mode})` : ''}`
    }).join('\n')

    return {
      reply: `Here are your upcoming appointments:\n\n${list}\n\nWould you like to book another appointment or need any other help?`,
      action: { type: 'appointments_list', appointments },
    }
  } catch (err) {
    return { reply: 'Sorry, I had trouble fetching your appointments. Please try again.', action: null }
  }
}

async function handleHealthSummary(user) {
  try {
    const [vitals, meds, appointments, sops] = await Promise.all([
      Vitals.findOne({ patientId: user._id }).sort({ recordedAt: -1 }).lean(),
      Medication.find({ patientId: user._id, isActive: true }).lean(),
      Appointment.find({ patientId: user._id, status: 'upcoming' }).sort({ date: 1 }).limit(3).lean(),
      SOP.find({ patientId: user._id }).sort({ createdAt: -1 }).limit(1).lean(),
    ])

    let summary = `**Health Summary for ${user.name}**\n\n`

    // Vitals section
    if (vitals) {
      summary += `**Latest Vitals:**\n`
      if (vitals.heartRate) summary += `• Heart Rate: ${vitals.heartRate} bpm\n`
      if (vitals.systolic) summary += `• Blood Pressure: ${vitals.systolic}/${vitals.diastolic} mmHg\n`
      if (vitals.spo2) summary += `• SpO₂: ${vitals.spo2}%\n`
      if (vitals.bloodGlucose) summary += `• Blood Glucose: ${vitals.bloodGlucose} mg/dL\n`
      if (vitals.temperature) summary += `• Temperature: ${vitals.temperature}°F\n`
      summary += '\n'
    } else {
      summary += '**Vitals:** No recent records\n\n'
    }

    // Medications section
    if (meds.length) {
      summary += `**Active Medications (${meds.length}):**\n`
      meds.forEach(m => { summary += `• ${m.name} ${m.dose} — ${m.frequency}\n` })
      summary += '\n'
    } else {
      summary += '**Medications:** None active\n\n'
    }

    // Appointments section
    if (appointments.length) {
      summary += `**Upcoming Appointments:**\n`
      appointments.forEach(a => {
        const d = new Date(a.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
        summary += `• ${d} at ${a.time} — ${a.doctorName || 'Doctor'}\n`
      })
      summary += '\n'
    } else {
      summary += '**Appointments:** None scheduled\n\n'
    }

    // Latest SOP
    if (sops.length && sops[0].soapData) {
      summary += `**Last Consultation Note:**\n`
      summary += `• ${sops[0].soapData.assessment || sops[0].soapData.possibleCondition || 'General consultation'}\n`
      summary += `• Status: ${sops[0].status}\n`
    }

    summary += '\nIs there anything specific you\'d like to know more about?'

    return {
      reply: summary,
      action: { type: 'health_summary', hasVitals: !!vitals, medCount: meds.length, apptCount: appointments.length },
    }
  } catch (err) {
    return { reply: 'Sorry, I had trouble fetching your health summary. Please try again.', action: null }
  }
}

async function handleMedications(user) {
  try {
    const meds = await Medication.find({ patientId: user._id, isActive: true }).lean()

    if (!meds.length) {
      return { reply: "You don't have any active medications on file. If you think this is incorrect, please ask your doctor to update your records.", action: { type: 'no_medications' } }
    }

    const list = meds.map(m =>
      `• **${m.name}** ${m.dose} — ${m.frequency}${m.instructions ? `\n  _${m.instructions}_` : ''}`
    ).join('\n')

    return {
      reply: `**Your Active Medications (${meds.length}):**\n\n${list}\n\n⚠️ Always follow your doctor's instructions. Never change doses without consulting them.`,
      action: { type: 'medications_list', medications: meds },
    }
  } catch (err) {
    return { reply: 'Sorry, I had trouble fetching your medications. Please try again.', action: null }
  }
}

async function handleVitals(user) {
  try {
    const vitals = await Vitals.findOne({ patientId: user._id }).sort({ recordedAt: -1 }).lean()

    if (!vitals) {
      return { reply: 'No vitals records found. Your doctor or care team can add vitals during your next visit.', action: { type: 'no_vitals' } }
    }

    const recorded = new Date(vitals.recordedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    let reply = `**Your Latest Vitals** (recorded ${recorded}):\n\n`
    if (vitals.heartRate) reply += `• ❤️ Heart Rate: **${vitals.heartRate} bpm**\n`
    if (vitals.systolic) reply += `• 🩸 Blood Pressure: **${vitals.systolic}/${vitals.diastolic} mmHg**\n`
    if (vitals.spo2) reply += `• 🫁 SpO₂: **${vitals.spo2}%**\n`
    if (vitals.bloodGlucose) reply += `• 🩸 Blood Glucose: **${vitals.bloodGlucose} mg/dL**\n`
    if (vitals.temperature) reply += `• 🌡️ Temperature: **${vitals.temperature}°F**\n`

    reply += '\nWould you like me to explain any of these readings?'

    return { reply, action: { type: 'vitals_display', vitals } }
  } catch (err) {
    return { reply: 'Sorry, I had trouble fetching your vitals. Please try again.', action: null }
  }
}

async function handleRecords(user) {
  try {
    const sops = await SOP.find({ patientId: user._id }).sort({ createdAt: -1 }).limit(5).lean()

    if (!sops.length) {
      return { reply: 'No medical records or consultation notes found yet. After your next consultation, your records will appear here.', action: { type: 'no_records' } }
    }

    const list = sops.map(s => {
      const d = new Date(s.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
      const condition = s.soapData?.possibleCondition || s.soapData?.assessment || 'Consultation'
      const statusBadge = s.status === 'approved' ? '✅' : s.status === 'rejected' ? '❌' : '⏳'
      return `• ${statusBadge} **${d}** — ${condition} (${s.status})`
    }).join('\n')

    return {
      reply: `**Your Recent Records:**\n\n${list}\n\nWould you like me to explain any of these in detail?`,
      action: { type: 'records_list', records: sops },
    }
  } catch (err) {
    return { reply: 'Sorry, I had trouble fetching your records. Please try again.', action: null }
  }
}

module.exports = router
