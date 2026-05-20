/**
 * Orchestrator Routes
 *
 * POST /api/orchestrator/trigger   — Start pipeline with transcript from frontend
 * GET  /api/orchestrator/status/:jobId — Poll job status
 *
 * Pipeline stages emitted via SSE:
 *   1. conversational  — Conversation agent processing transcript
 *   2. summarizer      — Extracting symptoms, ICD-10, clinical summary
 *   3. publishing      — Generating SOAP record
 *   4. complete        — SOP created and sent to doctor
 */

const express  = require('express')
const router   = express.Router()
const multer   = require('multer')
const SOP      = require('../models/SOP')
const User     = require('../models/User')
const { protect } = require('../middleware/auth')

// In-memory job store (replace with Redis in production)
const jobs = new Map()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
})

const PYTHON_AGENT_URL = process.env.PYTHON_AGENT_URL || 'http://127.0.0.1:8000'
// Read lazily at request time so Key Vault secrets loaded at startup are used
const getInternalSecret = () => process.env.INTERNAL_API_SECRET || 'medassist-internal-secret-2024'

const PYTHON_AGENT_READY_RETRIES  = Number(process.env.PYTHON_AGENT_READY_RETRIES  || 10)
const PYTHON_AGENT_READY_DELAY_MS = Number(process.env.PYTHON_AGENT_READY_DELAY_MS || 1000)

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

async function waitForPythonAgentReady () {
  for (let attempt = 1; attempt <= PYTHON_AGENT_READY_RETRIES; attempt += 1) {
    try {
      const response = await fetch(`${PYTHON_AGENT_URL}/health`, {
        headers: { 'x-internal-secret': getInternalSecret() },
      })
      if (response.ok) return
    } catch (_) {
      // Ignore transient connection errors while the Python bridge is booting.
    }
    if (attempt < PYTHON_AGENT_READY_RETRIES) await sleep(PYTHON_AGENT_READY_DELAY_MS)
  }
  throw new Error(`Python agent bridge not ready at ${PYTHON_AGENT_URL}`)
}

// ── POST /api/orchestrator/trigger ────────────────────────────────────────────
router.post('/trigger', protect, async (req, res) => {
  try {
    const allowedRoles = ['patient', 'doctor']
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Only patients or doctors can trigger the orchestrator' })
    }

    const { transcript, durationSec } = req.body
    if (!transcript || !transcript.trim()) {
      return res.status(400).json({ message: 'Transcript is required' })
    }

    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    // Determine target patient: doctors may supply patientId in the body
    let targetPatient = req.user
    if (req.user.role === 'doctor') {
      const { patientId, patientName } = req.body || {}
      if (patientId) {
        try {
          const p = await User.findById(patientId).select('_id name')
          if (p) targetPatient = p
        } catch (e) {}
      } else if (req.body.patient_id) {
        try {
          const p = await User.findById(String(req.body.patient_id)).select('_id name')
          if (p) targetPatient = p
        } catch (e) {}
      }
    }

    jobs.set(jobId, {
      createdAt:   Date.now(),
      status:      'running',
      stage:       'conversational',
      progress:    10,
      patientId:   String(targetPatient._id),
      initiatorId: String(req.user._id),
      sopId:       null,
      error:       null,
      logs:        [],
    })

    res.json({ jobId })

    const forwardedProto = req.headers['x-forwarded-proto']
    const reqProto = Array.isArray(forwardedProto) ? forwardedProto[0] : (forwardedProto || req.protocol || 'http')
    const reqHost  = req.get('host')
    const nodeLogEndpoint = reqHost ? `${reqProto}://${reqHost}/api/orchestrator/log` : null

    runPipeline(jobId, req.user, targetPatient, transcript, durationSec, req.app, nodeLogEndpoint).catch(err => {
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


// ── POST /api/orchestrator/transcribe ────────────────────────────────────────
router.post('/transcribe', protect, upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Audio file is required' })
    }

    await waitForPythonAgentReady()

    const formData = new FormData()
    formData.append(
      'audio',
      new Blob([req.file.buffer], { type: req.file.mimetype || 'audio/wav' }),
      req.file.originalname || 'consultation.wav'
    )

    if (req.body?.language) {
      formData.append('language', req.body.language)
    }

    const response = await fetch(`${PYTHON_AGENT_URL}/transcribe-audio`, {
      method: 'POST',
      headers: {
        'x-internal-secret': getInternalSecret(),
      },
      body: formData,
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      return res.status(response.status).json(data)
    }

    return res.json(data)
  } catch (err) {
    return res.status(500).json({ message: err.message })
  }
})


// ── Async pipeline runner — calls Python agent bridge ────────────────────────
async function runPipeline(jobId, initiator, patient, transcript, durationSec, app, nodeLogEndpoint) {
  const updateJob = (fields) => {
    const job = jobs.get(jobId)
    if (job) jobs.set(jobId, { ...job, ...fields })
  }

  try {
    updateJob({ stage: 'conversational', progress: 15 })
    updateJob({ stage: 'summarizer', progress: 35 })

    console.log(`[Orchestrator] Calling Python agent bridge for job ${jobId}... URL=${PYTHON_AGENT_URL}`)

    let agentResult
    try {
      await waitForPythonAgentReady()
      const response = await fetch(`${PYTHON_AGENT_URL}/run-pipeline`, {
        method:  'POST',
        headers: {
          'Content-Type':      'application/json',
          'x-internal-secret': getInternalSecret(),
        },
        body: JSON.stringify({
          transcript,
          patient_id:        String(patient._id),
          patient_name:      patient.name,
          duration_sec:      durationSec,
          job_id:            jobId,
          node_log_endpoint: nodeLogEndpoint,
        }),
      })
      agentResult = await response.json()
      console.log(`[Orchestrator] Python agent response for job ${jobId}:`, agentResult)
    } catch (fetchErr) {
      console.warn(`[Orchestrator] Python agent unreachable — using fallback. Error: ${fetchErr.message}`)
      agentResult = {
        success:   true,
        soap_data: generateFallbackSOAP(transcript),
        stage_reached: 'complete (fallback)',
      }
    }

    if (!agentResult.success) {
      updateJob({ status: 'error', error: agentResult.error || 'Agent pipeline failed' })
      return
    }

    updateJob({ stage: 'publishing', progress: 70 })

    const rawSoapData = agentResult.soap_data || {}
    const soapData    = rawSoapData.soap_record || rawSoapData
    const summaryData = agentResult.summary || rawSoapData.summary || {}

    const recordId = (
      rawSoapData.record_id
      || soapData.recordId
      || soapData.record_id
      || `rec_${Date.now()}`
    )

    updateJob({ progress: 85 })

    let assignedDoctor = null
    try {
      assignedDoctor = await User.findOne({ role: 'doctor' }).select('_id name')
    } catch (_) {}

    const icd10Code = (
      soapData.icd10Code
      || soapData.icd10_code
      || soapData.icd_code
      || summaryData.icd10Code
      || summaryData.icd10_code
      || summaryData.icd_code
      || 'N/A'
    )
    soapData.icd10Code = icd10Code
    delete soapData.icd10_code
    delete soapData.icd_code

    const possibleCondition = (
      soapData.possibleCondition
      || soapData.possible_condition
      || summaryData.possibleCondition
      || summaryData.possible_condition
    )
    if (possibleCondition) {
      soapData.possibleCondition = possibleCondition
      delete soapData.possible_condition
    }

    const assessment = String(soapData.assessment || '').trim()
    if (
      possibleCondition
      && icd10Code
      && icd10Code !== 'N/A'
      && (!assessment || !assessment.includes('reference code:'))
    ) {
      soapData.assessment = `Symptoms and context suggest a possible clinical picture related to ${possibleCondition} (reference code: ${icd10Code}) without confirming a diagnosis.`
    }

    const sop = await SOP.create({
      patientId:      patient._id,
      doctorId:       assignedDoctor?._id || null,
      conversationId: agentResult.conversation_id || `conv_${Date.now()}`,
      recordId,
      soapData,
      status:         'pending',
    })

    const io = app.get('io')
    if (io) {
      if (assignedDoctor) {
        io.to(`user:${String(assignedDoctor._id)}`).emit('notification:received', {
          type:    'sop:new',
          message: `New SOP from ${patient.name} is awaiting your approval`,
          sopId:   sop._id,
          time:    new Date().toISOString(),
        })
        io.to(`user:${String(assignedDoctor._id)}`).emit('sop:new', {
          sopId:   sop._id,
          patient: patient.name,
          time:    new Date().toISOString(),
        })
      }
      io.to(`user:${String(patient._id)}`).emit('notification:received', {
        type:    'sop:submitted',
        message: 'Your SOP has been sent to the doctor for approval',
        sopId:   sop._id,
        time:    new Date().toISOString(),
      })
    }

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


// ── GET /api/orchestrator/status/:jobId ───────────────────────────────────────
router.get('/status/:jobId', protect, (req, res) => {
  const job = jobs.get(req.params.jobId)
  if (!job) return res.status(404).json({ message: 'Job not found' })

  if (String(job.patientId) !== String(req.user._id) && String(job.initiatorId) !== String(req.user._id)) {
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
    logs:       job.logs || [],
  })
})


// ── GET /api/orchestrator/agent-health ───────────────────────────────────────
router.get('/agent-health', protect, async (req, res) => {
  try {
    const response = await fetch(`${PYTHON_AGENT_URL}/health`, {
      headers: { 'x-internal-secret': getInternalSecret() },
    })
    const data = await response.json()
    res.json({ pythonAgentOnline: true, ...data })
  } catch {
    res.json({ pythonAgentOnline: false, message: 'Python agent bridge is not reachable' })
  }
})


// ── POST /api/orchestrator/log — receive real-time log events from Python ─────
router.post('/log', (req, res) => {
  const { job_id, stage, message, level = 'info', timestamp } = req.body
  if (!job_id || !stage || !message) return res.status(400).json({ error: 'Missing log fields' })

  const log = { job_id, stage, message, level, timestamp: timestamp || new Date().toISOString() }
  const job = jobs.get(job_id)
  if (job) {
    job.logs = [...(job.logs || []), log].slice(-100)
    jobs.set(job_id, job)
  }

  console.log(`[Orchestrator] /log received from python → job_id=${job_id} stage=${stage} level=${level} message=${message}`)
  const io = req.app.get('io')
  if (io && job) {
    const rooms = new Set()
    if (job.initiatorId) rooms.add(`user:${job.initiatorId}`)
    if (job.patientId)   rooms.add(`user:${job.patientId}`)
    rooms.forEach(room => io.to(room).emit('orchestrator:log', log))
  }
  res.json({ ok: true })
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
    'Fever':               { condition: 'Viral Infection',                   icd10: 'B34.9' },
    'Cough':               { condition: 'Upper Respiratory Tract Infection', icd10: 'J06.9' },
    'Headache':            { condition: 'Tension-type Headache',             icd10: 'G44.2' },
    'Chest discomfort':    { condition: 'Chest pain evaluation',             icd10: 'R07.9' },
    'Shortness of breath': { condition: 'Dyspnea',                           icd10: 'R06.0' },
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