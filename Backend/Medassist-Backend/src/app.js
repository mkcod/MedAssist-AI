// ── Application Insights — MUST be first, before any other require ──────────
// Auto-collects HTTP requests, dependencies (MongoDB, HTTP), exceptions, logs.
const appInsights = require('applicationinsights')
if (process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
  appInsights
    .setup(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING)
    .setAutoDependencyCorrelation(true)
    .setAutoCollectRequests(true)
    .setAutoCollectPerformance(true, true)
    .setAutoCollectExceptions(true)
    .setAutoCollectDependencies(true)
    .setAutoCollectConsole(true, true)   // captures console.log / warn / error
    .setUseDiskRetryCaching(true)
    .setSendLiveMetrics(true)
    .start()
}

require('dotenv').config()
const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const rateLimit = require('express-rate-limit')

const { connectDB } = require('./config/database')
const { loadAllSecrets } = require('./config/keyVault')
const errorHandler = require('./middleware/errorHandler')
const setupSocket = require('./socket')
const logger = require('./utils/logger')

// ─── Routes ───────────────────────────────────────────────────────────────
const authRoutes         = require('./routes/auth')
const appointmentRoutes  = require('./routes/appointments')
const recordRoutes       = require('./routes/records')
const medicationRoutes   = require('./routes/medications')
const vitalsRoutes       = require('./routes/vitals')
const usersRoutes        = require('./routes/users')
const chatRoutes         = require('./routes/chat')
const voiceRoutes        = require('./routes/voice')
const dashboardRoutes    = require('./routes/dashboard')
// ── NEW ──────────────────────────────────────────────────────────────────
const sopRoutes          = require('./routes/sop')
const orchestratorRoutes = require('./routes/orchestrator')

const app    = express()
const server = http.createServer(app)


// ─── Security & Middleware ─────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))

// ✅ STEP 1 — CORS config
const corsOptions = {
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:8080',
    'https://medassistaistorage.z20.web.core.windows.net',
    'https://az-webapp-cc-wnsvha1-gqegeee9gbachpdj.canadacentral-01.azurewebsites.net',
  ],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}

// ✅ STEP 2 — Handle OPTIONS preflight FIRST (before all routes)
app.options('*', cors(corsOptions))

// ✅ STEP 3 — Apply CORS to all routes
app.use(cors(corsOptions))
// ─── Socket.io ────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: [process.env.FRONTEND_URL||'http://localhost:5173', 'https://az-webapp-cc-wnsvha1-gqegeee9gbachpdj.canadacentral-01.azurewebsites.net', // ✅ Add
      'https://medassistaistorage.z20.web.core.windows.net', 
       ],
   methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  },
})
setupSocket(io)
app.set('io', io)

// ─── Security & Middleware ────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))




app.use(cors({
  origin: [
    'https://medassistaistorage.z20.web.core.windows.net',
    'https://az-webapp-cc-wnsvha1-gqegeee9gbachpdj.canadacentral-01.azurewebsites.net', // ✅ Add this
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:8080'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
app.use(morgan('dev'))

// ─── Rate limiting ────────────────────────────────────────────────────────
app.use('/api/auth', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, message: 'Too many requests. Please try again later.' },
}))

app.use('/api/', rateLimit({ windowMs: 60 * 1000, max: 200 }))


//Connnection Check (handled by React SPA in production; kept for local API smoke-test)
app.get('/ping', (req, res) => {
  res.json({ message: 'MedAssist API is running', version: '1.0.0' });
});

// ─── Health check ─────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'MedAssist API',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
  })
})

// ─── API Routes ───────────────────────────────────────────────────────────
app.use('/api/auth',         authRoutes)
app.use('/api/appointments', appointmentRoutes)
app.use('/api/records',      recordRoutes)
app.use('/api/medications',  medicationRoutes)
app.use('/api/vitals',       vitalsRoutes)
app.use('/api/users',        usersRoutes)
app.use('/api/chat',         chatRoutes)
app.use('/api/voice',        voiceRoutes)
app.use('/api/dashboard',    dashboardRoutes)
// ── NEW ──────────────────────────────────────────────────────────────────
app.use('/api/sop',          sopRoutes)
app.use('/api/orchestrator', orchestratorRoutes)

// ─── Serve React frontend (production) ───────────────────────────────────
const path = require('path')
const frontendDist = path.join(__dirname, '../public')
app.use(express.static(frontendDist))
// SPA fallback: serve index.html for all non-API routes
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'))
})

// ─── 404 (API routes only) ────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` })
})

// ─── Global Error Handler ─────────────────────────────────────────────────
app.use(errorHandler)

// ─── Start ────────────────────────────────────────────────────────────────
// ─── Start ────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000

async function start() {
  try {
    await loadAllSecrets()
    await connectDB()
    // Attach error handler to avoid unhandled 'error' events (EADDRINUSE etc.)
    server.on('error', (err) => {
      if (err && err.code === 'EADDRINUSE') {
        logger.error(`Port ${PORT} already in use: ${err.message}`)
        process.exit(1)
      }
      logger.error(`Server error: ${err && err.message}`)
      process.exit(1)
    })

    server.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 MedAssist API running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`)
      logger.info(`📡 Socket.io ready`)
      logger.info(`🏥 Health check: http://localhost:${PORT}/health`)
    })
  } catch (err) {
    logger.error(`Failed to start: ${err.message}`)
    process.exit(1)
  }
}

start()

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('SIGINT received: shutting down server')
  server.close(() => process.exit(0))
})

process.on('SIGTERM', () => {
  logger.info('SIGTERM received: shutting down server')
  server.close(() => process.exit(0))
})
