const express = require('express')
const router = express.Router()
const jwt = require('jsonwebtoken')
const { body, validationResult } = require('express-validator')
const User = require('../models/User')
const { protect } = require('../middleware/auth')
const logger = require('../utils/logger')

// ─── Helper: sign JWT ─────────────────────────────────────────────────────
function signToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  })
}

function sendTokenResponse(user, statusCode, res) {
  const token = signToken(user._id)
  // Build frontend-compatible user object
  const userPayload = {
    id: user._id,
    email: user.email,
    role: user.role,
    name: user.name,
    initials: user.initials,
    subtitle: user.subtitle,
    color: user.color,
    extra: user.role === 'patient'      ? user.patientProfile
         : user.role === 'doctor'       ? user.doctorProfile
         : user.role === 'receptionist' ? user.receptionistProfile
         : user.attendeeProfile,
  }
  res.status(statusCode).json({ success: true, token, user: userPayload })
}

// ─── POST /api/auth/register ──────────────────────────────────────────────
router.post('/register', [
  body('email').isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password min 6 characters'),
  body('name').notEmpty().withMessage('Name required'),
  body('role').isIn(['patient','doctor','receptionist','attendee']).withMessage('Invalid role'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() })
    }

    const { email, password, name, role, phone, patientProfile, doctorProfile, receptionistProfile, attendeeProfile } = req.body

    const existing = await User.findOne({ email })
    if (existing) return res.status(409).json({ success: false, message: 'Email already registered' })

    const userData = {
      email, password, name, role, phone,
      initials: name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
    }

    // Role-specific profile
    if (role === 'patient' && patientProfile) {
      userData.patientProfile = patientProfile
      userData.subtitle = `Patient ID #${Math.floor(Math.random() * 9000 + 1000)}`
      userData.color = 'from-brand-400 to-teal-500'
    }
    if (role === 'doctor' && doctorProfile) {
      userData.doctorProfile = doctorProfile
      userData.subtitle = `${doctorProfile.specialty} · Reg #${doctorProfile.regNumber || 'MCI-00000'}`
      userData.color = 'from-pink-400 to-rose-500'
    }
    if (role === 'receptionist' && receptionistProfile) {
      userData.receptionistProfile = receptionistProfile
      userData.subtitle = `Front Desk · ${receptionistProfile.department || 'OPD'}`
      userData.color = 'from-violet-400 to-purple-500'
    }
    if (role === 'attendee' && attendeeProfile) {
      userData.attendeeProfile = attendeeProfile
      userData.color = 'from-amber-400 to-orange-500'
    }

    const user = await User.create(userData)
    logger.info(`New user registered: ${email} [${role}]`)
    sendTokenResponse(user, 201, res)
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/auth/login ─────────────────────────────────────────────────
router.post('/login', [
  body('email').isEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() })
    }

    const { email, password } = req.body
    const user = await User.findOne({ email }).select('+password')

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' })
    }

    const match = await user.comparePassword(password)
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' })
    }

    // Update last login
    user.lastLogin = new Date()
    await user.save({ validateBeforeSave: false })

    logger.info(`Login: ${email} [${user.role}]`)
    sendTokenResponse(user, 200, res)
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/auth/me ─────────────────────────────────────────────────────
router.get('/me', protect, async (req, res) => {
  const user = req.user
  res.json({
    success: true,
    user: {
      id: user._id,
      email: user.email,
      role: user.role,
      name: user.name,
      initials: user.initials,
      subtitle: user.subtitle,
      color: user.color,
      extra: user.role === 'patient'      ? user.patientProfile
           : user.role === 'doctor'       ? user.doctorProfile
           : user.role === 'receptionist' ? user.receptionistProfile
           : user.attendeeProfile,
    },
  })
})

// ─── POST /api/auth/logout ────────────────────────────────────────────────
// JWT is stateless — client just drops the token.
// This endpoint exists for audit logging.
router.post('/logout', protect, (req, res) => {
  logger.info(`Logout: ${req.user.email}`)
  res.json({ success: true, message: 'Logged out successfully' })
})

module.exports = router
