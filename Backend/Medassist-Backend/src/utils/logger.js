const { createLogger, format, transports } = require('winston')

// ── Application Insights custom Winston transport ────────────────────────────
// Forwards every Winston log entry to App Insights as a custom trace so all
// structured logs are queryable in Log Analytics via the traces / exceptions
// tables.  The transport is a no-op when App Insights is not initialised
// (local dev without APPLICATIONINSIGHTS_CONNECTION_STRING).
class AppInsightsTransport extends transports.Console {
  constructor(opts) { super(opts) }
  log(info, callback) {
    setImmediate(() => this.emit('logged', info))
    try {
      const appInsights = require('applicationinsights')
      const client = appInsights.defaultClient
      if (client) {
        const severity = info.level === 'error'   ? appInsights.Contracts.SeverityLevel.Error
                       : info.level === 'warn'    ? appInsights.Contracts.SeverityLevel.Warning
                       : info.level === 'verbose' ? appInsights.Contracts.SeverityLevel.Verbose
                       : appInsights.Contracts.SeverityLevel.Information
        // Strip ANSI colour codes that Winston adds for console output
        const message = String(info.message).replace(/\x1B\[[0-9;]*m/g, '')
        client.trackTrace({
          message,
          severity,
          properties: {
            service: 'medassist-backend',
            ...Object.fromEntries(
              Object.entries(info).filter(([k]) => !['level', 'message', 'timestamp', 'Symbol(level)', 'Symbol(splat)'].includes(k))
            ),
          },
        })
        if (info.level === 'error' && info.stack) {
          client.trackException({ exception: new Error(message) })
        }
      }
    } catch (_) { /* App Insights not initialised — silently skip */ }
    if (callback) callback()
  }
}

const logger = createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.json()
  ),
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ''
          return `${timestamp} [${level}]: ${message}${metaStr}`
        })
      ),
    }),
    // Sends all Winston logs to Application Insights → Log Analytics traces table
    new AppInsightsTransport({ silent: true }),
  ],
})

module.exports = logger
