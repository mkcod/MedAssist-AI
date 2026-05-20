/**
 * Orchestrator Routes — connects Node.js backend to Python AI agents
 *
 * Flow:
 *   POST /api/orchestrator/trigger
 *     → Validates request + auth
 *     → Calls Python FastAPI bridge (port 8001)
 *     → Python runs: Summarizer Agent → Publishing Agent
 *     → Returns SOAP data
 *     → Saves SOP to MongoDB
 *     → Notifies doctor + patient via Socket.io
 *
 *   GET /api/orchestrator/status/:jobId
 *     → Returns current job status (polling)
 */

const express  = require('express')
const router   = express.Router()
const SOP      = require('../models/SOP')
const User     = require('../models/User')
const { protect } = require('../middleware/auth')

// ── Python Agent Bridge URL ───────────────────────────────────────────────────
const PYTHON_AGENT_URL    = process.env.PYTHON_AGENT_URL    || 'http://localhost:8001'
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || 'medassist-internal-secret-2024'

// ── In-memory job store (replace with Redis in production) ───────────────────
const jobs = new Map()


// ── POST /api/orchestrator/trigger ───────────────────────────────────────────
router.post('/trigger', protect, async (req, res) => {
  try {
    // Only patients and doctors can trigger
    const allowedRoles = ['patient', 'doctor']
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Only patients or doctors can trigger the orchestrator' })
    }

    const { transcript, durationSec } = req.body
    if (!transcript || !transcript.trim()) {
      return res.status(400).json({ message: 'Transcript is required' })
    }

    // Generate job ID
    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    // Store initial job state
    jobs.set(jobId, {
      createdAt: Date.now(),
      status:    'running',
      stage:     'conversational',
      progress:  10,
      patientId: String(req.user._id),
      sopId:     null,
      error:     null,
    })

    // Return jobId immediately — pipeline runs async
    res.json({ jobId })

    // Run pipeline in background (don't await here)
    runPipeline(jobId, req.user, transcript, durationSec, req.app).catch(err => {
      const job = jobs.get(jobId)
      if (job) {
        job.status = 'error'
        job.error  = err.message
        jobs.set(jobId, job)
      }
      console.error(`[Orchestrator] Pipeline error for job ${jobId}:`, err.message)
    })

  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})


// ── Async pipeline runner — calls Python agent bridge ────────────────────────
async function runPipeline(jobId, user, transcript, durationSec, app) {
  const updateJob = (fields) => {
    const job = jobs.get(jobId)
    if (job) jobs.set(jobId, { ...job, ...fields })
  }

  try {
    // ── Stage 1: Handoff to Python agents ──────────────────────────────────
    updateJob({ stage: 'conversational', progress: 15 })

    // ── Stage 2: Call Python FastAPI Bridge ────────────────────────────────
    updateJob({ stage: 'summarizer', progress: 35 })

    console.log(`[Orchestrator] Calling Python agent bridge for job ${jobId}...`)

    let agentResult
    try {
      const response = await fetch(`${PYTHON_AGENT_URL}/run-pipeline`, {
        method:  'POST',
        headers: {
          'Content-Type':       'application/json',
          'x-internal-secret':  INTERNAL_API_SECRET,
        },
        body: JSON.stringify({
          transcript,
          patient_id:   String(user._id),
          patient_name: user.name,
          duration_sec: durationSec,
        }),
      })

      agentResult = await response.json()
    } catch (fetchErr) {
      // ── Fallback: Python service not running → use keyword extraction ──
      console.warn(`[Orchestrator] Python agent unreachable — using fallback. Error: ${fetchErr.message}`)
      agentResult = {
        success:   true,
        soap_data: generateFallbackSOAP(transcript),
        stage_reached: 'complete (fallback)',
      }
    }

    // ── Check agent result ─────────────────────────────────────────────────
    if (!agentResult.success) {
      updateJob({ status: 'error', error: agentResult.error || 'Agent pipeline failed' })
      return
    }

    // ── Stage 3: Publishing ────────────────────────────────────────────────
    updateJob({ stage: 'publishing', progress: 70 })

    const soapData = agentResult.soap_data

    // ── Stage 4: Save to MongoDB ───────────────────────────────────────────
    updateJob({ progress: 85 })

    // Find an available doctor
    let assignedDoctor = null
    try {
      assignedDoctor = await User.findOne({ role: 'doctor' }).select('_id name')
    } catch (_) {}

    const sop = await SOP.create({
      patientId:      user._id,
      doctorId:       assignedDoctor?._id || null,
      conversationId: agentResult.conversation_id || `conv_${Date.now()}`,
      recordId:       `rec_${Date.now()}`,
      soapData,
      status:         'pending',
    })

    // ── Stage 5: Notify via Socket.io ──────────────────────────────────────
    const io = app.get('io')
    if (io) {
      // Notify doctor
      if (assignedDoctor) {
        io.to(`user:${String(assignedDoctor._id)}`).emit('notification:received', {
          type:    'sop:new',
          message: `New SOP from ${user.name} is awaiting your approval`,
          sopId:   sop._id,
          time:    new Date().toISOString(),
        })
        io.to(`user:${String(assignedDoctor._id)}`).emit('sop:new', {
          sopId:   sop._id,
          patient: user.name,
          time:    new Date().toISOString(),
        })
      }

      // Notify patient
      io.to(`user:${String(user._id)}`).emit('notification:received', {
        type:    'sop:submitted',
        message: 'Your SOP has been sent to the doctor for approval',
        sopId:   sop._id,
        time:    new Date().toISOString(),
      })
    }

    // ── Complete ───────────────────────────────────────────────────────────
    updateJob({
      status:     'complete',
      stage:      'complete',
      progress:   100,
      sopId:      String(sop._id),
      doctorName: assignedDoctor?.name || 'your doctor',
      soapData,
    })

    console.log(`[Orchestrator] Job ${jobId} complete — SOP: ${sop._id}`)

  } catch (err) {
    updateJob({ status: 'error', error: err.message })
    console.error(`[Orchestrator] Job ${jobId} failed:`, err.message)
    throw err
  }
}


// ── GET /api/orchestrator/status/:jobId ──────────────────────────────────────
router.get('/status/:jobId', protect, (req, res) => {
  const job = jobs.get(req.params.jobId)
  if (!job) return res.status(404).json({ message: 'Job not found' })

  // Only job owner can poll
  if (String(job.patientId) !== String(req.user._id)) {
    return res.status(403).json({ message: 'Forbidden' })
  }

  res.json({
    jobId:      req.params.jobId,
    status:     job.status,
    stage:      job.stage,
    progress:   job.progress,
    sopId:      job.sopId,
    doctorName: job.doctorName,
    error:      job.error,
  })
})


// ── GET /api/orchestrator/health ──────────────────────────────────────────────
// Check if Python agent bridge is reachable
router.get('/agent-health', protect, async (req, res) => {
  try {
    const response = await fetch(`${PYTHON_AGENT_URL}/health`, {
      headers: { 'x-internal-secret': INTERNAL_API_SECRET },
    })
    const data = await response.json()
    res.json({ pythonAgentOnline: true, ...data })
  } catch {
    res.json({ pythonAgentOnline: false, message: 'Python agent bridge is not reachable' })
  }
})


// ── Fallback SOAP generator (used when Python service is offline) ─────────────
function generateFallbackSOAP(transcript = '') {
  const words    = transcript.toLowerCase().split(/\s+/)
  const symptoms = []

  const keywordMap = {
    headache: 'Headache', fever: 'Fever', cough: 'Cough',
    cold: 'Common cold', pain: 'Pain', fatigue: 'Fatigue',
    nausea: 'Nausea', vomiting: 'Vomiting', dizziness: 'Dizziness',
    chest: 'Chest discomfort', breathing: 'Shortness of breath', throat: 'Sore throat',
  }

  for (const [kw, sym] of Object.entries(keywordMap)) {
    if (words.some(w => w.includes(kw)) && !symptoms.includes(sym)) symptoms.push(sym)
  }

  const conditions = {
    'Fever':               { condition: 'Viral Infection',                    icd10: 'B34.9' },
    'Cough':               { condition: 'Upper Respiratory Tract Infection',  icd10: 'J06.9' },
    'Headache':            { condition: 'Tension-type Headache',              icd10: 'G44.2' },
    'Chest discomfort':    { condition: 'Chest pain evaluation',              icd10: 'R07.9' },
    'Shortness of breath': { condition: 'Dyspnea',                            icd10: 'R06.0' },
  }

  const primary  = symptoms[0]
  const condInfo = conditions[primary] || { condition: 'Unspecified condition', icd10: 'R69' }

  return {
    subjective:        `Patient reports: ${symptoms.length ? symptoms.join(', ') : 'general discomfort'}.`,
    objective:         'Vitals within normal range. Physical examination conducted.',
    assessment:        `${condInfo.condition} — ${symptoms.join(', ')}.`,
    plan:              'Prescribed symptomatic treatment. Follow-up in 7 days.',
    symptoms,
    icd10Code:         condInfo.icd10,
    possibleCondition: condInfo.condition,
    confidenceScore:   0.75,
    actionPlan:        'Rest, symptomatic treatment, follow-up in 7 days.',
    _note:             'Generated by fallback — Python agent was offline',
  }
}


// ── Cleanup old jobs every 10 minutes ────────────────────────────────────────
setInterval(() => {
  const now      = Date.now()
  const shortTTL = 5  * 60 * 1000
  const longTTL  = 30 * 60 * 1000
  for (const [id, job] of jobs.entries()) {
    const age = now - (job.createdAt || 0)
    if (age > longTTL) { jobs.delete(id); continue }
    if (['complete', 'error'].includes(job.status) && age > shortTTL) jobs.delete(id)
  }
}, 10 * 60 * 1000)


module.exports = router
