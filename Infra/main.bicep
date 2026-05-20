// ============================================================
// MediAssist-AI — Complete Azure Infrastructure
// One-click deployment: all resources in a single Bicep file
// ============================================================

@description('Short alphanumeric suffix for globally unique names (auto-generated)')
param suffix string = take(uniqueString(resourceGroup().id), 8)

@description('Primary region for Key Vault, OpenAI, Speech, Cosmos DB')
param location string = 'eastus'

@description('Region for App Service Plan and Web App')
param appServiceLocation string = 'canadacentral'

@description('Region for Storage Account')
param storageLocation string = 'eastus2'

@description('Region for Azure AI Search')
param searchLocation string = 'centralus'

@description('Cosmos DB administrator username')
param cosmosAdminUsername string = 'medassistadmin'

@description('Cosmos DB administrator password (min 8 chars, upper+lower+digit+symbol)')
@secure()
param cosmosAdminPassword string

@description('JWT secret for the Node.js backend')
@secure()
param jwtSecret string

@description('Internal API secret shared between Node.js and Python agents')
@secure()
param internalApiSecret string

// ── Derived resource names ─────────────────────────────────
var appServicePlanName = 'asp-mediassist-${suffix}'
var webAppName         = 'webapp-mediassist-${suffix}'
var storageAccountName = 'stmedassist${suffix}'
var keyVaultName       = 'kv-medai-${suffix}'
var openAiName         = 'aoai-mediassist-${suffix}'
var searchName         = 'srch-mediassist-${suffix}'
var speechName         = 'speech-mediassist-${suffix}'
var cosmosClusterName  = 'cosmos-mediassist-${suffix}'
var logAnalyticsName   = 'log-mediassist-${suffix}'
var appInsightsName    = 'appi-mediassist-${suffix}'

// Cosmos DB vCore hostname is deterministic — construct connection string here
var cosmosHost    = '${cosmosClusterName}.global.mongocluster.cosmos.azure.com'
var cosmosConnStr = 'mongodb+srv://${cosmosAdminUsername}:${cosmosAdminPassword}@${cosmosHost}/?tls=true&authMechanism=SCRAM-SHA-256&retrywrites=false&maxIdleTimeMS=120000'

// Use environment() so URLs work across Azure clouds (public, Gov, China)
var storageSuffix = environment().suffixes.storage

// ============================================================
// 1. Log Analytics Workspace
// ============================================================
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logAnalyticsName
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

// ============================================================
// 2. Application Insights
// ============================================================
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: appServiceLocation
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
    RetentionInDays: 30
  }
}

// ============================================================
// 3. Storage Account + Blob Containers
// ============================================================
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: storageLocation
  kind: 'StorageV2'
  sku: { name: 'Standard_LRS' }
  properties: {
    accessTier: 'Cool'
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    supportsHttpsTrafficOnly: true
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storageAccount
  name: 'default'
  properties: {
    deleteRetentionPolicy: { enabled: true, days: 7 }
    containerDeleteRetentionPolicy: { enabled: true, days: 7 }
  }
}

// Medical record file attachments (Node.js backend)
resource containerFiles 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'medassist-ai-files'
  properties: { publicAccess: 'None' }
}

// ICD-10 PDF knowledge base (summarizer + orchestrator agents)
resource containerKB1 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'az-medassistai-container1'
  properties: { publicAccess: 'None' }
}

// ICD-10 CSV index (summarizer agent)
resource containerKB2 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'az-medassistai-container2'
  properties: { publicAccess: 'None' }
}

// Note: $web container removed — React frontend is served by Node.js Express (backend/public)

// ============================================================
// 4. Key Vault (RBAC-based)
// ============================================================
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  properties: {
    sku: { family: 'A', name: 'standard' }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    publicNetworkAccess: 'Enabled'
  }
}

// ============================================================
// 5. Azure OpenAI
// ============================================================
resource openAi 'Microsoft.CognitiveServices/accounts@2023-10-01-preview' = {
  name: openAiName
  location: location
  kind: 'OpenAI'
  sku: { name: 'S0' }
  properties: {
    customSubDomainName: openAiName
    publicNetworkAccess: 'Enabled'
    disableLocalAuth: false
  }
}

// NOTE: Model deployments are created by deploy-all.sh (Step 3b) after the Bicep
// deployment completes. This avoids hardcoding model versions that may be deprecated.

// ============================================================
// 6. Azure AI Search (Basic — supports vector search)
// ============================================================
resource aiSearch 'Microsoft.Search/searchServices@2024-03-01-preview' = {
  name: searchName
  location: searchLocation
  sku: { name: 'basic' }
  properties: {
    replicaCount: 1
    partitionCount: 1
    publicNetworkAccess: 'Enabled'
    authOptions: { apiKeyOnly: {} }
  }
}

// ============================================================
// 7. Azure Cognitive Services — Speech
// ============================================================
resource speechService 'Microsoft.CognitiveServices/accounts@2023-10-01-preview' = {
  name: speechName
  location: location
  kind: 'SpeechServices'
  sku: { name: 'S0' }
  properties: {
    customSubDomainName: speechName
    publicNetworkAccess: 'Enabled'
    disableLocalAuth: false
  }
}

// ============================================================
// 8. Cosmos DB for MongoDB vCore
// ============================================================
resource cosmosCluster 'Microsoft.DocumentDB/mongoClusters@2024-02-15-preview' = {
  name: cosmosClusterName
  location: location
  properties: {
    administratorLogin: cosmosAdminUsername
    administratorLoginPassword: cosmosAdminPassword
    serverVersion: '7.0'
    nodeGroupSpecs: [
      {
        kind: 'Shard'
        sku: 'Free'          // Change to 'M10' if free tier already used in this subscription
        diskSizeGB: 32
        enableHa: false
        nodeCount: 1
      }
    ]
  }
}

// Allow all Azure-internal IPs through the vCore firewall
resource cosmosFirewall 'Microsoft.DocumentDB/mongoClusters/firewallRules@2024-02-15-preview' = {
  parent: cosmosCluster
  name: 'AllowAllAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// ============================================================
// 9. App Service Plan (Linux B1)
// ============================================================
resource appServicePlan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: appServicePlanName
  location: appServiceLocation
  kind: 'Linux'
  sku: { name: 'B1', tier: 'Basic', capacity: 1 }
  properties: { reserved: true }
}

// ============================================================
// 10. Web App (Node 22 LTS + System-Assigned Managed Identity)
// ============================================================
resource webApp 'Microsoft.Web/sites@2024-04-01' = {
  name: webAppName
  location: appServiceLocation
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'NODE|22-lts'
      alwaysOn: true
      ftpsState: 'FtpsOnly'
      minTlsVersion: '1.2'
      http20Enabled: true
      // startup.sh starts uvicorn (Python agents) then Node.js
      appCommandLine: 'bash /home/site/wwwroot/startup.sh'
      cors: {
        allowedOrigins: [
          // Frontend is served by the same App Service (Express static)
          // Allow localhost for local development
          'http://localhost:5173'
          'https://localhost:5173'
          'http://localhost:3000'
        ]
        supportCredentials: true
      }
    }
  }
}

// Disable FTP basic publishing credentials
resource webAppFtpPolicy 'Microsoft.Web/sites/basicPublishingCredentialsPolicies@2024-04-01' = {
  parent: webApp
  name: 'ftp'
  properties: { allow: false }
}

// ============================================================
// 11. RBAC: Web App identity → Key Vault Secrets User
// ============================================================
var kvSecretsUserRoleId = '4633458b-17de-408a-b874-0445c86b69e6'
resource kvRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, webApp.id, kvSecretsUserRoleId)
  scope: keyVault
  properties: {
    principalId: webApp.identity.principalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', kvSecretsUserRoleId)
    principalType: 'ServicePrincipal'
  }
}

// ============================================================
// 12. RBAC: Web App identity → Storage Blob Data Contributor
// ============================================================
var blobContributorRoleId = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
resource storageRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, webApp.id, blobContributorRoleId)
  scope: storageAccount
  properties: {
    principalId: webApp.identity.principalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', blobContributorRoleId)
    principalType: 'ServicePrincipal'
  }
}

// ============================================================
// 13. Key Vault Secrets
// ============================================================
resource secretCosmos 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'COSMOS-DB-CONNECTION-STRING'
  properties: { value: cosmosConnStr }
  dependsOn: [kvRoleAssignment]
}

resource secretJwt 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'JWT-SECRET'
  properties: { value: jwtSecret }
  dependsOn: [kvRoleAssignment]
}

resource secretInternalApi 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'INTERNAL-API-SECRET'
  properties: { value: internalApiSecret }
  dependsOn: [kvRoleAssignment]
}

resource secretOpenAiKey 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'AZURE-OPENAI-API-KEY'
  properties: { value: openAi.listKeys().key1 }
  dependsOn: [kvRoleAssignment]
}

resource secretSpeechKey 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'SPEECH-KEY'
  properties: { value: speechService.listKeys().key1 }
  dependsOn: [kvRoleAssignment]
}

resource secretSearchKey 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'AZURE-SEARCH-ADMIN-KEY'
  properties: { value: aiSearch.listAdminKeys().primaryKey }
  dependsOn: [kvRoleAssignment]
}

resource secretStorageConn 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'AZURE-STORAGE-CONNECTION-STRING'
  properties: {
    value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccount.listKeys().keys[0].value};EndpointSuffix=${storageSuffix}'
  }
  dependsOn: [kvRoleAssignment]
}

// CI/CD bootstrap secrets — read by GitHub Actions after OIDC login
// so that no app config needs to be stored in GitHub repository secrets.
resource secretWebAppName 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'WEBAPP-NAME'
  properties: { value: webApp.name }
  dependsOn: [kvRoleAssignment]
}

resource secretResourceGroup 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'RESOURCE-GROUP-NAME'
  properties: { value: resourceGroup().name }
  dependsOn: [kvRoleAssignment]
}

// ============================================================
// 14. Diagnostic Settings → Log Analytics Workspace
//     Collects platform logs + metrics from every major resource
//     so they are queryable in Log Analytics (KQL / Workbooks).
// ============================================================

// ── Web App (App Service) ──────────────────────────────────
resource webAppDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'diag-webapp'
  scope: webApp
  properties: {
    workspaceId: logAnalytics.id
    logs: [
      { category: 'AppServiceHTTPLogs',       enabled: true }
      { category: 'AppServiceConsoleLogs',     enabled: true }
      { category: 'AppServiceAppLogs',         enabled: true }
      { category: 'AppServiceAuditLogs',       enabled: true }
      { category: 'AppServiceIPSecAuditLogs',  enabled: true }
      { category: 'AppServicePlatformLogs',    enabled: true }
    ]
    metrics: [
      { category: 'AllMetrics', enabled: true }
    ]
  }
}

// ── Key Vault ─────────────────────────────────────────────
resource keyVaultDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'diag-kv'
  scope: keyVault
  properties: {
    workspaceId: logAnalytics.id
    logs: [
      { category: 'AuditEvent',                        enabled: true }
      { category: 'AzurePolicyEvaluationDetails',      enabled: true }
    ]
    metrics: [
      { category: 'AllMetrics', enabled: true }
    ]
  }
}

// ── Azure OpenAI (Cognitive Services) ────────────────────
resource openAiDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'diag-aoai'
  scope: openAi
  properties: {
    workspaceId: logAnalytics.id
    logs: [
      { category: 'Audit',           enabled: true }
      { category: 'RequestResponse', enabled: true }
      { category: 'Trace',           enabled: true }
    ]
    metrics: [
      { category: 'AllMetrics', enabled: true }
    ]
  }
}

// ── Speech Service (Cognitive Services) ──────────────────
resource speechDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'diag-speech'
  scope: speechService
  properties: {
    workspaceId: logAnalytics.id
    logs: [
      { category: 'Audit',           enabled: true }
      { category: 'RequestResponse', enabled: true }
    ]
    metrics: [
      { category: 'AllMetrics', enabled: true }
    ]
  }
}

// ── Azure AI Search ───────────────────────────────────────
resource searchDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'diag-search'
  scope: aiSearch
  properties: {
    workspaceId: logAnalytics.id
    logs: [
      { category: 'OperationLogs', enabled: true }
    ]
    metrics: [
      { category: 'AllMetrics', enabled: true }
    ]
  }
}

// ── Storage Account (blob service) ───────────────────────
resource storageBlobDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'diag-storage-blob'
  scope: blobService
  properties: {
    workspaceId: logAnalytics.id
    logs: [
      { category: 'StorageRead',   enabled: true }
      { category: 'StorageWrite',  enabled: true }
      { category: 'StorageDelete', enabled: true }
    ]
    metrics: [
      { category: 'Transaction', enabled: true }
    ]
  }
}

// ── App Service Plan (metrics only) ──────────────────────
resource aspDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'diag-asp'
  scope: appServicePlan
  properties: {
    workspaceId: logAnalytics.id
    metrics: [
      { category: 'AllMetrics', enabled: true }
    ]
  }
}

// ============================================================
// 15. Web App App Settings (secrets via Key Vault references)
// ============================================================
resource webAppSettings 'Microsoft.Web/sites/config@2024-04-01' = {
  parent: webApp
  name: 'appsettings'
  properties: {
    NODE_ENV:                             'production'
    PORT:                                 '3000'
    AZURE_KEY_VAULT_URI:                  keyVault.properties.vaultUri
    COSMOS_DB_NAME:                       'medassist-ai-main-db'
    AZURE_STORAGE_CONTAINER_NAME:         'medassist-ai-files'
    FRONTEND_URL:                         'https://${webApp.properties.defaultHostName}'
    PYTHON_AGENT_URL:                     'http://127.0.0.1:8000'
    NODEJS_BACKEND_URL:                   'http://localhost:3000/api'
    APPLICATIONINSIGHTS_CONNECTION_STRING: appInsights.properties.ConnectionString
    SPEECH_REGION:                        location
    AZURE_OPENAI_ENDPOINT:                openAi.properties.endpoint
    AZURE_OPENAI_API_VERSION:             '2024-06-01'
    AZURE_OPENAI_CHAT_DEPLOYMENT_NAME:    'Conversation-Agent-Speaker-Tagging'
    AZURE_OPENAI_CHAT_DEPLOYMENT:         'Phi-4-mini-instruct'
    AZURE_OPENAI_DEPLOYEMENT:             'Phi-4-mini-instruct'   // intentional typo — compat
    AZURE_OPENAI_DEPLOYMENT:              'publishing_agent_model'
    AZURE_OPENAI_EMBEDDING_DEPLOYMENT:    'text-embedding-3-small'
    ORCHESTRATION_DEPLOYMENT_NAME:        'gpt-5.4-mini'
    DEPLOYMENT_NAME:                      'Conversation-Agent-Speaker-Tagging'
    OPENAI_ENDPOINT:                      openAi.properties.endpoint
    AZURE_SEARCH_ENDPOINT:                'https://${aiSearch.name}.search.windows.net'
    AZURE_SEARCH_INDEX:                   'az-med-cont1-index-final'
    AZURE_SEARCH_INDEX1:                  'az-med-cont1-index2'
    AZURE_BLOB_CONTAINER_NAME:            'az-medassistai-container1'
    AZURE_BLOB_CONTAINER_NAME1:           'az-medassistai-container2'
    AZURE_BLOB_MEDICAL_KB_FILE:           'icd_10_cm_october_2025_guidelines_0.pdf'
    AZURE_BLOB_MEDICAL_KB_FILE1:          'section111_valid_icd10_october2025.csv'
    SPAWN_MAIN_AGENT_ON_REQUEST:          'true'
    START_MAIN_AGENT_ON_BOOT:             'false'
    USE_COSMOS:                           'true'

    // Key Vault references — resolved at runtime via Managed Identity
    JWT_SECRET:                    '@Microsoft.KeyVault(SecretUri=${keyVault.properties.vaultUri}secrets/JWT-SECRET/)'
    INTERNAL_API_SECRET:           '@Microsoft.KeyVault(SecretUri=${keyVault.properties.vaultUri}secrets/INTERNAL-API-SECRET/)'
    COSMOS_DB_CONNECTION_STRING:   '@Microsoft.KeyVault(SecretUri=${keyVault.properties.vaultUri}secrets/COSMOS-DB-CONNECTION-STRING/)'
    AZURE_STORAGE_CONNECTION_STRING: '@Microsoft.KeyVault(SecretUri=${keyVault.properties.vaultUri}secrets/AZURE-STORAGE-CONNECTION-STRING/)'
    AZURE_OPENAI_API_KEY:          '@Microsoft.KeyVault(SecretUri=${keyVault.properties.vaultUri}secrets/AZURE-OPENAI-API-KEY/)'
    OPENAI_KEY:                    '@Microsoft.KeyVault(SecretUri=${keyVault.properties.vaultUri}secrets/AZURE-OPENAI-API-KEY/)'
    SPEECH_KEY:                    '@Microsoft.KeyVault(SecretUri=${keyVault.properties.vaultUri}secrets/SPEECH-KEY/)'
    AZURE_SEARCH_ADMIN_KEY:        '@Microsoft.KeyVault(SecretUri=${keyVault.properties.vaultUri}secrets/AZURE-SEARCH-ADMIN-KEY/)'
  }
  dependsOn: [
    kvRoleAssignment
    secretJwt
    secretInternalApi
    secretCosmos
    secretStorageConn
    secretOpenAiKey
    secretSpeechKey
    secretSearchKey
  ]
}

// ============================================================
// Outputs — consumed by deploy-all.sh for post-deploy steps
// ============================================================
output webAppName                 string = webApp.name
output webAppUrl                  string = 'https://${webApp.properties.defaultHostName}'
output storageAccountName         string = storageAccount.name
// storageStaticWebUrl removed — frontend is now served by the App Service webapp
output keyVaultUri                string = keyVault.properties.vaultUri
output keyVaultName               string = keyVault.name
output openAiEndpoint             string = openAi.properties.endpoint
output openAiName                 string = openAi.name
output searchEndpoint             string = 'https://${aiSearch.name}.search.windows.net'
output searchName                 string = aiSearch.name
output speechName                 string = speechService.name
output cosmosClusterName          string = cosmosCluster.name
output cosmosHost                 string = cosmosHost
output appInsightsConnectionString string = appInsights.properties.ConnectionString
output cosmosAdminUsernameOut     string = cosmosAdminUsername
