const express = require('express')
const router = express.Router()
const Vitals = require('../models/Vitals')
const { protect, restrictTo } = require('../middleware/auth')

router.use(protect)

// ─── GET /api/vitals ──────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const patientId = req.user.role === 'patient' ? req.user._id : req.query.patientId
    if (!patientId) return res.status(400).json({ success: false, message: 'patientId required' })

    const { limit = 20, from, to } = req.query
    const filter = { patientId }
    if (from || to) {
      filter.recordedAt = {}
      if (from) filter.recordedAt.$gte = new Date(from)
      if (to)   filter.recordedAt.$lte = new Date(to)
    }

    const vitals = await Vitals.find(filter)
      .sort({ recordedAt: -1 })
      .limit(Number(limit))
      .lean()

    res.json({ success: true, data: vitals })
  } catch (err) { next(err) }
})

// ─── GET /api/vitals/latest ───────────────────────────────────────────────
router.get('/latest', async (req, res, next) => {
  try {
    const patientId = req.user.role === 'patient' ? req.user._id : req.query.patientId
    const latest = await Vitals.findOne({ patientId }).sort({ recordedAt: -1 }).lean()
    res.json({ success: true, data: latest || null })
  } catch (err) { next(err) }
})

// ─── POST /api/vitals ─────────────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const { patientId: bodyPatientId, heartRate, systolic, diastolic,
            temperature, spo2, bloodGlucose, weight, respiratoryRate, notes, source } = req.body

    const patientId = req.user.role === 'patient' ? req.user._id : bodyPatientId

    const vitals = await Vitals.create({
      patientId,
      recordedBy: req.user._id,
      heartRate, systolic, diastolic,
      temperature, spo2, bloodGlucose,
      weight, respiratoryRate, notes,
      source: source || 'manual',
    })

    // Real-time push to patient's room AND any connected doctors/attendees watching
    const io = req.app.get('io')
    io?.to(`patient:${patientId}`).emit('vitals:new', vitals)

    res.status(201).json({ success: true, data: vitals })
  } catch (err) { next(err) }
})

// ─── GET /api/vitals/chart ────────────────────────────────────────────────
// Returns last N readings formatted for Recharts
router.get('/chart', async (req, res, next) => {
  try {
    const patientId = req.user.role === 'patient' ? req.user._id : req.query.patientId
    const { metric = 'heartRate', days = 7 } = req.query

    const from = new Date()
    from.setDate(from.getDate() - Number(days))

    const vitals = await Vitals.find({ patientId, recordedAt: { $gte: from } })
      .sort({ recordedAt: 1 })
      .select(`recordedAt ${metric}`)
      .lean()

    const chart = vitals.map(v => ({
      time: new Date(v.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      value: v[metric],
    }))

    res.json({ success: true, metric, data: chart })
  } catch (err) { next(err) }
})

module.exports = router
