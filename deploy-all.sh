#!/usr/bin/env bash
# ============================================================
#  MediAssist-AI — One-Click Azure Deployment
#  Usage: bash deploy-all.sh [--resource-group NAME] [--location REGION]
#
#  Prerequisites:
#    - Azure CLI (az) logged in: az login
#    - Node.js 20+ and npm
#    - Python 3.11+
#    - zip utility
# ============================================================
set -euo pipefail

# ── Text colours ─────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }
step()    { echo -e "\n${BOLD}${CYAN}▶ $*${NC}"; }

# ── Script location ──────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ============================================================
# CONFIGURATION  — change these or pass as CLI args
# ============================================================
RESOURCE_GROUP="mediassist-ai-rg"
LOCATION="eastus"                    # Key Vault, OpenAI, Speech, Cosmos DB
APP_SERVICE_LOCATION="canadacentral" # Web App + App Service Plan
STORAGE_LOCATION="eastus2"           # Storage Account
SEARCH_LOCATION="centralus"          # Azure AI Search
COSMOS_ADMIN_USER="medassistadmin"

# Parse CLI overrides
while [[ $# -gt 0 ]]; do
  case "$1" in
    --resource-group|-g) RESOURCE_GROUP="$2"; shift 2 ;;
    --location|-l)       LOCATION="$2"; shift 2 ;;
    *) warn "Unknown argument: $1"; shift ;;
  esac
done

# ============================================================
# STEP 0 — Prerequisites check
# ============================================================
step "Checking prerequisites"

for cmd in az node npm python3 zip; do
  if ! command -v "$cmd" &>/dev/null; then
    error "'$cmd' is not installed or not in PATH. Please install it and re-run."
    exit 1
  fi
done
success "All prerequisite tools found"

# ── Configure az CLI for non-interactive extension installs ──
az config set extension.use_dynamic_install=yes_without_prompt 2>/dev/null || true
az config set extension.dynamic_install_allow_preview=true 2>/dev/null || true

# ── Verify Azure login and token validity ────────────────────
# az account show can succeed with a stale cache; verify against ARM.
TENANT_ID=""
if az account show &>/dev/null; then
  TENANT_ID=$(az account show --query tenantId -o tsv 2>/dev/null || true)
fi

ARM_CHECK=$(az group list --query "[0].id" -o tsv 2>&1 || true)
if echo "$ARM_CHECK" | grep -qi "AADSTS\|access pass\|invalid_grant\|InteractionRequired\|login"; then
  error "Azure credentials are expired or invalid."
  echo ""
  if [[ -n "$TENANT_ID" ]]; then
    echo -e "  Run:  ${CYAN}az logout && az login --tenant \"${TENANT_ID}\" --scope \"https://management.core.windows.net//.default\"${NC}"
  else
    echo -e "  Run:  ${CYAN}az logout && az login${NC}"
  fi
  echo ""
  exit 1
fi

if ! az account show &>/dev/null; then
  error "Not logged in to Azure."
  echo -e "  Run:  ${CYAN}az login${NC}"
  exit 1
fi

SUBSCRIPTION_ID=$(az account show --query id -o tsv)
SUBSCRIPTION_NAME=$(az account show --query name -o tsv)
success "Logged in — Subscription: ${SUBSCRIPTION_NAME} (${SUBSCRIPTION_ID})"

# ============================================================
# STEP 1 — Generate unique suffix + secrets
# ============================================================
step "Generating unique deployment suffix and secrets"

# 8-char lowercase hex suffix derived from subscription + RG name
SUFFIX=$(echo -n "${SUBSCRIPTION_ID}${RESOURCE_GROUP}" | md5sum 2>/dev/null || \
         echo -n "${SUBSCRIPTION_ID}${RESOURCE_GROUP}" | md5 2>/dev/null || \
         echo "${RANDOM}${RANDOM}")
SUFFIX=$(echo "$SUFFIX" | tr -dc 'a-z0-9' | head -c 8)

# Auto-generate secrets (cryptographically random)
JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(48))")
INTERNAL_API_SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
COSMOS_PASSWORD=$(python3 -c "import secrets,string; \
  a=secrets.token_urlsafe(20); \
  print(a[:4]+'A1!'+a[4:])")  # Ensures upper+digit+symbol requirement

info "Deployment suffix: ${SUFFIX}"
info "Resource group:    ${RESOURCE_GROUP}"
info "Primary location:  ${LOCATION}"

# Derive resource names (mirrors Bicep var block)
WEBAPP_NAME="webapp-mediassist-${SUFFIX}"
STORAGE_NAME="stmedassist${SUFFIX}"
KV_NAME="kv-medai-${SUFFIX}"
OPENAI_NAME="aoai-mediassist-${SUFFIX}"
SEARCH_NAME="srch-mediassist-${SUFFIX}"
SPEECH_NAME="speech-mediassist-${SUFFIX}"
COSMOS_NAME="cosmos-mediassist-${SUFFIX}"

# ============================================================
# STEP 2 — Create Resource Group (delete first if it already exists)
# ============================================================
step "Checking resource group: ${RESOURCE_GROUP}"

RG_EXISTS=$(az group exists --name "$RESOURCE_GROUP")
if [[ "$RG_EXISTS" == "true" ]]; then
  warn "Resource group '${RESOURCE_GROUP}' already exists."
  echo ""
  echo -e "  All resources inside it will be ${RED}permanently deleted${NC} before re-deploying."
  echo -n "  Type the resource group name to confirm deletion, or Ctrl+C to abort: "
  read -r CONFIRM
  if [[ "$CONFIRM" != "$RESOURCE_GROUP" ]]; then
    error "Confirmation did not match. Aborting."
    exit 1
  fi
  info "Deleting resource group '${RESOURCE_GROUP}'..."
  az group delete --name "$RESOURCE_GROUP" --yes --output none
  success "Resource group deleted"
fi

info "Creating resource group '${RESOURCE_GROUP}' in '${LOCATION}'..."
az group create \
  --name "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --output none
success "Resource group ready"

# ── Purge any soft-deleted Cognitive Services accounts ───────
# Soft-deleted resources block redeployment with the same name.
step "Purging any soft-deleted Cognitive Services accounts"
DELETED_CS=$(az cognitiveservices account list-deleted \
  --query "[].{name:name, location:location}" -o json 2>/dev/null || echo "[]")
echo "$DELETED_CS" | python3 -c "
import sys, json, subprocess
items = json.load(sys.stdin)
for item in items:
  name = item.get('name','')
  loc  = item.get('location','')
  if '$SUFFIX' in name or 'mediassist' in name.lower():
    print(f'Purging soft-deleted Cognitive Services: {name}')
    subprocess.run(['az','cognitiveservices','account','purge',
      '--name', name, '--resource-group', '$RESOURCE_GROUP', '--location', loc],
      check=False)
" 2>/dev/null || true

# ── Purge any soft-deleted Key Vaults ────────────────────────
DELETED_KV=$(az keyvault list-deleted \
  --resource-type vault \
  --query "[].{name:name, location:properties.location}" -o json 2>/dev/null || echo "[]")
echo "$DELETED_KV" | python3 -c "
import sys, json, subprocess
items = json.load(sys.stdin)
for item in items:
  name = item.get('name','')
  loc  = item.get('location','')
  if '$SUFFIX' in name or 'medai' in name.lower():
    print(f'Purging soft-deleted Key Vault: {name}')
    subprocess.run(['az','keyvault','purge','--name', name, '--location', loc],
      check=False)
" 2>/dev/null || true

# ============================================================
# STEP 3 — Deploy Bicep template (core infrastructure)
#   Provisions: App Service, Storage, Key Vault, OpenAI,
#               AI Search, Speech, Cosmos DB vCore,
#               App Insights, Log Analytics, RBAC, KV secrets
# ============================================================
step "Deploying Bicep template (this takes ~10-15 minutes)"
info "Deploying: App Service, Storage, Key Vault, OpenAI, AI Search, Speech, Cosmos DB..."

# Unique deployment name prevents DeploymentActive conflicts on re-runs
DEPLOY_NAME="mediassist-$(date -u +%Y%m%dT%H%M%S)"

# Cancel any still-active deployment to avoid conflicts
ACTIVE=$(az deployment group list \
  --resource-group "$RESOURCE_GROUP" \
  --query "[?properties.provisioningState=='Running'].name" \
  -o tsv 2>/dev/null || true)
if [[ -n "$ACTIVE" ]]; then
  warn "Cancelling active deployment(s): ${ACTIVE}"
  for D in $ACTIVE; do
    az deployment group cancel --resource-group "$RESOURCE_GROUP" --name "$D" --output none 2>/dev/null || true
  done
  sleep 10
fi

# Wait for any lingering resource operations (e.g. Cosmos DB still deleting)
info "Waiting 30s for any in-progress resource operations to settle..."
sleep 30

BICEP_OUTPUT=$(az deployment group create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$DEPLOY_NAME" \
  --template-file "$SCRIPT_DIR/Infra/main.bicep" \
  --parameters \
      suffix="$SUFFIX" \
      location="$LOCATION" \
      appServiceLocation="$APP_SERVICE_LOCATION" \
      storageLocation="$STORAGE_LOCATION" \
      searchLocation="$SEARCH_LOCATION" \
      cosmosAdminUsername="$COSMOS_ADMIN_USER" \
      cosmosAdminPassword="$COSMOS_PASSWORD" \
      jwtSecret="$JWT_SECRET" \
      internalApiSecret="$INTERNAL_API_SECRET" \
  --query properties.outputs \
  --output json)

success "Bicep deployment complete"

# ── Parse outputs ────────────────────────────────────────────
get_output() { echo "$BICEP_OUTPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['$1']['value'])"; }

WEBAPP_URL=$(get_output webAppUrl)
KV_URI=$(get_output keyVaultUri)
OPENAI_ENDPOINT=$(get_output openAiEndpoint)
SEARCH_ENDPOINT=$(get_output searchEndpoint)
COSMOS_HOST=$(get_output cosmosHost)
APPI_CONN_STR=$(get_output appInsightsConnectionString)

info "Web App URL:      ${WEBAPP_URL}  (serves API + React frontend)"
info "Key Vault URI:    ${KV_URI}"
info "OpenAI endpoint:  ${OPENAI_ENDPOINT}"
info "Search endpoint:  ${SEARCH_ENDPOINT}"

# ── Retrieve service keys from ARM ───────────────────────────
step "Retrieving service keys"

OPENAI_KEY=$(az cognitiveservices account keys list \
  --name "$OPENAI_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query key1 -o tsv)

SPEECH_KEY=$(az cognitiveservices account keys list \
  --name "$SPEECH_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query key1 -o tsv)

SEARCH_ADMIN_KEY=$(az search admin-key show \
  --service-name "$SEARCH_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query primaryKey -o tsv)

STORAGE_CONN_STR=$(az storage account show-connection-string \
  --name "$STORAGE_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query connectionString -o tsv)

success "All service keys retrieved"

# ============================================================
# STEP 3b — Create Azure OpenAI model deployments
#   (done here not in Bicep so we can query available versions)
# ============================================================
step "Creating Azure OpenAI model deployments"

# Helper: pick the latest non-deprecated version for a given model
pick_model_version() {
  local MODEL_NAME="$1"
  az cognitiveservices account list-models \
    --name "$OPENAI_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query "[?model.name=='${MODEL_NAME}'] | sort_by(@, &model.version) | [-1].model.version" \
    -o tsv 2>/dev/null || echo ""
}

create_deployment() {
  local DEPLOY_NAME="$1"
  local MODEL_NAME="$2"
  local CAPACITY="$3"
  local MODEL_VER
  MODEL_VER=$(pick_model_version "$MODEL_NAME")
  if [[ -z "$MODEL_VER" ]]; then
    warn "Could not determine version for '${MODEL_NAME}' — skipping deployment '${DEPLOY_NAME}'"
    return
  fi
  info "Creating deployment '${DEPLOY_NAME}' → model '${MODEL_NAME}' v${MODEL_VER}"
  az cognitiveservices account deployment create \
    --name "$OPENAI_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --deployment-name "$DEPLOY_NAME" \
    --model-name "$MODEL_NAME" \
    --model-version "$MODEL_VER" \
    --model-format OpenAI \
    --sku-name Standard \
    --sku-capacity "$CAPACITY" \
    --output none 2>&1 | grep -v "^$" | while read -r LINE; do warn "$LINE"; done || \
    warn "Deployment '${DEPLOY_NAME}' may already exist — continuing"
  success "Deployment '${DEPLOY_NAME}' ready"
}

# Chat model: use gpt-4o-mini or fall back to gpt-4o
CHAT_MODEL="gpt-4o-mini"
if [[ -z "$(pick_model_version gpt-4o-mini)" ]]; then
  CHAT_MODEL="gpt-4o"
  warn "gpt-4o-mini not available in this region — falling back to gpt-4o"
fi

# Create deployments sequentially (ARM limit: one at a time per account)
create_deployment "Conversation-Agent-Speaker-Tagging" "$CHAT_MODEL" 10
create_deployment "publishing_agent_model"              "$CHAT_MODEL" 10
create_deployment "gpt-5.4-mini"                       "$CHAT_MODEL" 20
create_deployment "Phi-4-mini-instruct"                "$CHAT_MODEL" 10
create_deployment "text-embedding-3-small"             "text-embedding-3-small" 10

success "All OpenAI model deployments created"

# ============================================================
# STEP 4 — Create AI Search Indexes
# ============================================================
step "Creating Azure AI Search indexes"

PRIMARY_INDEX_JSON=$(cat <<EOF
{
  "name": "az-med-cont1-index-final",
  "fields": [
    { "name": "id",          "type": "Edm.String", "key": true, "filterable": true },
    { "name": "content",     "type": "Edm.String", "searchable": true, "retrievable": true, "analyzer": "en.microsoft" },
    { "name": "title",       "type": "Edm.String", "searchable": true, "filterable": true, "retrievable": true },
    { "name": "source",      "type": "Edm.String", "filterable": true, "retrievable": true },
    { "name": "category",    "type": "Edm.String", "filterable": true, "facetable": true, "retrievable": true },
    { "name": "page_number", "type": "Edm.Int32",  "filterable": true, "sortable": true, "retrievable": true },
    { "name": "contentVector", "type": "Collection(Edm.Single)", "searchable": true, "retrievable": false,
      "dimensions": 1536, "vectorSearchProfile": "medassist-vector-profile" }
  ],
  "vectorSearch": {
    "profiles": [{ "name": "medassist-vector-profile", "algorithm": "medassist-hnsw" }],
    "algorithms": [{ "name": "medassist-hnsw", "kind": "hnsw",
      "hnswParameters": { "m": 4, "efConstruction": 400, "efSearch": 500, "metric": "cosine" } }]
  },
  "semantic": { "configurations": [{ "name": "medassist-semantic",
    "prioritizedFields": { "contentFields": [{ "fieldName": "content" }],
      "keywordsFields": [{ "fieldName": "title" }, { "fieldName": "category" }] } }] }
}
EOF
)
SECONDARY_INDEX_JSON=$(cat <<EOF
{
  "name": "az-med-cont1-index2",
  "fields": [
    { "name": "id",            "type": "Edm.String", "key": true, "filterable": true },
    { "name": "content",       "type": "Edm.String", "searchable": true, "retrievable": true, "analyzer": "en.microsoft" },
    { "name": "title",         "type": "Edm.String", "searchable": true, "filterable": true, "retrievable": true },
    { "name": "source",        "type": "Edm.String", "filterable": true, "retrievable": true },
    { "name": "chunk_id",      "type": "Edm.Int32",  "filterable": true, "sortable": true, "retrievable": true },
    { "name": "contentVector", "type": "Collection(Edm.Single)", "searchable": true, "retrievable": false,
      "dimensions": 1536, "vectorSearchProfile": "medassist-vector-profile" }
  ],
  "vectorSearch": {
    "profiles": [{ "name": "medassist-vector-profile", "algorithm": "medassist-hnsw" }],
    "algorithms": [{ "name": "medassist-hnsw", "kind": "hnsw",
      "hnswParameters": { "m": 4, "efConstruction": 400, "efSearch": 500, "metric": "cosine" } }]
  }
}
EOF
)

for INDEX_JSON in "$PRIMARY_INDEX_JSON" "$SECONDARY_INDEX_JSON"; do
  INDEX_NAME=$(echo "$INDEX_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['name'])")
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X PUT "${SEARCH_ENDPOINT}/indexes/${INDEX_NAME}?api-version=2024-05-01-preview" \
    -H "Content-Type: application/json" -H "api-key: ${SEARCH_ADMIN_KEY}" \
    -d "$INDEX_JSON")
  [[ "$HTTP_CODE" =~ ^2 ]] \
    && success "Search index '${INDEX_NAME}' ready (HTTP ${HTTP_CODE})" \
    || warn "Search index '${INDEX_NAME}' HTTP ${HTTP_CODE} — may already exist"
done

# ============================================================
# STEP 5 — Initial code deployment (all 3 servers)
#   Packages: Node.js backend + React frontend + Python agents
#   GitHub Actions handles all subsequent deployments.
# ============================================================
step "Building and packaging all 3 servers for initial deployment"

DEPLOY_PKG_DIR="$SCRIPT_DIR/.deploy_pkg"
rm -rf "$DEPLOY_PKG_DIR"
mkdir -p "$DEPLOY_PKG_DIR/backend" "$DEPLOY_PKG_DIR/python-agents"

# ── Node.js backend ─────────────────────────────────────────
cp -r "$SCRIPT_DIR/deploy/." "$DEPLOY_PKG_DIR/backend/"
cd "$DEPLOY_PKG_DIR/backend" && npm install --omit=dev --silent && cd "$SCRIPT_DIR"
success "Node.js backend installed"

# ── React frontend → backend/public (served by Express) ─────
info "Building React frontend..."
cat > "$SCRIPT_DIR/Frontend/medassist-V3/.env.production" <<EOF
VITE_API_URL=${WEBAPP_URL}/api
VITE_SOCKET_URL=${WEBAPP_URL}
EOF
cd "$SCRIPT_DIR/Frontend/medassist-V3"
npm install --silent && npm run build
cp -r dist/. "$DEPLOY_PKG_DIR/backend/public/"
cd "$SCRIPT_DIR"
success "React frontend built into backend/public"

# ── Python agents ────────────────────────────────────────────
cp -r "$SCRIPT_DIR/Backend/orchestrator_agent/." "$DEPLOY_PKG_DIR/python-agents/"
mkdir -p "$DEPLOY_PKG_DIR/python-agents/summarizer_agent"
cp "$SCRIPT_DIR/Backend/summarizer_agent/rag_pipeline.py" "$DEPLOY_PKG_DIR/python-agents/summarizer_agent/"
cp "$SCRIPT_DIR/Backend/summarizer_agent/retrieval.py"    "$DEPLOY_PKG_DIR/python-agents/summarizer_agent/"
touch "$DEPLOY_PKG_DIR/python-agents/summarizer_agent/__init__.py"
mkdir -p "$DEPLOY_PKG_DIR/python-agents/Publishing_Agent"
for d in agent tools storage config prompts; do
  [ -d "$SCRIPT_DIR/Backend/Publishing_Agent/$d" ] && \
    cp -r "$SCRIPT_DIR/Backend/Publishing_Agent/$d" "$DEPLOY_PKG_DIR/python-agents/Publishing_Agent/$d" || true
done
touch "$DEPLOY_PKG_DIR/python-agents/Publishing_Agent/__init__.py"

# Combined Python requirements
cat \
  "$SCRIPT_DIR/Backend/orchestrator_agent/requirements.txt" \
  "$SCRIPT_DIR/Backend/summarizer_agent/requirements.txt" \
  "$SCRIPT_DIR/Backend/Publishing_Agent/requirements.txt" \
  "$SCRIPT_DIR/Backend/conversational_agent/requirements.txt" \
  | sort -u > "$DEPLOY_PKG_DIR/python-agents/requirements_combined.txt"
success "Python agents assembled"

# ── startup.sh — use the repo's startup.sh (single source of truth) ────────
cp "$SCRIPT_DIR/startup.sh" "$DEPLOY_PKG_DIR/startup.sh"
chmod +x "$DEPLOY_PKG_DIR/startup.sh"

# ── Zip and deploy ───────────────────────────────────────────
DEPLOY_ZIP="$SCRIPT_DIR/.deploy_pkg.zip"
(cd "$DEPLOY_PKG_DIR" && zip -r "$DEPLOY_ZIP" . \
  -x "*.git*" -x "*/__pycache__/*" -x "*.pyc" -x "*/node_modules/.cache/*")
success "Deployment package created"

step "Deploying to App Service: ${WEBAPP_NAME} (initial deployment)"
az webapp config set \
  --name "$WEBAPP_NAME" --resource-group "$RESOURCE_GROUP" \
  --startup-file "bash /home/site/wwwroot/startup.sh" --output none
az webapp deploy \
  --name "$WEBAPP_NAME" --resource-group "$RESOURCE_GROUP" \
  --src-path "$DEPLOY_ZIP" --type zip --output none
rm -rf "$DEPLOY_PKG_DIR" "$DEPLOY_ZIP"
success "Initial deployment complete"

# ============================================================
# STEP 6 — Write local .env files for development
# ============================================================
# NOTE: Secrets (API keys, connection strings) are stored ONLY in Key Vault.
#       These .env files contain only the KV bootstrap credentials and
#       non-secret config values.  Fill in AZURE_KEY_VAULT_URI and the
#       service-principal fields before running agents locally.
# ============================================================
step "Writing local .env files (Key Vault bootstrap only — no secrets)"

# Non-secret config common to all Python agents
PYTHON_ENV_COMMON="# Key Vault bootstrap -- fill in values for local dev
AZURE_KEY_VAULT_URI=${KV_URI}
# Local service principal credentials (not used on App Service):
AZURE_TENANT_ID=$(az account show --query tenantId -o tsv 2>/dev/null)
AZURE_CLIENT_ID=REPLACE_your-service-principal-client-id
AZURE_CLIENT_SECRET=REPLACE_your-service-principal-secret

# Non-secret config
AZURE_OPENAI_ENDPOINT=${OPENAI_ENDPOINT}
AZURE_OPENAI_API_VERSION=2024-06-01
AZURE_OPENAI_CHAT_DEPLOYMENT_NAME=Conversation-Agent-Speaker-Tagging
AZURE_OPENAI_CHAT_DEPLOYMENT=Phi-4-mini-instruct
AZURE_OPENAI_DEPLOYEMENT=Phi-4-mini-instruct
AZURE_OPENAI_DEPLOYMENT=publishing_agent_model
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-3-small
ORCHESTRATION_DEPLOYMENT_NAME=gpt-5.4-mini
DEPLOYMENT_NAME=Conversation-Agent-Speaker-Tagging
OPENAI_ENDPOINT=${OPENAI_ENDPOINT}
SPEECH_REGION=${LOCATION}
AZURE_SEARCH_ENDPOINT=${SEARCH_ENDPOINT}
AZURE_SEARCH_INDEX=az-med-cont1-index-final
AZURE_SEARCH_INDEX1=az-med-cont1-index2
AZURE_BLOB_CONTAINER_NAME=az-medassistai-container1
AZURE_BLOB_CONTAINER_NAME1=az-medassistai-container2
AZURE_BLOB_MEDICAL_KB_FILE=icd_10_cm_october_2025_guidelines_0.pdf
AZURE_BLOB_MEDICAL_KB_FILE1=section111_valid_icd10_october2025.csv
AZURE_BLOB_PDF_FILE=icd_10_cm_october_2025_guidelines_0.pdf
AZURE_BLOB_CSV_FILE=section111_valid_icd10_october2025.csv
MONGO_DB_NAME=medassist-ai-main-db
COSMOS_AUDIT_DB=medassist-ai-main-db
COSMOS_AUDIT_COLLECTION=pipeline_logs
MONGO_INPUT_COLLECTION=sample_inputs
MONGO_OUTPUT_COLLECTION=rag_outputs
COSMOS_DB=medassist_ai-main-db
NODEJS_BACKEND_URL=http://localhost:3000/api
USE_COSMOS=true
SPAWN_MAIN_AGENT_ON_REQUEST=true
START_MAIN_AGENT_ON_BOOT=false
MCP_COMMAND=python
MCP_ARGS=mcp_server/mcp_tools_server.py"

for AGENT_DIR in \
  "$SCRIPT_DIR/Backend/orchestrator_agent" \
  "$SCRIPT_DIR/Backend/summarizer_agent" \
  "$SCRIPT_DIR/Backend/Publishing_Agent" \
  "$SCRIPT_DIR/Backend/conversational_agent"; do
  echo "$PYTHON_ENV_COMMON" > "$AGENT_DIR/.env"
done

cat > "$SCRIPT_DIR/deploy/.env" <<EOF
PORT=3000
NODE_ENV=development
JWT_EXPIRES_IN=7d
AZURE_KEY_VAULT_URI=${KV_URI}
AZURE_TENANT_ID=$(az account show --query tenantId -o tsv 2>/dev/null)
AZURE_CLIENT_ID=REPLACE_your-service-principal-client-id
AZURE_CLIENT_SECRET=REPLACE_your-service-principal-secret
COSMOS_DB_NAME=medassist-ai-main-db
COSMOS_DNS_SERVERS=8.8.8.8,1.1.1.1
AZURE_STORAGE_CONTAINER_NAME=medassist-ai-files
FRONTEND_URL=http://localhost:5173
PYTHON_AGENT_URL=http://127.0.0.1:8000
NODEJS_BACKEND_URL=http://localhost:3000/api
EOF
success "Local .env files written — fill in AZURE_CLIENT_ID and AZURE_CLIENT_SECRET for local dev"
info "See Infra/deployment-requirements.txt → Step 2.3 for service principal creation."

# ============================================================
# STEP 7 — Configure GitHub Actions secrets
#
# Only 4 bootstrap identifiers need to be stored as GitHub secrets.
# Everything else (webapp name, resource group, VITE URLs) is stored
# in Key Vault and fetched by GitHub Actions at runtime after OIDC login.
# ============================================================
step "Configuring GitHub Actions secrets"

# Resolve the App Registration client ID for OIDC.
# The workflow uses OIDC, so we need an App Registration with a federated
# credential — NOT the Managed Identity principal ID directly.
# If the user has already created one, they can update this secret.
# For now we store the Managed Identity principal as a placeholder.
WEBAPP_PRINCIPAL=$(az webapp identity show \
  --name "$WEBAPP_NAME" --resource-group "$RESOURCE_GROUP" \
  --query principalId -o tsv 2>/dev/null || echo 'SET_MANUALLY')

GH_SECRETS=(
  "AZURE_CLIENT_ID=${WEBAPP_PRINCIPAL}"
  "AZURE_TENANT_ID=$(az account show --query tenantId -o tsv)"
  "AZURE_SUBSCRIPTION_ID=${SUBSCRIPTION_ID}"
  "AZURE_KEY_VAULT_NAME=${KV_NAME}"
)

if command -v gh &>/dev/null && gh auth status &>/dev/null 2>&1; then
  info "GitHub CLI detected — setting repository secrets automatically"
  GH_REPO=$(git -C "$SCRIPT_DIR" remote get-url origin 2>/dev/null | \
    sed 's|.*github.com[:/]||;s|\.git$||' || echo "")
  if [[ -n "$GH_REPO" ]]; then
    for SECRET_PAIR in "${GH_SECRETS[@]}"; do
      SECRET_NAME="${SECRET_PAIR%%=*}"
      SECRET_VALUE="${SECRET_PAIR#*=}"
      gh secret set "$SECRET_NAME" --body "$SECRET_VALUE" --repo "$GH_REPO" 2>/dev/null && \
        success "Secret set: ${SECRET_NAME}" || warn "Could not set: ${SECRET_NAME}"
    done
    info "All other config (webapp name, resource group, URLs) is in Key Vault: ${KV_NAME}"
    info "See Infra/deployment-requirements.txt → Step 2 for OIDC federated credential setup."
  else
    warn "Could not determine GitHub repo from git remote — set secrets manually"
  fi
else
  warn "GitHub CLI ('gh') not found or not authenticated."
  info "Install: https://cli.github.com  then run: gh auth login"
fi

info "GitHub Actions secrets to set (repo → Settings → Secrets → Actions):"
for SECRET_PAIR in "${GH_SECRETS[@]}"; do
  echo "    ${SECRET_PAIR}"
done
info "All other config is stored in Key Vault '${KV_NAME}' — no additional GitHub secrets needed."

# ============================================================
# STEP 8 — Restart Web App
# ============================================================
step "Restarting Web App"
az webapp restart --name "$WEBAPP_NAME" --resource-group "$RESOURCE_GROUP" --output none
success "Web App restarted"

# ============================================================
# STEP 9 — Save deployment summary
# ============================================================
SUMMARY_FILE="$SCRIPT_DIR/.deployment-summary.txt"
cat > "$SUMMARY_FILE" <<EOF
============================================================
  MediAssist-AI Deployment Summary
  $(date)
============================================================

RESOURCE GROUP:  ${RESOURCE_GROUP}
SUBSCRIPTION:    ${SUBSCRIPTION_NAME} (${SUBSCRIPTION_ID})
SUFFIX:          ${SUFFIX}

── Endpoints ─────────────────────────────────────────────────
Web App (API + Frontend): ${WEBAPP_URL}
Azure OpenAI:             ${OPENAI_ENDPOINT}
Azure AI Search:          ${SEARCH_ENDPOINT}
Key Vault:                ${KV_URI}

── Resource Names ────────────────────────────────────────────
Web App:               ${WEBAPP_NAME}
Storage Account:       ${STORAGE_NAME}
Key Vault:             ${KV_NAME}
OpenAI Account:        ${OPENAI_NAME}
AI Search:             ${SEARCH_NAME}
Speech Service:        ${SPEECH_NAME}
Cosmos DB Cluster:     ${COSMOS_NAME}

── GitHub Actions Secrets (4 bootstrap identifiers only) ────
$(for S in "${GH_SECRETS[@]}"; do echo "  $S"; done)

── All Other Config in Key Vault: ${KV_NAME} ────────────────
  WEBAPP-NAME          = ${WEBAPP_NAME}
  RESOURCE-GROUP-NAME  = ${RESOURCE_GROUP}
  (+ all connection strings, API keys fetched at runtime)

── Architecture ──────────────────────────────────────────────
All 3 servers run inside a single App Service:
  Port 3000 — Node.js Express (API + serves React frontend)
  Port 8000 — Python uvicorn  (AI agent bridge, internal only)
  React SPA  — built into backend/public, served by Express

── Blob Storage Containers ───────────────────────────────────
medassist-ai-files        (medical record file attachments)
az-medassistai-container1 (ICD-10 PDF knowledge base)
az-medassistai-container2 (ICD-10 CSV index)

── Next Steps ────────────────────────────────────────────────
See: Infra/deployment-requirements.txt
EOF
success "Summary saved: ${SUMMARY_FILE}"

# ============================================================
# Done!
# ============================================================
echo ""
echo -e "${BOLD}${GREEN}════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}${GREEN}  MediAssist-AI deployment complete!${NC}"
echo -e "${BOLD}${GREEN}════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${CYAN}Frontend + API:${NC}  ${WEBAPP_URL}"
echo -e "  ${CYAN}Summary:${NC}         ${SUMMARY_FILE}"
echo ""
echo -e "  ${YELLOW}Next steps:${NC} see Infra/deployment-requirements.txt"
echo ""
