const { BlobServiceClient, generateBlobSASQueryParameters, BlobSASPermissions, StorageSharedKeyCredential } = require('@azure/storage-blob')
const { v4: uuidv4 } = require('uuid')
const logger = require('../utils/logger')

let blobServiceClient = null
let containerClient = null

function getBlobServiceClient() {
  if (!blobServiceClient) {
    const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING
    if (!connStr) throw new Error('AZURE_STORAGE_CONNECTION_STRING not set')
    blobServiceClient = BlobServiceClient.fromConnectionString(connStr)
  }
  return blobServiceClient
}

async function getContainerClient() {
  if (!containerClient) {
    const client = getBlobServiceClient()
    const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'medassist-files'
    containerClient = client.getContainerClient(containerName)
    // Create container if it doesn't exist
    await containerClient.createIfNotExists({ access: 'private' })
    logger.info(`Blob Storage: container "${containerName}" ready`)
  }
  return containerClient
}

/**
 * Upload a file buffer to Azure Blob Storage
 * @returns { blobName, url }
 */
async function uploadFile(fileBuffer, originalName, mimeType, folder = 'records') {
  const container = await getContainerClient()
  const ext = originalName.split('.').pop()
  const blobName = `${folder}/${uuidv4()}.${ext}`
  const blockBlobClient = container.getBlockBlobClient(blobName)

  await blockBlobClient.upload(fileBuffer, fileBuffer.length, {
    blobHTTPHeaders: { blobContentType: mimeType },
    metadata: { originalName, uploadedAt: new Date().toISOString() },
  })

  logger.info(`Blob Storage: uploaded ${blobName}`)
  return { blobName, url: blockBlobClient.url }
}

/**
 * Generate a time-limited SAS URL for secure file access (1 hour default)
 */
async function generateSASUrl(blobName, expiryMinutes = 60) {
  const container = await getContainerClient()
  const blockBlobClient = container.getBlockBlobClient(blobName)

  const expiresOn = new Date()
  expiresOn.setMinutes(expiresOn.getMinutes() + expiryMinutes)

  const sasUrl = await blockBlobClient.generateSasUrl({
    permissions: BlobSASPermissions.parse('r'),
    expiresOn,
  })
  return sasUrl
}

/**
 * Delete a blob
 */
async function deleteFile(blobName) {
  const container = await getContainerClient()
  const blockBlobClient = container.getBlockBlobClient(blobName)
  await blockBlobClient.deleteIfExists()
  logger.info(`Blob Storage: deleted ${blobName}`)
}

/**
 * List all blobs with a prefix (e.g. "records/P001/")
 */
async function listFiles(prefix) {
  const container = await getContainerClient()
  const blobs = []
  for await (const blob of container.listBlobsFlat({ prefix })) {
    blobs.push({ name: blob.name, size: blob.properties.contentLength, lastModified: blob.properties.lastModified })
  }
  return blobs
}

module.exports = { uploadFile, generateSASUrl, deleteFile, listFiles }
