# Release Notes — May 2026

**Release Summary**

This release (changes since 2026-05-01) focuses on RAG pipeline stability and test coverage, orchestration API and publishing-tool improvements, ingestion and indexing additions, and several frontend fixes to the MedAssist UI. It's intended for backend engineers, integrators, and on-call maintainers who operate the orchestrator, summarizer (RAG) services, and publishing agents.

**Highlights**

- RAG pipeline: multiple improvements and new unit tests to increase reliability and determinism. Key files: [Backend/summarizer_agent/rag_pipeline.py](Backend/summarizer_agent/rag_pipeline.py), [Backend/summarizer_agent/retrieval.py](Backend/summarizer_agent/retrieval.py), and [tests/test_rag_pipeline.py](tests/test_rag_pipeline.py).
- Orchestrator stabilization: API server fixes, tooling improvements, and generated `final_output` SOAP records added for E2E validation. Key files: [Backend/orchestrator_agent/api_server.py](Backend/orchestrator_agent/api_server.py) and [Backend/orchestrator_agent/final_output/](Backend/orchestrator_agent/final_output).
- Publishing and validation tooling: guardrails, SOAP validation and publishing helper updates to improve downstream publishing reliability. Key files: [Backend/Publishing_Agent/tools/guardrails_tool.py](Backend/Publishing_Agent/tools/guardrails_tool.py), [Backend/Publishing_Agent/tools/soap_tool.py](Backend/Publishing_Agent/tools/soap_tool.py).
- Frontend fixes: UI/UX and API service client updates to the React app used by MedAssist. Key files: [Frontend/medassist-V3/src/pages/AIChat.jsx](Frontend/medassist-V3/src/pages/AIChat.jsx), [Frontend/medassist-V3/src/App.jsx](Frontend/medassist-V3/src/App.jsx), and [Frontend/medassist-V3/src/services/api.js](Frontend/medassist-V3/src/services/api.js).
- CI/workflow tuning: multiple updates to `.github/workflows/main.yml` to refine build/test flows.

**Features**

- Added ingestion scripts and helpers for search indexing and blob ingestion: see [Backend/summarizer_agent/scripts](Backend/summarizer_agent/scripts) (`ingest_blob_to_search.py`, `ingest_xlsx_to_search.py`). These enable re-populating the search index used by the RAG pipeline.
- Persisted RAG vectors and sample datasets for reproducible tests: [Backend/summarizer_agent/rag_vectors.json](Backend/summarizer_agent/rag_vectors.json) and `rag_dataset.json` updates.

**Improvements**

- Consolidated publication/summarization logic in `pub_tool.py` and `summ_tool.py` to reduce duplicate logic and improve error handling: [Backend/orchestrator_agent/tools/pub_tool.py](Backend/orchestrator_agent/tools/pub_tool.py), [Backend/orchestrator_agent/tools/summ_tool.py](Backend/orchestrator_agent/tools/summ_tool.py).
- Improved API client robustness in the frontend service layer: [Frontend/medassist-V3/src/services/api.js](Frontend/medassist-V3/src/services/api.js).
- Updated dependency manifests and example env files across services for clearer local/dev setup: `Backend/summarizer_agent/requirements.txt`, `Backend/Medassist-Backend/.env.example`, and other `.env.example` updates.

**Bug Fixes**

- Fixed RAG retrieval edge cases and indexing bugs in `Backend/summarizer_agent/retrieval.py`.
- Resolved orchestration routing and handler errors in `Backend/Medassist-Backend/src/routes/orchestrator.js` and `Backend/orchestrator_agent/api_server.py`.

**Breaking Changes & Migration Notes**

- Environment variables: several `.env.example` files were changed. Before deploying, sync your runtime `.env` files with the updated examples: `Backend/summarizer_agent/.env.example` and `Backend/Medassist-Backend/.env.example`.
- API surface: validate any clients depending on the orchestrator routes in `Backend/Medassist-Backend/src/routes/orchestrator.js` for compatibility.

Migration steps:

1. Pull the updated `.env.example` files and merge relevant variables into your deployed environment.
2. If your deployment relies on RAG/semantic search, run the ingestion scripts to rebuild vectors and indices:

```
python Backend/summarizer_agent/scripts/generate_embeddings.py
python Backend/summarizer_agent/scripts/ingest_blob_to_search.py
```

3. Run unit tests for the RAG pipeline and validate orchestration flows with the sample SOAP outputs:

```
pytest tests/test_rag_pipeline.py
# then run any orchestration integration checks using sample files under
ls Backend/orchestrator_agent/final_output/
```

**Notable Commits (selection)**

- `5abc202` — 3May2026-b1 — Updated `Backend/orchestrator_agent/api_server.py` and `README.md`.
- `57266b1` — 2May2026-b17 — Cross-repo updates: orchestrator routes, publishing tools, frontend pages, and added multiple `final_output` SOAP records.
- `25ca3f9` — 1May2026-b7 — RAG dataset and ingestion scripts added; summarizer changes and new `tests/test_rag_pipeline.py`.
- `021b7ef` — 1May2026 — Orchestrator + publishing tool updates and multiple SOAP outputs added.

**Testing / Validation**

- Unit tests: run `pytest tests/test_rag_pipeline.py` and address any failures prior to deployment.
- Smoke tests: run the orchestrator API locally (`Backend/orchestrator_agent/api_server.py`) and POST sample SOAP records found in `Backend/orchestrator_agent/final_output/`.

**Notes for Reviewers**

- Focus review on `Backend/summarizer_agent/rag_pipeline.py` and `Backend/summarizer_agent/retrieval.py` for correctness and edge-case handling.
- Confirm `pub_tool.py` and `summ_tool.py` changes do not regress publishing flows: perform a local publish dry-run where possible.
- Validate that frontend API client changes haven't regressed auth/session handling in `Frontend/medassist-V3/src/contexts/SocketContext.jsx` and `Frontend/medassist-V3/src/pages/Login.jsx`.

---

If you want, I can:
- produce a 2-line public announcement, or
- open a PR that adds `RELEASE_NOTES.md` and a short announcement in `README.md`, or
- run `pytest tests/test_rag_pipeline.py` and report the results now.
