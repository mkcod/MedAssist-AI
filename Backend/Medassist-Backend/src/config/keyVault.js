const { SecretClient } = require('@azure/keyvault-secrets')
const { DefaultAzureCredential } = require('@azure/identity')
const logger = require('../utils/logger')

let secretClient = null

function getSecretClient() {
  if (!secretClient) {
    const vaultUri = process.env.AZURE_KEY_VAULT_URI
    if (!vaultUri) {
      logger.warn('AZURE_KEY_VAULT_URI not set — Key Vault disabled')
      return null
    }
    // DefaultAzureCredential: uses Managed Identity on App Service,
    // and env vars (AZURE_TENANT_ID etc.) locally
    const credential = new DefaultAzureCredential()
    secretClient = new SecretClient(vaultUri, credential)
  }
  return secretClient
}

/**
 * Load a secret from Key Vault with fallback to process.env
 * Key Vault secret names use hyphens (e.g. "JWT-SECRET"),
 * env vars use underscores (e.g. "JWT_SECRET")
 */
async function getSecret(secretName) {
  const client = getSecretClient()
  if (!client) {
    // fallback: convert "JWT-SECRET" → "JWT_SECRET"
    return process.env[secretName.replace(/-/g, '_')] || null
  }
  try {
    const secret = await client.getSecret(secretName)
    return secret.value
  } catch (err) {
    logger.warn(`Key Vault: secret "${secretName}" not found, using env fallback. ${err.message}`)
    return process.env[secretName.replace(/-/g, '_')] || null
  }
}

/**
 * Set a secret in Key Vault
 */
async function setSecret(secretName, value) {
  const client = getSecretClient()
  if (!client) throw new Error('Key Vault not configured')
  await client.setSecret(secretName, value)
  logger.info(`Key Vault: secret "${secretName}" updated`)
}

/**
 * Load ALL secrets from Key Vault into process.env at startup.
 * Secret names like "JWT-SECRET" become env vars "JWT_SECRET".
 * Skips secrets already set in process.env (local overrides take precedence).
 */
async function loadAllSecrets() {
  const client = getSecretClient()
  if (!client) {
    logger.warn('Key Vault not configured — skipping secret preload')
    return
  }
  try {
    const secrets = client.listPropertiesOfSecrets()
    for await (const secretProps of secrets) {
      const envKey = secretProps.name.replace(/-/g, '_')
      if (process.env[envKey]) continue // already set locally, skip
      try {
        const secret = await client.getSecret(secretProps.name)
        process.env[envKey] = secret.value
        logger.info(`Key Vault: loaded secret "${secretProps.name}" → process.env.${envKey}`)
      } catch (err) {
        logger.warn(`Key Vault: failed to load "${secretProps.name}": ${err.message}`)
      }
    }
    logger.info('Key Vault: all secrets loaded into process.env')
  } catch (err) {
    logger.error(`Key Vault: failed to list secrets: ${err.message}`)
    throw err
  }
}

module.exports = { getSecret, setSecret, loadAllSecrets }
