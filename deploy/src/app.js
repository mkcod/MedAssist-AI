require('dotenv').config()
const express = require('express')
const http = require('http')
const path = require('path')
const { Server } = require('socket.io')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const rateLimit = require('express-rate-limit')

const { connectDB } = require('./config/database')
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

// ─── Socket.io ────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
})
setupSocket(io)
app.set('io', io)

// ─── Security & Middleware ────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))




// CORS: when frontend is served by this same server the origin is the webapp URL.
// FRONTEND_URL is set via App Service app settings (injected by deploy-all.sh).
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:3000',
].filter(Boolean)

app.use(cors({
  origin: (origin, cb) => {
    // allow requests with no origin (server-to-server, curl, etc.)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true)
    cb(new Error(`CORS: origin '${origin}' not allowed`))
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}))

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

// ─── Serve React frontend (built by CI/CD into ./public) ─────────────────
// All non-/api, non-/health routes serve the SPA index.html
const PUBLIC_DIR = path.join(__dirname, '..', 'public')
app.use(express.static(PUBLIC_DIR))

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path === '/health') return next()
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'), (err) => {
    if (err) res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` })
  })
})

// ─── 404 (API routes only reach here) ────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` })
})

// ─── Global Error Handler ─────────────────────────────────────────────────
app.use(errorHandler)

// ─── Start ────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000

// ─── Key Vault bootstrap ──────────────────────────────────────────────────
// Load all secrets from Key Vault into process.env before anything else starts.
// On App Service the Managed Identity is used automatically.
// Locally, set AZURE_TENANT_ID + AZURE_CLIENT_ID + AZURE_CLIENT_SECRET in .env
// for DefaultAzureCredential to pick up.
//
// KV secret name (hyphenated) → env var name (underscored)
const KV_SECRET_MAP = {
  'JWT-SECRET':                     'JWT_SECRET',
  'INTERNAL-API-SECRET':            'INTERNAL_API_SECRET',
  'COSMOS-DB-CONNECTION-STRING':    'COSMOS_DB_CONNECTION_STRING',
  'AZURE-STORAGE-CONNECTION-STRING':'AZURE_STORAGE_CONNECTION_STRING',
  'AZURE-OPENAI-API-KEY':           'AZURE_OPENAI_API_KEY',
  'OPENAI-API-KEY':                 'OPENAI_API_KEY',
  'SPEECH-KEY':                     'SPEECH_KEY',
  'AZURE-SEARCH-ADMIN-KEY':         'AZURE_SEARCH_ADMIN_KEY',
}

async function loadSecretsFromKeyVault() {
  const { getSecret } = require('./config/keyVault')
  const vaultUri = process.env.AZURE_KEY_VAULT_URI
  if (!vaultUri) {
    logger.warn('AZURE_KEY_VAULT_URI not set — secrets will be read from .env file only')
    return
  }
  logger.info(`Loading secrets from Key Vault: ${vaultUri}`)
  await Promise.all(
    Object.entries(KV_SECRET_MAP).map(async ([kvName, envName]) => {
      // Only overwrite if the env var isn't already set (allows .env override for local dev)
      if (process.env[envName]) return
      const value = await getSecret(kvName)
      if (value) {
        process.env[envName] = value
        logger.debug(`  KV → ${envName} loaded`)
      }
    })
  )
  logger.info('Key Vault secrets loaded')
}

async function start() {
  try {
    await loadSecretsFromKeyVault()
    await connectDB()
    server.listen(PORT, () => {
      logger.info(`MedAssist API running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`)
      logger.info(`Socket.io ready`)
      logger.info(`Health check: http://localhost:${PORT}/health`)
    })
  } catch (err) {
    logger.error(`Failed to start: ${err.message}`)
    // If DB is unavailable, still start the server (frontend + health check will work)
    // API routes that require DB will return 503 until DB reconnects
    if (err.message.includes('COSMOS_DB_CONNECTION_STRING') || err.message.includes('connect')) {
      logger.warn('Starting without DB — API endpoints will fail until DB is available')
      server.listen(PORT, () => {
        logger.info(`MedAssist API (degraded — no DB) running on port ${PORT}`)
      })
    } else {
      process.exit(1)
    }
  }
}

start()