const { SecretClient } = require('@azure/keyvault-secrets')
const { DefaultAzureCredential, ManagedIdentityCredential } = require('@azure/identity')
const logger = require('../utils/logger')

let secretClient = null

function getSecretClient() {
  if (!secretClient) {
    const vaultUri = process.env.AZURE_KEY_VAULT_URI
    if (!vaultUri) {
      logger.warn('AZURE_KEY_VAULT_URI not set — Key Vault disabled')
      return null
    }
    // On Azure App Service (WEBSITE_SITE_NAME is always set), use system-assigned
    // Managed Identity directly — avoids DefaultAzureCredential picking up
    // AZURE_CLIENT_ID as a user-assigned identity client ID.
    // Locally, fall through to the full DefaultAzureCredential chain.
    const credential = process.env.WEBSITE_SITE_NAME
      ? new ManagedIdentityCredential()
      : new DefaultAzureCredential()
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

module.exports = { getSecret, setSecret }
