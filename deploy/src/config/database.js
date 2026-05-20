const dns = require('dns')
const mongoose = require('mongoose')
const logger = require('../utils/logger')

let isConnected = false

function configureDnsForSrv() {
  const configuredServers = process.env.COSMOS_DNS_SERVERS
  if (!configuredServers) return []

  const servers = configuredServers
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)

  if (servers.length === 0) return []

  dns.setServers(servers)
  return servers
}

async function connectDB() {
  if (isConnected) return

  const connStr = process.env.COSMOS_DB_CONNECTION_STRING
  if (!connStr) throw new Error('COSMOS_DB_CONNECTION_STRING is not set in environment')

  const dbName = process.env.COSMOS_DB_NAME || 'medassist'

  // Detect vCore (mongodb+srv) vs RU-based (AccountEndpoint / mongodb://) Cosmos DB
  const isVCore = connStr.startsWith('mongodb+srv://')

  // ── Base options shared by both cluster types ───────────────────────────────
  const options = {
    dbName,
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 20000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10,
    minPoolSize: 2,
    heartbeatFrequencyMS: 10000,
  }

  if (isVCore) {
    const dnsServers = configureDnsForSrv()

    // ── Cosmos DB vCore (mongodb+srv) ─────────────────────────────────────────
    // vCore speaks standard MongoDB wire protocol — just enforce TLS.
    // Do NOT set retryWrites:false here; it's already in the SRV connection string.
    // Do NOT set directConnection:true — SRV needs replica-set discovery.
    // Do NOT set replicaSet — vCore has its own internal name; forcing 'globaldb'
    // (which is only for RU-based) causes server selection to time out.
    options.tls = true
    options.tlsAllowInvalidCertificates = false
    options.authMechanism = 'SCRAM-SHA-256'

    if (dnsServers.length > 0) {
      logger.info(`Using custom DNS resolvers for Cosmos SRV lookup → ${dnsServers.join(', ')}`)
    }
  } else {
    // ── Cosmos DB RU-based (mongodb://) ──────────────────────────────────────
    options.retryWrites = false
    options.tls = true
    options.tlsAllowInvalidCertificates = false
    options.directConnection = true      // RU-based is single-node
  }

  try {
    logger.info(`Connecting to Cosmos DB [${isVCore ? 'vCore/SRV' : 'RU-based'}] → ${dbName} …`)
    await mongoose.connect(connStr, options)
    isConnected = true
    logger.info(`✅ Azure Cosmos DB connected [${isVCore ? 'vCore' : 'RU-based'}] → ${dbName}`)
  } catch (err) {
    isConnected = false

    // ── Friendly diagnosis for the most common failure modes ─────────────────
    const msg = err.message || ''

    if (msg.includes('querySrv') && msg.includes('ECONNREFUSED')) {
      logger.error('❌ DNS SRV lookup refused.')
      logger.error('   Most likely causes:')
      logger.error('   1. Your IP is not in the Cosmos DB Firewall allowlist.')
      logger.error('      → Azure Portal → Cosmos DB cluster → Networking → Add current client IP')
      logger.error('   2. Corporate/ISP firewall is blocking outbound DNS SRV (UDP/TCP 53).')
      logger.error('      → Try on a different network or via VPN.')
      logger.error('   3. The cluster hostname is wrong or the cluster is not yet provisioned.')
      logger.error(`      → Double-check: COSMOS_DB_CONNECTION_STRING in .env`)
      logger.error('   4. Your local DNS resolver refuses SRV queries from Node.js.')
      logger.error('      → Set COSMOS_DNS_SERVERS=8.8.8.8,1.1.1.1 and retry')
    } else if (msg.includes('Authentication failed') || msg.includes('auth')) {
      logger.error('❌ Authentication failed — wrong username or password in connection string.')
    } else if (msg.includes('ENOTFOUND')) {
      logger.error('❌ Hostname not found. Check the cluster URL in COSMOS_DB_CONNECTION_STRING.')
    } else if (msg.includes('ETIMEDOUT') || msg.includes('timed out')) {
      logger.error('❌ Connection timed out.')
      if (isVCore) {
        logger.error('   → Cosmos DB vCore typically connects on port 10260 after SRV discovery.')
        logger.error('   → Outbound access to the resolved cluster host may be blocked by your firewall or network.')
      } else {
        logger.error('   → Cosmos DB Mongo API typically connects on port 10255.')
      }
      logger.error('   → Ensure your IP is whitelisted in Azure Portal → Cosmos DB → Networking.')
    } else {
      logger.error(`❌ Cosmos DB connection failed: ${err.message}`)
    }

    throw err
  }
}

// ── Event listeners ─────────────────────────────────────────────────────────
mongoose.connection.on('disconnected', () => {
  isConnected = false
  logger.warn('⚠️  Cosmos DB disconnected — will reconnect on next request')
})

mongoose.connection.on('reconnected', () => {
  isConnected = true
  logger.info('✅ Cosmos DB reconnected')
})

mongoose.connection.on('error', (err) => {
  isConnected = false
  logger.error(`Cosmos DB error: ${err.message}`)
})

/**
 * Gracefully disconnect (useful for seed scripts / process shutdown).
 */
async function disconnectDB() {
  if (!isConnected) return
  await mongoose.disconnect()
  isConnected = false
  logger.info('Cosmos DB connection closed')
}

module.exports = { connectDB, disconnectDB }
