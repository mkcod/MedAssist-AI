const jwt = require('jsonwebtoken')
const logger = require('../utils/logger')

module.exports = function setupSocket(io) {
  // ─── Auth middleware for socket ──────────────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token
    if (!token) return next(new Error('Authentication required'))
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      socket.userId = decoded.id
      socket.userRole = decoded.role
      next()
    } catch {
      next(new Error('Invalid token'))
    }
  })

  io.on('connection', (socket) => {
    const userId = socket.userId
    logger.info(`Socket connected: user ${userId}`)

    // Each user joins their own room
    socket.join(`user:${userId}`)

    // Patients also join a 'patient:ID' room for vitals broadcasts
    if (socket.userRole === 'patient') {
      socket.join(`patient:${userId}`)
    }

    // ── Doctor watches a patient's live vitals ───────────────────────
    socket.on('watch:patient', (patientId) => {
      if (socket.userRole === 'doctor' || socket.userRole === 'attendee') {
        socket.join(`patient:${patientId}`)
        logger.debug(`User ${userId} watching patient ${patientId}`)
      }
    })

    socket.on('unwatch:patient', (patientId) => {
      socket.leave(`patient:${patientId}`)
    })

    // ── Client sends live vitals (from a device/IoT integration) ────
    socket.on('vitals:push', (data) => {
      io.to(`patient:${data.patientId}`).emit('vitals:new', {
        ...data,
        timestamp: new Date().toISOString(),
      })
    })

    // ── Notifications ────────────────────────────────────────────────
    socket.on('notification:send', ({ targetUserId, notification }) => {
      io.to(`user:${targetUserId}`).emit('notification:received', notification)
    })

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: user ${userId}`)
    })
  })
}
