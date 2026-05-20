const express = require('express')
const router = express.Router()
const User = require('../models/User')
const { protect, restrictTo } = require('../middleware/auth')

router.use(protect)

// ─── GET /api/users/doctors ───────────────────────────────────────────────
// Get all doctors (for appointment booking dropdown)
router.get('/doctors', async (req, res, next) => {
  try {
    const doctors = await User.find({ role: 'doctor', isActive: true })
      .select('name initials color doctorProfile')
      .lean()

    const formatted = doctors.map(d => ({
      id: d._id,
      name: d.name,
      initials: d.initials,
      color: d.color,
      specialty: d.doctorProfile?.specialty,
      slots: d.doctorProfile?.availableSlots || [],
    }))

    res.json({ success: true, data: formatted })
  } catch (err) { next(err) }
})

// ─── GET /api/users/patients ──────────────────────────────────────────────
// Doctors & receptionists only
router.get('/patients', restrictTo('doctor', 'receptionist'), async (req, res, next) => {
  try {
    const { search } = req.query
    const filter = { role: 'patient', isActive: true }
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ]
    }

    const patients = await User.find(filter)
      .select('name initials color phone patientProfile createdAt')
      .lean()

    const formatted = patients.map(p => ({
      id: p._id,
      name: p.name,
      initials: p.initials,
      color: p.color,
      phone: p.phone,
      bloodGroup: p.patientProfile?.bloodGroup,
      age: p.patientProfile?.dateOfBirth
        ? Math.floor((Date.now() - new Date(p.patientProfile.dateOfBirth)) / (365.25 * 24 * 3600 * 1000))
        : null,
      condition: p.patientProfile?.conditions?.join(', ') || '',
      status: 'Active',
    }))

    res.json({ success: true, count: formatted.length, data: formatted })
  } catch (err) { next(err) }
})

// ─── GET /api/users/me/profile ────────────────────────────────────────────
router.get('/me/profile', async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).lean()
    res.json({ success: true, data: user })
  } catch (err) { next(err) }
})

// ─── PATCH /api/users/me/profile ─────────────────────────────────────────
router.patch('/me/profile', async (req, res, next) => {
  try {
    const allowed = ['name', 'phone', 'patientProfile', 'doctorProfile', 'receptionistProfile', 'attendeeProfile']
    const updates = {}
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f] })

    if (updates.name) {
      updates.initials = updates.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true })
    res.json({ success: true, data: user })
  } catch (err) { next(err) }
})

module.exports = router
