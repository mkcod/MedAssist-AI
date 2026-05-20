const express = require('express')
const router = express.Router()
const { body, validationResult } = require('express-validator')
const Appointment = require('../models/Appointment')
const User = require('../models/User')
const { protect, restrictTo } = require('../middleware/auth')

// All routes require auth
router.use(protect)

// ─── GET /api/appointments ────────────────────────────────────────────────
// Patient: own appointments | Doctor: their appointments | Receptionist: all
router.get('/', async (req, res, next) => {
  try {
    const { role, _id } = req.user
    const { status, from, to, doctorId, patientId } = req.query

    let filter = {}
    if (role === 'patient')      filter.patientId = _id
    else if (role === 'doctor')  filter.doctorId  = _id
    else if (role === 'attendee') {
      const profile = req.user.attendeeProfile
      const patient = await User.findOne({ 'patientProfile.patientId': profile?.patientId })
      if (patient) filter.patientId = patient._id
    }
    // receptionist sees all — no filter on user

    if (status)   filter.status   = status
    if (doctorId) filter.doctorId = doctorId
    if (patientId && (role === 'doctor' || role === 'receptionist')) filter.patientId = patientId
    if (from || to) {
      filter.date = {}
      if (from) filter.date.$gte = new Date(from)
      if (to)   filter.date.$lte = new Date(to)
    }

    const appointments = await Appointment.find(filter)
      .sort({ date: -1, time: 1 })
      .populate('patientId', 'name initials color')
      .populate('doctorId', 'name initials color doctorProfile')
      .lean()

    res.json({ success: true, count: appointments.length, data: appointments })
  } catch (err) { next(err) }
})

// ─── POST /api/appointments ───────────────────────────────────────────────
router.post('/', [
  body('doctorId').notEmpty().withMessage('Doctor required'),
  body('date').isISO8601().withMessage('Valid date required'),
  body('time').notEmpty().withMessage('Time required'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() })

    const { doctorId, date, time, mode, notes } = req.body

    // Determine patient
    let patientId = req.user._id
    let patientName = req.user.name
    if (req.user.role === 'receptionist' && req.body.patientId) {
      const patient = await User.findById(req.body.patientId)
      if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' })
      patientId = patient._id
      patientName = patient.name
    }

    const doctor = await User.findById(doctorId)
    if (!doctor || doctor.role !== 'doctor') {
      return res.status(404).json({ success: false, message: 'Doctor not found' })
    }

    // Conflict check
    const conflict = await Appointment.findOne({
      doctorId, date: new Date(date), time, status: { $in: ['upcoming'] }
    })
    if (conflict) return res.status(409).json({ success: false, message: 'This slot is already booked' })

    const appt = await Appointment.create({
      patientId, patientName,
      doctorId: doctor._id, doctorName: doctor.name,
      specialty: doctor.doctorProfile?.specialty,
      doctorInitials: doctor.initials,
      doctorColor: doctor.color,
      date: new Date(date), time, mode: mode || 'in-person', notes,
    })

    // Emit real-time event
    const io = req.app.get('io')
    io?.to(`user:${patientId}`).emit('appointment:created', appt)
    io?.to(`user:${doctor._id}`).emit('appointment:created', appt)

    res.status(201).json({ success: true, data: appt })
  } catch (err) { next(err) }
})

// ─── PATCH /api/appointments/:id/status ──────────────────────────────────
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status, cancelReason } = req.body
    const validStatuses = ['upcoming','completed','cancelled','no-show']
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' })
    }

    const appt = await Appointment.findById(req.params.id)
    if (!appt) return res.status(404).json({ success: false, message: 'Appointment not found' })

    // Auth check: patient can only cancel their own
    if (req.user.role === 'patient' && String(appt.patientId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Forbidden' })
    }

    appt.status = status
    if (status === 'cancelled') {
      appt.cancelledBy = req.user.name
      appt.cancelReason = cancelReason
    }
    await appt.save()

    const io = req.app.get('io')
    io?.to(`user:${appt.patientId}`).emit('appointment:updated', appt)
    io?.to(`user:${appt.doctorId}`).emit('appointment:updated', appt)

    res.json({ success: true, data: appt })
  } catch (err) { next(err) }
})

// ─── DELETE /api/appointments/:id ─────────────────────────────────────────
router.delete('/:id', restrictTo('doctor','receptionist'), async (req, res, next) => {
  try {
    const appt = await Appointment.findByIdAndDelete(req.params.id)
    if (!appt) return res.status(404).json({ success: false, message: 'Not found' })
    res.json({ success: true, message: 'Appointment deleted' })
  } catch (err) { next(err) }
})

module.exports = router
