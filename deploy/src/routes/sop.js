/**
 * SOP Routes
 * 
 * GET    /api/sop           — list SOPs (patient: own approved | doctor: all assigned)
 * GET    /api/sop/:id       — get single SOP
 * PATCH  /api/sop/:id       — edit SOP fields (doctor only)
 * PATCH  /api/sop/:id/approve — approve SOP (doctor only)
 * PATCH  /api/sop/:id/reject  — reject SOP (doctor only)
 * DELETE /api/sop/:id       — delete SOP (doctor only)
 */

const express = require('express')
const router  = express.Router()
const SOP     = require('../models/SOP')
const { protect, restrictTo } = require('../middleware/auth')

// ── Helper: emit socket notification ─────────────────────────────────────────
function emitNotification(req, userId, notification) {
  try {
    const io = req.app.get('io')
    if (io) {
      io.to(`user:${userId}`).emit('notification:received', notification)
    }
  } catch (_) {}
}

// ── GET /api/sop ──────────────────────────────────────────────────────────────
router.get('/', protect, async (req, res, next) => {
  try {
    const { user } = req
    let query = {}

    if (user.role === 'patient') {
      // Patients see only their own APPROVED SOPs
      query = { patientId: user._id, status: 'approved' }
    } else if (user.role === 'doctor') {
      // Doctors see all SOPs where they are the assigned doctor OR unassigned
      query = { $or: [{ doctorId: user._id }, { doctorId: null }] }
    } else {
      return res.status(403).json({ message: 'Forbidden' })
    }

    const sops = await SOP.find(query)
      .populate('patientId', 'name email role')
      .populate('doctorId',  'name email role')
      .sort({ createdAt: -1 })
      .lean()

    res.json({ data: sops })
  } catch (err) {
    next(err)
  }
})

// ── GET /api/sop/:id ──────────────────────────────────────────────────────────
router.get('/:id', protect, async (req, res, next) => {
  try {
    const sop = await SOP.findById(req.params.id)
      .populate('patientId', 'name email role')
      .populate('doctorId',  'name email role')
      .lean()

    if (!sop) return res.status(404).json({ message: 'SOP not found' })

    const { user } = req
    // Patients can only view their own approved SOPs
    if (user.role === 'patient') {
      if (String(sop.patientId._id) !== String(user._id) || sop.status !== 'approved') {
        return res.status(403).json({ message: 'Forbidden' })
      }
    }

    res.json({ data: sop })
  } catch (err) {
    next(err)
  }
})

// ── PATCH /api/sop/:id — edit (doctor only) ────────────────────────────────
router.patch('/:id', protect, restrictTo('doctor'), async (req, res, next) => {
  try {
    const { soapData, doctorNote } = req.body
    const sop = await SOP.findById(req.params.id)
    if (!sop) return res.status(404).json({ message: 'SOP not found' })

    if (sop.status !== 'pending') {
      return res.status(400).json({ message: 'Cannot edit an approved or rejected SOAP record' })
    }

    if (soapData) {
      sop.soapData = { ...sop.soapData.toObject(), ...soapData }
    }
    if (doctorNote !== undefined) sop.doctorNote = doctorNote

    await sop.save()
    const updated = await SOP.findById(sop._id)
      .populate('patientId', 'name email role')
      .populate('doctorId',  'name email role')
      .lean()

    res.json({ data: updated })
  } catch (err) {
    next(err)
  }
})

// ── PATCH /api/sop/:id/approve ────────────────────────────────────────────────
router.patch('/:id/approve', protect, restrictTo('doctor'), async (req, res, next) => {
  try {
    const sop = await SOP.findById(req.params.id).populate('patientId', 'name email')
    if (!sop) return res.status(404).json({ message: 'SOP not found' })

    sop.status    = 'approved'
    sop.doctorId  = req.user._id
    sop.doctorNote = req.body.doctorNote || sop.doctorNote
    await sop.save()

    emitNotification(req, String(sop.patientId._id), {
      type: 'sop:approved',
      message: `Your SOAP record has been approved by Dr. ${req.user.name}`,
      sopId: sop._id,
      time: new Date().toISOString(),
    })

    const updated = await SOP.findById(sop._id)
      .populate('patientId', 'name email role')
      .populate('doctorId',  'name email role')
      .lean()

    res.json({ data: updated })
  } catch (err) {
    next(err)
  }
})

// ── PATCH /api/sop/:id/reject ─────────────────────────────────────────────────
router.patch('/:id/reject', protect, restrictTo('doctor'), async (req, res, next) => {
  try {
    const sop = await SOP.findById(req.params.id).populate('patientId', 'name email')
    if (!sop) return res.status(404).json({ message: 'SOP not found' })

    sop.status    = 'rejected'
    sop.doctorId  = req.user._id
    sop.doctorNote = req.body.doctorNote || sop.doctorNote
    await sop.save()

    emitNotification(req, String(sop.patientId._id), {
      type: 'sop:rejected',
      message: `Your SOAP record has been reviewed. Please consult your doctor.`,
      sopId: sop._id,
      time: new Date().toISOString(),
    })

    const updated = await SOP.findById(sop._id)
      .populate('patientId', 'name email role')
      .populate('doctorId',  'name email role')
      .lean()

    res.json({ data: updated })
  } catch (err) {
    next(err)
  }
})

// ── DELETE /api/sop/:id ───────────────────────────────────────────────────────
router.delete('/:id', protect, restrictTo('doctor'), async (req, res, next) => {
  try {
    await SOP.findByIdAndDelete(req.params.id)
    res.json({ message: 'SOP deleted' })
  } catch (err) {
    next(err)
  }
})

module.exports = router