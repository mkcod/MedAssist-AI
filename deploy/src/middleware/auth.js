const jwt = require('jsonwebtoken')
const User = require('../models/User')
const logger = require('../utils/logger')

/**
 * Protect routes — verifies Bearer JWT token
 */
const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided. Please log in.' })
    }

    const token = authHeader.split(' ')[1]
    let decoded
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET)
    } catch (err) {
      const msg = err.name === 'TokenExpiredError' ? 'Session expired. Please log in again.' : 'Invalid token.'
      return res.status(401).json({ success: false, message: msg })
    }

    const user = await User.findById(decoded.id).select('-password')
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'User not found or deactivated.' })
    }

    req.user = user
    next()
  } catch (err) {
    logger.error(`Auth middleware error: ${err.message}`)
    res.status(500).json({ success: false, message: 'Authentication error.' })
  }
}

/**
 * Restrict to specific roles
 * Usage: restrictTo('doctor', 'receptionist')
 */
const restrictTo = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: `Access denied. Required role(s): ${roles.join(', ')}`,
    })
  }
  next()
}

module.exports = { protect, restrictTo }
