const express = require('express')
const router = express.Router()
const Medication = require('../models/Medication')
const { protect, restrictTo } = require('../middleware/auth')

router.use(protect)

// ─── GET /api/medications ─────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const patientId = req.user.role === 'patient'
      ? req.user._id
      : req.query.patientId

    if (!patientId) return res.status(400).json({ success: false, message: 'patientId required' })

    const meds = await Medication.find({ patientId, isActive: true }).sort({ createdAt: -1 }).lean()
    res.json({ success: true, data: meds })
  } catch (err) { next(err) }
})

// ─── POST /api/medications ────────────────────────────────────────────────
router.post('/', restrictTo('doctor'), async (req, res, next) => {
  try {
    const { patientId, name, dose, frequency, times, purpose, refillDate, warning, color } = req.body
    const med = await Medication.create({
      patientId, name, dose, frequency, times, purpose,
      prescriberId: req.user._id,
      prescriberName: req.user.name,
      refillDate: refillDate ? new Date(refillDate) : null,
      warning, color,
    })

    const io = req.app.get('io')
    io?.to(`user:${patientId}`).emit('medication:created', med)

    res.status(201).json({ success: true, data: med })
  } catch (err) { next(err) }
})

// ─── PATCH /api/medications/:id/taken ────────────────────────────────────
// Patient marks a dose as taken/untaken for today
router.patch('/:id/taken', async (req, res, next) => {
  try {
    const { doseIndex, taken } = req.body
    const today = new Date().toISOString().split('T')[0]

    const med = await Medication.findById(req.params.id)
    if (!med) return res.status(404).json({ success: false, message: 'Not found' })

    if (req.user.role === 'patient' && String(med.patientId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Forbidden' })
    }

    // Remove existing log entry for today + doseIndex, then add updated one
    med.takenLog = med.takenLog.filter(l => !(l.date === today && l.doseIndex === doseIndex))
    med.takenLog.push({ date: today, doseIndex, taken, takenAt: new Date() })
    await med.save()

    res.json({ success: true, data: med })
  } catch (err) { next(err) }
})

// ─── DELETE /api/medications/:id ─────────────────────────────────────────
router.delete('/:id', restrictTo('doctor'), async (req, res, next) => {
  try {
    const med = await Medication.findByIdAndUpdate(req.params.id, { isActive: false })
    if (!med) return res.status(404).json({ success: false, message: 'Not found' })
    res.json({ success: true, message: 'Medication deactivated' })
  } catch (err) { next(err) }
})

module.exports = router
