# MediAssist-AI
## Voice-first · Privacy-native · Clinician-approved​
## Overview
- Passively captures the complete patient-clinician conversation in realtime using AI to generate diarized transcripts, structured clinical documentation and actionable outputs.​
- A privacy-first convert & purge design ensures PHI is securely handled - no audio retention. All outputs are available only for clinician review and approval.​
- An AI-powered healthcare management platform combining a React frontend, Node.js REST API, and a suite of Python-based AI agents — deployed on Azure.
## Business Challenges
- Physicians spend significant time on documentation, reducing time available for patient care​
- Clinical conversations contain valuable context that is often lost or inconsistently recorded​
- Manual note-taking introduces variability, omissions, and clinician burnout​
- Strict regulatory constraints limit audio retention and data reuse
## Use Case Description
- Passively listens to the full patient–doctor interaction during the clinical encounter​
- Converts spoken conversation into structured clinical documentation and action plans​
- Filters non-clinical dialogue while preserving medically relevant context and intent​
- Presents a summarized report for physician review, edit, and formal approval​

**Core capabilities:**
- Multi-role authentication and role-based access control
- Appointment booking and scheduling
- Medical record upload and retrieval (Azure Blob Storage)
- Vitals monitoring with trend visualization
- AI agents for summarization, Q&A, and clinical record publishing
- Real-time messaging via WebSocket (Socket.io)

---

## Architecture
### Technical Solution 
![MedAssist Technical Solution Diagram](https://github.com/mkcod/MedAssist-AI/blob/main/Docs/Arch-Diag.png)

- Real-time, streaming medical speech recognition with speaker separation​
- AI/ML and GenAI pipelines for clinical entity extraction and summarization​
- Ephemeral processing with strict convert-and-delete enforcement​
- Secure integration with EHR and downstream systems post-approval​

### Functional Solution 
![MedAssist Functional Solution Diagram](https://github.com/mkcod/MedAssist-AI/blob/main/Docs/Func-Soln.png)

- Passive speech-to-text captures conversation without disrupting the visit​
- AI extracts symptoms, context, and next steps from natural dialogue​
- Auto-generates structured documentation and action items​
- Physician reviews, edits, and approves before downstream consumption

### Business Impact
- Frees clinician capacity to focus on patient care rather than administrative tasks​
- Lowers operational inefficiencies from rework and incomplete notes​
- Supports compliance through standardized, review-based documentation​​

### Technical Implementation
```
┌──────────────────────────────────────────────┐
│         Frontend  (React + Vite SPA)         │
│         http://localhost:5173                │
└───────────────────┬──────────────────────────┘
                    │  HTTP / WebSocket
┌───────────────────▼──────────────────────────┐
│    Node.js / Express API  (:3000)            │
│    Auth · Users · Appointments · Records     │
│    Medications · Vitals · Chat · Socket.io   │
└──────┬──────────────────────────┬────────────┘
       │  Azure SDK               │  HTTP (internal)
┌──────▼──────────┐   ┌──────────▼───────────────────┐
│  Azure Cosmos DB│   │  Python AI Agents  (:8000)   │
│  (MongoDB API)  │   │  Orchestrator · Summarizer   │
└─────────────────┘   │  Conversational · Publisher  │
┌─────────────────┐   └──────────────────────────────┘
│  Azure Blob     │
│  Storage        │
└─────────────────┘
┌─────────────────┐
│  Azure Key Vault│
└─────────────────┘
```

**AI Agent responsibilities:**

| Agent | Role | Port |
|-------|------|------|
| Orchestrator Agent | Routes requests, coordinates agents | 8000 |
| Summarizer Agent | Summarizes medical documents via RAG (Azure AI Search) | — |
| Conversational Agent | Natural language Q&A on medical topics | — |
| Publishing Agent | Processes and publishes clinical records (SOAP notes) | — |

> The Summarizer Agent uses **Azure AI Search** as its sole knowledge base. Do not run local KB/embedding generation scripts. To ingest a PDF blob run `python Backend/summarizer_agent/scripts/ingest_blob_to_search.py`; for XLSX, run `ingest_xlsx_to_search.py`.

---

## Technology Stack

### Frontend

| Component | Technology | Version |
|-----------|-----------|---------|
| Framework | React | 18.3.1 |
| Build Tool | Vite | 5.4.3 |
| Routing | React Router DOM | 6.26.1 |
| Styling | Tailwind CSS | 3.4.12 |
| Charts | Recharts | 2.12.7 |
| Real-time | Socket.io-client | 4.7.5 |

### Backend (Node.js)

| Component | Technology | Version |
|-----------|-----------|---------|
| Runtime | Node.js | ≥18.0.0 |
| Framework | Express.js | 4.21.0 |
| ODM | Mongoose | 9.5.0 |
| Auth | JWT (jsonwebtoken) | 9.0.2 |
| File Upload | Multer | 1.4.5-lts.1 |
| Security | Helmet + express-rate-limit | — |
| Real-time | Socket.io | 4.7.5 |

### AI Agents (Python)

| Component | Purpose |
|-----------|---------|
| Azure OpenAI / Claude | LLM backend |
| MCP (Model Context Protocol) | Agent tool orchestration |
| Azure AI Search | RAG knowledge base |
| FastAPI / Uvicorn | Orchestrator HTTP API |
| PyMongo / Azure Cosmos SDK | Data persistence |

### Cloud (Azure)

| Service | SKU | Purpose |
|---------|-----|---------|
| Azure Cosmos DB for MongoDB vCore | Free / M10 | Primary database (all collections) |
| Azure Blob Storage | Standard_LRS StorageV2 | Medical files + ICD-10 KB + frontend static site |
| Azure Key Vault | Standard | Secrets management (RBAC) |
| Azure App Service (Linux B1) | B1 | Node.js + Python agents (single container) |
| Azure OpenAI | S0 | LLM + embeddings (5 model deployments) |
| Azure AI Search | Basic | Vector + keyword RAG index for summarizer |
| Azure Cognitive Services Speech | S0 | Speech-to-text, conversation transcription |
| Application Insights + Log Analytics | PerGB2018 | Observability |

---

## Features

- **Authentication** — JWT-based, multi-role (Patient, Doctor, Receptionist, Attendee), RBAC
- **Appointments** — Book, reschedule, cancel; real-time status tracking
- **Medical Records** — Secure upload/download via Azure Blob with SAS URLs
- **Medications** — Prescription tracking, dosage schedules, adherence logging
- **Vitals** — Record and visualize BP, heart rate, temperature, weight; abnormal-reading alerts
- **AI Chat** — Conversational agent for medical queries with session history
- **SOAP Publishing** — Automated clinical note generation and record publishing
- **Real-time** — Live notifications and messaging via Socket.io
- **Dashboards** — Role-specific views with health summaries and analytics

---

## Project Structure

```
MediAssist-AI-WNSVuram-HA/
├── Frontend/
│   └── medassist-V3/              # React SPA (Vite)
│       ├── src/
│       │   ├── components/
│       │   ├── pages/
│       │   ├── contexts/
│       │   └── services/
│       ├── vite.config.js
│       └── tailwind.config.js
│
├── Backend/
│   ├── Medassist-Backend/         # Node.js / Express API
│   │   └── src/
│   │       ├── models/            # Mongoose schemas
│   │       ├── routes/            # REST endpoints
│   │       ├── middleware/        # Auth, validation
│   │       ├── services/
│   │       ├── socket/
│   │       └── app.js
│   │
│   ├── orchestrator_agent/        # FastAPI orchestrator (:8000)
│   │   ├── api_server.py
│   │   ├── agent_orchestrator.py
│   │   └── tools/
│   │
│   ├── summarizer_agent/          # RAG summarization agent
│   │   ├── agent.py
│   │   ├── retrieval.py           # Azure AI Search queries
│   │   ├── rag_pipeline.py
│   │   └── scripts/               # Ingestion scripts
│   │
│   ├── conversational_agent/      # NL Q&A agent
│   ├── Publishing_Agent/          # SOAP note publisher
│   └── Demo/                      # Demo / test scripts
│
├── Infra/
│   └── main.bicep                 # Azure IaC
├── deploy/                        # Deployment helpers
├── Docs/
├── Changelog/
└── .venv/                         # Shared Python venv
```

---

## Prerequisites

### Local Development

| Requirement | Version |
|-------------|--------|
| Node.js | ≥ 20.0.0 |
| npm | ≥ 9.0.0 |
| Python | ≥ 3.11 |
| Git | Latest |

### Azure Deployment (one-click)

| Requirement | Notes |
|-------------|-------|
| Azure CLI (`az`) | `brew install azure-cli` · then `az login` |
| Node.js ≥ 20 | For frontend build step |
| Python ≥ 3.11 | For secret generation |
| `zip` | Pre-installed on macOS/Linux |

All Azure resources are provisioned automatically by `deploy-all.sh` — no manual portal steps required.

---

## Local Development Setup

### 1. Python Virtual Environment

```bash
# From project root
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
```

### 2. AI Agents (Python)

Install dependencies for each agent, then configure its `.env`:

```bash
for agent in orchestrator_agent summarizer_agent conversational_agent Publishing_Agent; do
  pip install -r Backend/$agent/requirements.txt
  cp Backend/$agent/.env.example Backend/$agent/.env
done
```

Start the Orchestrator API:

```bash
cd Backend/orchestrator_agent
python -m uvicorn api_server:app --host 127.0.0.1 --port 8000
```

### 3. Backend (Node.js)

```bash
cd Backend/Medassist-Backend
cp .env.example .env         # fill in credentials
npm install
npm run dev                  # http://localhost:3000
```

Seed demo data (optional):

```bash
npm run seed
```

### 4. Frontend (React)

```bash
cd Frontend/medassist-V3
cp .env.example .env         # set VITE_API_URL
npm install
npm run dev                  # http://localhost:5173
```

---

## Running All Services

Open four terminal tabs in order:

```bash
# Terminal 1 — Orchestrator API
source .venv/bin/activate
cd Backend/orchestrator_agent
python -m uvicorn api_server:app --host 127.0.0.1 --port 8000

# Terminal 2 — Node.js Backend
cd Backend/Medassist-Backend && npm run dev

# Terminal 3 — React Frontend
cd Frontend/medassist-V3 && npm run dev

# Terminal 4 — (optional) Additional agent
source .venv/bin/activate
cd Backend/summarizer_agent && python agent.py
```

**Service ports:**

| Service | URL |
|---------|-----|
| React Frontend | http://localhost:5173 |
| Node.js API | http://localhost:3000 |
| Orchestrator API | http://localhost:8000 |

**Kill a port if already in use:**

```bash
lsof -i :<PORT> | awk 'NR>1 {print $2}' | xargs kill
```

---

## One-Click Azure Deployment

`deploy-all.sh` provisions **all** Azure resources and deploys all application components in a single command. No manual portal steps are required.

### What gets deployed

| # | Resource | SKU | Region |
|---|----------|-----|---------|
| 1 | Resource Group | — | configurable |
| 2 | Log Analytics Workspace | PerGB2018 | eastus |
| 3 | Application Insights | Web | canadacentral |
| 4 | Storage Account + 4 containers | Standard_LRS | eastus2 |
| 5 | Key Vault (RBAC) | Standard | eastus |
| 6 | Azure OpenAI + 5 model deployments | S0 | eastus |
| 7 | Azure AI Search + 2 vector indexes | Basic | centralus |
| 8 | Azure Cognitive Services Speech | S0 | eastus |
| 9 | Cosmos DB for MongoDB vCore | Free | eastus |
| 10 | App Service Plan | B1 Linux | canadacentral |
| 11 | Web App (Node 22 LTS) + Managed Identity | — | canadacentral |
| 12 | RBAC assignments | Key Vault + Blob | — |
| 13 | Key Vault secrets | All service keys | — |
| 14 | React frontend (built + uploaded) | Blob static site | — |
| 15 | Backend + Python agents (zip deployed) | — | — |

**Model deployments provisioned:**

| Deployment Name | Base Model | Used By |
|----------------|-----------|--------|
| `Conversation-Agent-Speaker-Tagging` | gpt-4o-mini | Conversational agent |
| `publishing_agent_model` | gpt-4o-mini | Publishing agent |
| `gpt-5.4-mini` | gpt-4o-mini | Orchestrator agent |
| `Phi-4-mini-instruct` | gpt-4o-mini* | Summarizer agent |
| `text-embedding-3-small` | text-embedding-3-small | RAG embeddings |

*Deployment name kept as `Phi-4-mini-instruct` for code compatibility; uses gpt-4o-mini as the underlying model.

### Run

```bash
# 1. Log in to Azure
az login

# 2. Deploy everything (takes ~15 minutes)
bash deploy-all.sh

# Optional: specify a resource group name and/or region
bash deploy-all.sh --resource-group my-rg --location eastus
```

The script will:
1. Generate a unique 8-char suffix for all globally unique resource names
2. Auto-generate JWT secret, internal API secret, and Cosmos DB password
3. Deploy `Infra/main.bicep` (all Azure resources in one ARM deployment)
4. Enable Blob Storage static website hosting
5. Create both AI Search indexes with vector search profiles
6. Build the React frontend and upload it to `$web` container
7. Package and zip-deploy the Node.js + Python agent bundle
8. Write `.env` files for all components (for local dev use)
9. Save a `.deployment-summary.txt` with all endpoints and resource names

### After deployment — upload knowledge base files

The ICD-10 files must be uploaded manually (they are not included in the repo):

```bash
# Read connection string from the generated .env
STORAGE_CONN=$(grep AZURE_STORAGE_CONNECTION_STRING deploy/.env | cut -d= -f2-)
STORAGE_NAME=$(grep -oP 'AccountName=\K[^;]+' deploy/.env | head -1)

# ICD-10 PDF → container 1
az storage blob upload \
  --account-name "$STORAGE_NAME" \
  --connection-string "$STORAGE_CONN" \
  --container-name az-medassistai-container1 \
  --file /path/to/icd_10_cm_october_2025_guidelines_0.pdf \
  --name icd_10_cm_october_2025_guidelines_0.pdf

# ICD-10 CSV → container 2
az storage blob upload \
  --account-name "$STORAGE_NAME" \
  --connection-string "$STORAGE_CONN" \
  --container-name az-medassistai-container2 \
  --file /path/to/section111_valid_icd10_october2025.csv \
  --name section111_valid_icd10_october2025.csv

# Populate AI Search indexes from the uploaded files
cd Backend/summarizer_agent
python prepare_kb.py
```

### Bicep template

The full infrastructure definition lives in [Infra/main.bicep](Infra/main.bicep). It is fully parameterised — no hardcoded subscription IDs, resource group names, or credentials. All secrets are auto-populated as Key Vault secrets and referenced in the Web App via Managed Identity.

To deploy just the infrastructure (without the app code):

```bash
az deployment group create \
  --resource-group <rg-name> \
  --template-file Infra/main.bicep \
  --parameters cosmosAdminPassword=<pw> jwtSecret=<jwt> internalApiSecret=<secret>
```

## Deployment

### Verify deployment

```bash
# Stream live logs from the Web App
az webapp log tail --resource-group <rg-name> --name webapp-mediassist-<suffix>

# Download logs for offline inspection
az webapp log download --name webapp-mediassist-<suffix> --resource-group <rg-name> --log-file /tmp/wl.zip
unzip -o /tmp/wl.zip -d /tmp/wl/
cat /tmp/wl/LogFiles/startup.log

# Check the full deployment summary (written by deploy-all.sh)
cat .deployment-summary.txt
```

### App Service startup sequence

The `startup.sh` script uses a **Node-first** strategy to satisfy the App Service 230-second warmup probe:

1. **Immediately** — Node.js starts (`exec node src/app.js` on port 3000). The warmup probe is satisfied within seconds.
2. **In the background** — A subshell creates the Python venv, runs `pip install`, writes `.env` files, then starts `uvicorn` on `127.0.0.1:8000`.
   - Python failures are non-fatal (`set +e`); Node.js continues serving if Python setup fails.
   - Background install typically completes in 3–5 minutes on a cold container.
3. **DB connection** — If `COSMOS_DB_CONNECTION_STRING` (resolved via Key Vault reference) is not yet available at first boot, the app starts in degraded mode (API endpoints fail gracefully until DB is reachable).

Log location inside the container: `/home/LogFiles/startup.log`.

---

## API Reference

All endpoints (except `/api/auth/*`) require `Authorization: Bearer <token>`.

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Login and receive JWT |

**Register body:**
```json
{ "name": "Jane Smith", "email": "jane@example.com", "password": "secure123", "role": "patient" }
```

**Login response:**
```json
{ "token": "<jwt>", "user": { "_id": "...", "name": "Jane Smith", "role": "patient" } }
```

### Appointments

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/appointments` | List appointments (filtered by role) |
| POST | `/api/appointments` | Book an appointment |
| PATCH | `/api/appointments/:id` | Update status / reschedule |
| DELETE | `/api/appointments/:id` | Cancel appointment |

### Medical Records

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/records` | List records for current user |
| POST | `/api/records` | Upload record (`multipart/form-data`) |
| GET | `/api/records/:id/download` | Get SAS download URL |
| DELETE | `/api/records/:id` | Delete record |

### Vitals

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/vitals` | Record vitals reading |
| GET | `/api/vitals` | List historical vitals |
| GET | `/api/vitals/latest` | Get most recent reading |

**Vitals body:**
```json
{ "systolic": 120, "diastolic": 80, "heartRate": 72, "temperature": 98.6, "weight": 70.5 }
```

### Chat (AI)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat/message` | Send message to conversational agent |
| GET | `/api/chat/history` | Retrieve session history |

---

## Environment Variables

> After running `deploy-all.sh` all `.env` files are written automatically. The values below are for reference when setting up local development manually.

### Node.js Backend (`deploy/.env`)

```env
PORT=3000
NODE_ENV=development
JWT_SECRET=<min 32 char random string>
JWT_EXPIRES_IN=7d

COSMOS_DB_CONNECTION_STRING=mongodb+srv://<user>:<pw>@<cluster>.global.mongocluster.cosmos.azure.com/?tls=true&authMechanism=SCRAM-SHA-256&retrywrites=false&maxIdleTimeMS=120000
COSMOS_DB_NAME=medassist-ai-main-db

AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=<name>;AccountKey=<key>;EndpointSuffix=core.windows.net
AZURE_STORAGE_CONTAINER_NAME=medassist-ai-files

AZURE_KEY_VAULT_URI=https://<vault-name>.vault.azure.net/
# Local dev only — not needed when running on App Service with Managed Identity
AZURE_TENANT_ID=
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=

FRONTEND_URL=http://localhost:5173
PYTHON_AGENT_URL=http://127.0.0.1:8000
INTERNAL_API_SECRET=<random string>
APPLICATIONINSIGHTS_CONNECTION_STRING=
```

### Frontend (`Frontend/medassist-V3/.env`)

```env
# Local development
VITE_API_URL=http://localhost:3000/api
VITE_SOCKET_URL=http://localhost:3000

# Production (written automatically by deploy-all.sh)
# VITE_API_URL=https://webapp-mediassist-<suffix>.azurewebsites.net/api
# VITE_SOCKET_URL=https://webapp-mediassist-<suffix>.azurewebsites.net
```

### Python Agents (shared across all four agents)

```env
AZURE_OPENAI_ENDPOINT=https://<name>.openai.azure.com/
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_API_VERSION=2024-06-01
AZURE_OPENAI_CHAT_DEPLOYMENT_NAME=Conversation-Agent-Speaker-Tagging
AZURE_OPENAI_CHAT_DEPLOYMENT=Phi-4-mini-instruct
AZURE_OPENAI_DEPLOYEMENT=Phi-4-mini-instruct   # intentional typo — kept for compat
AZURE_OPENAI_DEPLOYMENT=publishing_agent_model
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-3-small
ORCHESTRATION_DEPLOYMENT_NAME=gpt-5.4-mini
DEPLOYMENT_NAME=Conversation-Agent-Speaker-Tagging

SPEECH_KEY=
SPEECH_REGION=eastus

AZURE_SEARCH_ENDPOINT=https://<name>.search.windows.net
AZURE_SEARCH_ADMIN_KEY=
AZURE_SEARCH_INDEX=az-med-cont1-index-final
AZURE_SEARCH_INDEX1=az-med-cont1-index2

AZURE_STORAGE_CONNECTION_STRING=
AZURE_BLOB_CONTAINER_NAME=az-medassistai-container1
AZURE_BLOB_CONTAINER_NAME1=az-medassistai-container2

MONGO_URI=mongodb+srv://...
MONGO_DB_NAME=medassist-ai-main-db
INTERNAL_API_SECRET=
```

---

## Database Schema

### Users
```js
{ name, email, passwordHash, role, phone, dateOfBirth, gender,
  specialization, licenseNumber, createdAt, updatedAt }
```

### Appointments
```js
{ patientId, doctorId, date, time, reason,
  status: ['scheduled','confirmed','completed','cancelled'],
  notes, attachments: [fileUrl], createdAt }
```

### Medical Records
```js
{ userId, title, description, fileUrl, fileSize, mimeType,
  uploadedBy, category: ['lab_report','prescription','imaging','other'],
  uploadedAt }
```

### Medications
```js
{ patientId, name, dosage, frequency, prescribedBy,
  startDate, endDate, active,
  doses: [{ scheduledTime, taken, takenAt }] }
```

### Vitals
```js
{ userId, systolic, diastolic, heartRate, temperature,
  weight, height, recordedAt, notes }
```

### Chat Messages
```js
{ userId, message, response, aiModel, metadata, timestamp }
```

---

## Future Phase
- Patient Care & Guidance from approved clinical outputs​
- Post-visit education and contextual follow-up Q&A​

## Team Name - WNS Vuram Health Agent 
**Team Members**
- Bhargav Parnandi
- Manish Kumar
- Gopinath S
- Sakthiprabha M
- Arunkumar M
- Nagarasu P

---

**Version:** 1.2.0 | **Status:** Azure Go-Live | **Last Updated:** 2026-05-13
