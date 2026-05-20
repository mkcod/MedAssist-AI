# MediAssist AI — Release Notes
**Date:** 13 May 2026  
**Branch:** `dev` → `main`

---

## Overview

This release focuses on deployment reliability, Key Vault integration, CI/CD pipeline hardening, and a major rewrite of the orchestrator routing layer. Several critical runtime bugs introduced by missing declarations and mock implementations have been resolved.

---

## Bug Fixes

### Startup & Deployment (`startup.sh`, `deploy-all.sh`)
- **Fixed `WWWROOT` path** — corrected `"${HOME}/site/wwwroot"` to `"/home/site/wwwroot"` (container `$HOME=/root`).
- **Fixed App Service warmup probe timeout** — Node.js now starts immediately; all Python work (venv, pip install, `.env` write, uvicorn) is moved to a background subshell so it cannot block the 230 s warmup probe.
- **Eliminated startup script drift** — `deploy-all.sh` now copies `startup.sh` from the repo instead of embedding an inline heredoc copy.

### Node.js Backend (`app.js`)
- `start()` no longer calls `process.exit(1)` on a `connectDB()` failure. The server starts in **degraded mode** and logs a warning; endpoints fail gracefully until the DB becomes available.

### Orchestrator Route (`orchestrator.js`)
- **Resolved `ReferenceError` on every `/transcribe` call** — added missing declarations: `PYTHON_AGENT_URL`, `getInternalSecret()`, `PYTHON_AGENT_READY_RETRIES`, `PYTHON_AGENT_READY_DELAY_MS`, `sleep()`, and `waitForPythonAgentReady()`.
- **Fixed 403 on `/trigger`** — role guard was `patient`-only; changed to `['patient', 'doctor']`.
- **Replaced mock `runPipeline`** — removed `delay()`-based fake and keyword-based `generateSOAPFromTranscript()`. Real implementation now:
  - Calls `PYTHON_AGENT_URL/run-pipeline` with the full payload.
  - Falls back to keyword extraction if Python is offline.
  - Normalises ICD-10 field names (`icd10_code` → `icd10Code`).
  - Tracks both `patientId` and `initiatorId` on each job.
  - Emits `sop:new` and `notification:received` socket events to both parties.
- **Fixed `/status` endpoint** — doctors (initiators) were getting 403 when polling their own jobs; now allows either `patientId` or `initiatorId`.
- **Added `/agent-health` route** — proxies to Python `/health`.
- **Added `/log` route** — receives real-time stage log events from Python and relays them via socket to both initiator and patient rooms.
- Removed dead code: `generateSOAPFromTranscript()`, duplicate `runPipeline`, duplicate status/cleanup block, duplicate `module.exports`.

### Key Vault Integration
- **`keyVault.js`** — replaced `DefaultAzureCredential` with `ManagedIdentityCredential()` (system-assigned) when running on App Service (`WEBSITE_SITE_NAME` detected), falling back to `DefaultAzureCredential` locally. Fixes "No User Assigned or Delegated Managed Identity found" error.
- **`database.js`** — added fallback to Key Vault for `COSMOS_DB_CONNECTION_STRING` when not present in environment.
- **`orchestrator.js` (Node)** — replaced module-level `const INTERNAL_API_SECRET` with lazy `getInternalSecret()` call so Key Vault value is resolved at request time.

### Python Agents
- **`rag_pipeline.py`** — moved `logger = logging.getLogger(__name__)` to immediately after `import logging`, before any downstream imports that could fail.
- **`rag_pipeline.py`** — added missing `from retrieval import retrieve_top_k` import.
- **`rag_pipeline.py`** — replaced `max_tokens` with `max_completion_tokens` in all LLM API calls (required by Phi-4-mini-instruct).
- **`rag_pipeline.py`** — increased `max_completion_tokens` in `generate_action_plan_llm` from `200` → `600` to prevent JSON truncation on 5-item action plans.
- **`summ_tool.py`** — added `traceback.format_exc()` logging in the exception handler for improved diagnostics.
- **Orchestrator agent `.env`** — corrected `ORCHESTRATION_DEPLOYMENT_NAME` from non-existent `gpt-5.4-mini` to `Phi-4-mini-instruct`.

---

## New Features

### Azure Blob Storage
- Successfully ingested `section111_valid_icd10_october2025.csv` into blob container `az-medassistai-container2` (storage account `stmedassiste8976d87`).

### Azure Search Index (`create_index_sample.json`)
- Removed unused fields (`title`, `chunk_id`).
- Added required fields: `condition`, `icd_code`, `description`, `symptom`.
- Renamed vector field `contentVector` → `embedding` (matches retrieval query).
- Fixed vector dimensions: `1536` → `3072` (aligned with `text-embedding-3-large`).
- Removed invalid payload fields (`@odata.etag`, `purviewEnabled`).
- Set `sortable: false` on all language-analyzed fields (Azure Search constraint).

---

## CI/CD (`main.yml`)

- Added `.env.example` → `.env` copy steps in all three build jobs (`build-python-agents`, `build-backend`, `build-frontend`).
- Added deploy-job step: assigns system-assigned Managed Identity to the App Service and grants it **Key Vault Secrets User** RBAC role automatically.

---

## Azure Configuration (Manual)

- Configured OIDC federated identity credential on `MedAssist-AI` App Registration (subject: `repo:Cloudlabs-Enterprises/MediAssist-AI-WNSVuram-HA:ref:refs/heads/dev`).
- Added required GitHub Actions secrets: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `AZURE_KEY_VAULT_NAME`.
- Assigned **Contributor** / **Website Contributor** role to the service principal on the resource group/App Service.
- Assigned **Key Vault Secrets User** to the service principal and the App Service Managed Identity.
- Added missing secret `OPENAI-API-KEY` to Key Vault `kv-medai-e8976d87`.
- Granted `Key Vault Secrets Officer` role to the signed-in developer identity.
- Force-pushed `dev` → `main` to synchronise branches (`13de16f` → `d49fa2d`).

---

## Documentation

- **`README.md`** bumped `1.1.0` → `1.2.0`.
- Added `az webapp log download` command to the Verify Deployment section.
- Added **App Service startup sequence** section (Node-first strategy, background Python install, degraded-mode DB behaviour).
- Added 4 troubleshooting entries: exit code 127, wrong `WWWROOT` path, `ContainerTimeout` from pip blocking warmup probe, 503 on cold start (degraded mode).
- Updated `deployment-requirements.txt` and `.env.example` to reference `text-embedding-3-large` (was `text-embedding-3-small`).
- Added `.DS_Store` to `.gitignore`.

---

## Pending / Known Issues

| Item | Status |
|------|--------|
| `icd_10_cm_october_2025_guidelines_0.pdf` upload to `az-medassistai-container1` | File not found in workspace — upload blocked |
| `AZURE_STORAGE_CONNECTION_STRING` in `summarizer_agent/.env` | Must be populated before ingest scripts (`ingest_blob_to_search.py`, `ingest_csv_to_search.py`) can run locally |

---

