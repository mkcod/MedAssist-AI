const express = require('express')
const router  = express.Router()
const https   = require('https')
const VoiceTranscript = require('../models/VoiceTranscript')
const ChatMessage     = require('../models/ChatMessage')
const Vitals          = require('../models/Vitals')
const Medication      = require('../models/Medication')
const { protect }     = require('../middleware/auth')
const logger          = require('../utils/logger')

router.use(protect)

// ─── POST /api/voice/transcript ───────────────────────────────────────────
// Save a completed voice transcript + optionally get an AI reply
router.post('/transcript', async (req, res, next) => {
  try {
    const {
      transcript,
      sessionId,
      interimSnapshots = [],
      language         = 'en-IN',
      durationSeconds  = 0,
      confidence       = null,
      generateAiReply  = true,
    } = req.body

    if (!transcript?.trim()) {
      return res.status(400).json({ success: false, message: 'transcript is required' })
    }

    const userId    = req.user._id
    const wordCount = transcript.trim().split(/\s+/).length

    // ── Auto-tag based on keywords ─────────────────────────────────────
    const tags = []
    const lower = transcript.toLowerCase()
    if (/\b(pain|hurt|ache|discomfort|sore)\b/.test(lower))   tags.push('pain')
    if (/\b(medication|medicine|tablet|pill|dose)\b/.test(lower)) tags.push('medication')
    if (/\b(appointment|doctor|visit|consult)\b/.test(lower)) tags.push('appointment')
    if (/\b(blood|pressure|glucose|sugar|heart|pulse)\b/.test(lower)) tags.push('vitals')
    if (/\b(fever|cold|cough|nausea|vomit|dizz)\b/.test(lower)) tags.push('symptoms')

    // ── Optionally generate an AI reply ───────────────────────────────
    let aiResponse = null

    if (generateAiReply) {
      const [latestVitals, activeMeds] = await Promise.all([
        Vitals.findOne({ patientId: userId }).sort({ recordedAt: -1 }).lean(),
        Medication.find({ patientId: userId, isActive: true }).lean(),
      ])

      const healthCtx = latestVitals
        ? `Latest vitals — HR:${latestVitals.heartRate}bpm BP:${latestVitals.systolic}/${latestVitals.diastolic} SpO2:${latestVitals.spo2}% Glucose:${latestVitals.bloodGlucose}mg/dL`
        : 'No recent vitals on file.'

      const medsCtx = activeMeds.length
        ? `Medications: ${activeMeds.map(m => `${m.name} ${m.dose}`).join(', ')}`
        : 'No active medications.'

      const systemPrompt = `You are MedAssist AI, a compassionate medical assistant.\nPatient: ${req.user.name}. ${healthCtx}. ${medsCtx}.\nThe patient spoke the following via voice — respond concisely and caringly. Remind them to consult their doctor for clinical decisions.`

      const openAiKey = process.env.OPENAI_API_KEY
      if (openAiKey && openAiKey.startsWith('sk-')) {
        try {
          const payload = JSON.stringify({
            model: 'gpt-4o-mini',
            max_tokens: 400,
            messages: [
              { role: 'system',    content: systemPrompt },
              { role: 'user',      content: transcript  },
            ],
          })
          aiResponse = await new Promise((resolve, reject) => {
            const opts = {
              hostname: 'api.openai.com',
              path: '/v1/chat/completions',
              method: 'POST',
              headers: {
                'Content-Type':   'application/json',
                Authorization:    `Bearer ${openAiKey}`,
                'Content-Length': Buffer.byteLength(payload),
              },
            }
            const r = https.request(opts, resp => {
              let d = ''
              resp.on('data', c => { d += c })
              resp.on('end', () => {
                try {
                  const p = JSON.parse(d)
                  resolve(p.choices?.[0]?.message?.content || null)
                } catch { reject(new Error('parse')) }
              })
            })
            r.on('error', reject)
            r.write(payload)
            r.end()
          })
        } catch (e) {
          logger.warn(`OpenAI call failed for voice: ${e.message}`)
          aiResponse = buildFallbackReply(lower)
        }
      } else {
        aiResponse = buildFallbackReply(lower)
      }

      // Persist AI reply in ChatMessage for unified history
      if (aiResponse) {
        await ChatMessage.create({ userId, role: 'user',      text: transcript,  sessionId })
        await ChatMessage.create({ userId, role: 'assistant', text: aiResponse,  sessionId })
      }
    }

    // ── Persist transcript ─────────────────────────────────────────────
    const doc = await VoiceTranscript.create({
      userId,
      sessionId:         sessionId || `voice_${Date.now()}`,
      transcript,
      interimSnapshots,
      language,
      durationSeconds:   parseFloat(durationSeconds.toFixed(1)),
      wordCount,
      confidence,
      aiResponse,
      tags,
    })

    logger.info(`Voice transcript saved [${doc._id}] for user ${userId} — ${wordCount} words`)

    res.status(201).json({
      success: true,
      data: {
        id:              doc._id,
        transcript:      doc.transcript,
        wordCount:       doc.wordCount,
        durationSeconds: doc.durationSeconds,
        tags:            doc.tags,
        language:        doc.language,
        confidence:      doc.confidence,
        aiResponse:      doc.aiResponse,
        createdAt:       doc.createdAt,
      },
    })
  } catch (err) { next(err) }
})

// ─── GET /api/voice/transcripts ───────────────────────────────────────────
// List all transcripts for the logged-in user (newest first)
router.get('/transcripts', async (req, res, next) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit  || '50'), 100)
    const skip   = parseInt(req.query.skip   || '0')
    const search = req.query.search || ''

    const filter = { userId: req.user._id }
    if (search) filter.transcript = { $regex: search, $options: 'i' }

    const [docs, total] = await Promise.all([
      VoiceTranscript.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      VoiceTranscript.countDocuments(filter),
    ])

    res.json({
      success: true,
      total,
      data: docs.map(d => ({
        id:              d._id,
        transcript:      d.transcript,
        wordCount:       d.wordCount,
        durationSeconds: d.durationSeconds,
        tags:            d.tags,
        language:        d.language,
        confidence:      d.confidence,
        aiResponse:      d.aiResponse,
        createdAt:       d.createdAt,
        sessionId:       d.sessionId,
      })),
    })
  } catch (err) { next(err) }
})

// ─── GET /api/voice/transcripts/export ────────────────────────────────────
// Export all transcripts as a JSON file download
router.get('/transcripts/export', async (req, res, next) => {
  try {
    const docs = await VoiceTranscript.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .lean()

    const exportData = {
      exportedAt:  new Date().toISOString(),
      userId:      req.user._id,
      userName:    req.user.name,
      totalCount:  docs.length,
      transcripts: docs.map(d => ({
        id:              d._id,
        sessionId:       d.sessionId,
        transcript:      d.transcript,
        wordCount:       d.wordCount,
        durationSeconds: d.durationSeconds,
        language:        d.language,
        confidence:      d.confidence,
        tags:            d.tags,
        aiResponse:      d.aiResponse,
        interimSnapshots:d.interimSnapshots,
        createdAt:       d.createdAt,
      })),
    }

    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="voice-transcripts-${Date.now()}.json"`)
    res.json(exportData)
  } catch (err) { next(err) }
})

// ─── DELETE /api/voice/transcripts/:id ────────────────────────────────────
router.delete('/transcripts/:id', async (req, res, next) => {
  try {
    const doc = await VoiceTranscript.findOne({
      _id: req.params.id, userId: req.user._id,
    })
    if (!doc) return res.status(404).json({ success: false, message: 'Transcript not found' })
    await doc.deleteOne()
    res.json({ success: true, message: 'Transcript deleted' })
  } catch (err) { next(err) }
})

// ─── DELETE /api/voice/transcripts ────────────────────────────────────────
router.delete('/transcripts', async (req, res, next) => {
  try {
    const { deletedCount } = await VoiceTranscript.deleteMany({ userId: req.user._id })
    res.json({ success: true, message: `Cleared ${deletedCount} transcripts` })
  } catch (err) { next(err) }
})

// ─── Fallback reply ───────────────────────────────────────────────────────
function buildFallbackReply(lower) {
  if (/pain|hurt|ache/.test(lower))
    return 'I heard that you\'re experiencing some discomfort. Please describe the location and severity to your doctor. If severe, seek immediate medical attention.'
  if (/blood pressure|bp/.test(lower))
    return 'Monitoring blood pressure regularly is important. Keep track of your readings and discuss any trends with Dr. Priya Nair at your next visit.'
  if (/medication|medicine|tablet/.test(lower))
    return 'Regarding your medications — always take them as prescribed. If you have concerns about dosage or side effects, consult your prescribing physician.'
  if (/appointment|doctor|visit/.test(lower))
    return 'I can help you prepare for your appointment. Make sure to note any symptoms, questions, and bring your medication list.'
  if (/sugar|glucose|diabetes/.test(lower))
    return 'Keeping blood glucose in check is essential. Stay consistent with Metformin, monitor your diet, and log your readings daily.'
  return 'Thank you for sharing. I\'ve recorded your voice note. For personalized medical advice, please consult your healthcare provider.'
}

module.exports = router
