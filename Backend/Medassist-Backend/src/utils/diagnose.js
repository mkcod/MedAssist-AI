require('dotenv').config()
const dns  = require('dns')
const net  = require('net')

const connStr  = process.env.COSMOS_DB_CONNECTION_STRING || ''
const hostname = 'medassist-ai-db.mongocluster.cosmos.azure.com'
const srvHost  = '_mongodb._tcp.medassist-ai-db.global.mongocluster.cosmos.azure.com'
const port     = 10260

console.log('\n════════════════════════════════════════')
console.log('  MedAssist — Connection Diagnostics')
console.log('════════════════════════════════════════\n')

// 1. Show what .env has
console.log('1️⃣  .env Connection String:')
console.log('   ', connStr ? connStr.substring(0, 80) + '...' : '❌ NOT SET')
console.log('   Type:', connStr.startsWith('mongodb+srv') ? '⚠️  SRV (will cause DNS SRV error)' : '✅ Direct (mongodb://)')
console.log()

// 2. Test DNS A record
console.log('2️⃣  DNS A record test for:', hostname)
dns.resolve4(hostname, (err, addresses) => {
  if (err) {
    console.log('   ❌ DNS A FAILED:', err.message)
    console.log('   → Your network cannot resolve Cosmos DB hostname at all')
    console.log('   → Try mobile hotspot or VPN\n')
  } else {
    console.log('   ✅ DNS A OK — IP(s):', addresses.join(', '), '\n')
  }

  // 3. Test DNS SRV record
  console.log('3️⃣  DNS SRV record test:')
  dns.resolveSrv(srvHost, (err2, records) => {
    if (err2) {
      console.log('   ❌ DNS SRV FAILED:', err2.message)
      console.log('   → This is why mongodb+srv:// fails on your network\n')
    } else {
      console.log('   ✅ DNS SRV OK — records:', JSON.stringify(records), '\n')
    }

    // 4. Test TCP connection to port 10260
    console.log('4️⃣  TCP connection test to', hostname + ':' + port)
    const socket = new net.Socket()
    socket.setTimeout(8000)

    socket.connect(port, hostname, () => {
      console.log('   ✅ TCP PORT 10260 OPEN — direct connection will work!')
      console.log()
      socket.destroy()
      printSummary(true)
    })

    socket.on('timeout', () => {
      console.log('   ❌ TCP TIMEOUT — port 10260 is blocked by firewall/network')
      socket.destroy()
      printSummary(false)
    })

    socket.on('error', (e) => {
      console.log('   ❌ TCP ERROR:', e.message)
      printSummary(false)
    })
  })
})

function printSummary(tcpOk) {
  console.log('════════════════════════════════════════')
  console.log('  SUMMARY & FIX')
  console.log('════════════════════════════════════════')

  const isSrv = connStr.startsWith('mongodb+srv')

  if (isSrv && tcpOk) {
    console.log('\n✅ Network OK but .env still has mongodb+srv://')
    console.log('\n📋 CHANGE your .env to this exact string:\n')
    console.log('COSMOS_DB_CONNECTION_STRING=mongodb://WNSHA:MedAssist-AI@medassist-ai-db.mongocluster.cosmos.azure.com:10260/?tls=true&authMechanism=SCRAM-SHA-256&retrywrites=false&maxIdleTimeMS=120000\n')
    console.log('Then run: npm run seed\n')
  } else if (!isSrv && !tcpOk) {
    console.log('\n❌ Network is blocking port 10260 (Cosmos DB direct port)')
    console.log('\n💡 SOLUTIONS:')
    console.log('   1. Switch to MOBILE HOTSPOT and try again')
    console.log('   2. Ask your network admin to allow outbound TCP to port 10260')
    console.log('   3. Use a VPN\n')
  } else if (!isSrv && tcpOk) {
    console.log('\n✅ Network OK + Direct connection string set')
    console.log('   → Run: npm run seed\n')
  } else {
    console.log('\n❌ Both DNS SRV and TCP port 10260 are blocked')
    console.log('   → You must use MOBILE HOTSPOT or VPN\n')
  }
}
