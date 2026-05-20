# MediAssist-AI — Hackathon Demo Video Script
**Duration Target:** 7–9 minutes  
**Format:** Voiceover + Screen Recording  
**Audience:** CAF/WAF judges + hackathon panel  

---

## PRE-RECORDING CHECKLIST

Before hitting record, have open and ready:
- [ ] Browser tab: MediAssist frontend running at `http://localhost:5173`
- [ ] Terminal showing the running stack (Python agent on :8000, Node on :3000)
- [ ] Azure Portal open — Resource Group `rg-mediassist` with all deployed resources visible
- [ ] VS Code open to the repo root for brief code walk-throughs
- [ ] GitHub Actions page open showing a recent successful CI/CD run
- [ ] A sample transcript JSON or a short audio clip ready for the live demo

---

## SEGMENT 1 — HOOK & PROBLEM STATEMENT (0:00 – 0:45)

### Screen: Static title card or black screen with MediAssist logo

**VOICEOVER:**
> "Every day, clinicians spend up to two hours on documentation — writing notes, coding diagnoses, filing records — time stolen directly from patient care. For hospitals dealing with high patient volumes, incomplete or delayed SOAP notes create billing delays, compliance risks, and a degraded care experience.
>
> MediAssist-AI is our answer: a fully AI-automated clinical documentation platform that listens to a doctor-patient conversation and, within seconds, produces a validated, ICD-10-coded SOAP record — ready to publish."

---

## SEGMENT 2 — SOLUTION OVERVIEW & ARCHITECTURE (0:45 – 2:15)

### Screen: Architecture diagram (draw or show the ASCII diagram from README, or a cleaned-up slide)

**VOICEOVER:**
> "MediAssist-AI is built as a multi-layered platform on Azure. Let's walk through the architecture."

**[Point to Frontend layer]**
> "The React and Vite single-page application provides role-based views for Patients, Doctors, Receptionists, and Attendees. It handles appointment booking, medical record uploads, vitals tracking, real-time chat, and the AI pipeline trigger — all in one place."

**[Point to Node.js layer]**
> "The Node.js Express API acts as the central backend: JWT authentication, REST endpoints, Mongoose models backed by Azure Cosmos DB for MongoDB, and a Socket.io layer for real-time notifications."

**[Point to Python AI Agents layer]**
> "The intelligence layer is a coordinated pipeline of four specialised Python agents — an Orchestrator, a Summarizer, a Conversational agent, and a Publishing Agent. They communicate via an internal FastAPI server on port 8000 and are secured with a shared API secret resolved from Azure Key Vault at runtime."

**[Point to Azure Services]**
> "The entire platform runs on Azure. Azure Cosmos DB stores all structured data. Azure Blob Storage holds medical files, the ICD-10 knowledge base, and static assets. Azure AI Search powers the RAG retrieval pipeline. Azure OpenAI provides the LLM and embeddings, and Azure Key Vault manages every secret — zero hard-coded credentials anywhere in the codebase. Application Insights and Log Analytics give us full observability."

**[Briefly show Infra/main.bicep in VS Code]**
> "And all of this is provisioned by a single Bicep file — one command deploys the entire stack."

---

## SEGMENT 3 — USER STORIES & REQUIREMENTS (2:15 – 3:00)

### Screen: Slide or VS Code showing README Features section

**VOICEOVER:**
> "We defined the solution around four concrete user roles with clear acceptance criteria."

**[Point to features list]**
> "For Doctors: trigger the AI pipeline from any consultation, receive a fully structured SOAP note with ICD-10 codes, review it, and publish it — no manual transcription.  
>
> For Patients: view their own published records, track medications and vitals, and interact with the conversational AI agent to ask medical questions in natural language.  
>
> For Receptionists: manage appointments and patient intake.  
>
> For Attendees: monitor patient vitals and flag abnormal readings in real time.  
>
> Every role is enforced at both the API middleware level and the frontend routing level."

---

## SEGMENT 4 — LIVE DEMO: THE AI PIPELINE (3:00 – 6:00)

### SUB-SEGMENT 4A — Login & Role-Based Dashboard (3:00 – 3:30)

**Screen:** Navigate to `http://localhost:5173`

**VOICEOVER:**
> "Let me show the working solution. I'll log in as a Doctor."

*[Type credentials on Login screen, show the dashboard loading with role-specific tiles.]*

> "The Doctor dashboard immediately shows pending appointments, recent SOAP records, and quick actions — all driven by live data from Cosmos DB."

---

### SUB-SEGMENT 4B — Triggering the Clinical AI Pipeline (3:30 – 4:30)

**Screen:** Navigate to the SOP/AI Pipeline page (`/sop` or the trigger button from the dashboard)

**VOICEOVER:**
> "Now, the core capability. The doctor selects a patient and triggers the AI pipeline — in a real consultation this would follow an audio transcription step using Azure Cognitive Services Speech."

*[Click Trigger, paste or submit a sample transcript. Show the real-time log events streaming in via Socket.io.]*

> "Watch the pipeline stages in real time. The Orchestrator Agent — powered by Azure OpenAI — routes the transcript to three agents in sequence.  
>
> First, the Summarizer Agent performs Retrieval-Augmented Generation against our ICD-10 knowledge base indexed in Azure AI Search. It extracts symptoms, identifies the probable condition, and maps it to an ICD-10 code.  
>
> Next, the Conversational Agent processes the clinical context for the Q&A summary.  
>
> Finally, the Publishing Agent assembles the full SOAP note — Subjective, Objective, Assessment, Plan — applies guardrails validation, and returns the structured JSON."

---

### SUB-SEGMENT 4C — SOAP Record Output (4:30 – 5:00)

**Screen:** Show the completed SOAP record displayed in the frontend

**VOICEOVER:**
> "Within seconds, a complete, validated SOAP record appears. ICD-10 code mapped, action plan generated, clinical summary written. The doctor reviews it and clicks Publish — which writes the final record to Cosmos DB and notifies the patient in real time via Socket.io."

*[Click Publish, switch browser tab to the patient view, show the notification appear.]*

---

### SUB-SEGMENT 4D — AI Chat & Conversational Agent (5:00 – 5:30)

**Screen:** Navigate to `/aichat`

**VOICEOVER:**
> "Patients also have access to our conversational AI agent. They can ask questions about their diagnosis, medications, or next steps — and get medically-grounded, context-aware answers."

*[Type a question like: "What does ICD-10 code G93.30 mean for my recovery?" — show the streamed response.]*

> "This agent draws on the same Azure OpenAI deployment but with a patient-safe system prompt — no diagnostic overreach, clear referral guidance."

---

### SUB-SEGMENT 4E — Records, Vitals & Appointments (5:30 – 6:00)

**Screen:** Quickly tab through Records, Vitals, Appointments pages

**VOICEOVER:**
> "The platform isn't just AI. Medical records upload securely to Azure Blob Storage via SAS URLs. Vitals are tracked over time with Recharts visualisations and abnormal-reading alerts. Appointments are booked, rescheduled, and tracked with real-time status."

---

## SEGMENT 5 — PLATFORM EXCELLENCE: MICROSOFT CAPABILITIES (6:00 – 6:45)

### Screen: Azure Portal — Resource Group overview showing all services

**VOICEOVER:**
> "Let's quickly walk through our intentional use of Microsoft platform services."

*[Click through each resource in the portal as you name them:]*

> "**Azure OpenAI** — GPT-4 class model for orchestration, Phi-4-mini-instruct for lightweight summarization, and text-embedding-3-large at 3072 dimensions for semantic vector search. Five deployments, chosen deliberately for cost-performance balance at hackathon scale.
>
> **Azure AI Search** — our RAG backbone. The ICD-10 knowledge base is indexed with vector and keyword fields. Retrieval uses hybrid search for accuracy.
>
> **Azure Cosmos DB for MongoDB vCore** — multi-collection document store for users, appointments, records, medications, vitals — all with a single connection string managed through Key Vault.
>
> **Azure Key Vault** — every secret is resolved at runtime via Managed Identity on App Service and via Service Principal locally. Zero secrets in environment files checked into source control.
>
> **Azure Cognitive Services Speech** — conversation transcription powering the doctor-patient audio capture flow.
>
> **Application Insights** — end-to-end observability. Every agent call, pipeline stage, and API error is instrumented."

---

## SEGMENT 6 — CODE QUALITY & CI/CD (6:45 – 7:30)

### Screen: GitHub Actions — show a successful workflow run, then briefly show VS Code

**VOICEOVER:**
> "On the engineering quality side:"

*[Show the GitHub Actions workflow passing:]*

> "Our CI/CD pipeline on GitHub Actions builds and tests all three layers — Python agents, Node.js backend, React frontend — in parallel jobs. It copies env examples, runs pytest on the RAG pipeline, and on push to main, deploys to Azure App Service using OIDC federated identity — no long-lived secrets stored in GitHub.
>
> The deploy step automatically assigns the App Service's system-assigned Managed Identity the Key Vault Secrets User role — a fully scripted, repeatable, least-privilege deployment."

*[Briefly show `Backend/summarizer_agent/rag_pipeline.py` and `tests/test_rag_pipeline.py`:]*

> "The RAG pipeline has unit test coverage. The Publishing Agent has guardrails validation. The Orchestrator has retry logic with exponential back-off and a Cosmos DB audit store — every pipeline run is logged."

*[Briefly show `Infra/main.bicep`:]*

> "Infrastructure as Code via Bicep. One file provisions the entire environment, deterministically, in any Azure subscription."

---

## SEGMENT 7 — BUSINESS & USER IMPACT (7:30 – 8:00)

### Screen: Return to the SOAP record output shown earlier

**VOICEOVER:**
> "What does this mean in practice? A consultation that would generate 15–30 minutes of documentation work is reduced to a 10-second pipeline. The SOAP note is structured, ICD-10-coded, and ready for billing — directly reducing revenue cycle delays.
>
> Patients get their records and a conversational interface to understand their diagnosis — improving health literacy and engagement. Clinicians reclaim time for actual care. Compliance is improved because records are always complete and consistently formatted.
>
> The same pipeline architecture can extend to specialty workflows — oncology, mental health, physiotherapy — with different knowledge bases loaded into Azure AI Search."

---

## SEGMENT 8 — AI & AUTOMATION VALUE (8:00 – 8:30)

### Screen: Brief replay or diagram of the agent pipeline flow

**VOICEOVER:**
> "The AI value in MediAssist is not just a chatbot wrapper. It is a multi-agent, multi-step reasoning pipeline.
>
> The Orchestrator Agent uses Azure OpenAI with tool-calling to decide, at runtime, which specialist agents to invoke and in what order — adapting to the content of the conversation.
>
> The Summarizer uses RAG, not hallucination — grounded in a real ICD-10 dataset, retrieved semantically from Azure AI Search, ranked by relevance, and fed as context to the LLM.
>
> The Publishing Agent applies guardrails validation before any record is finalised — ensuring the output meets clinical note standards before it reaches the doctor's screen.
>
> Together, they replace a manual, error-prone, time-consuming process with an automated, auditable, explainable pipeline — that is the automation value."

---

## SEGMENT 9 — CLOSE (8:30 – 9:00)

### Screen: Return to the dashboard or a summary architecture slide

**VOICEOVER:**
> "MediAssist-AI — reducing clinical documentation from minutes to seconds, built entirely on Azure, deployable with a single command, and designed to scale.
>
> Thank you."

---

## PRODUCTION NOTES

| Segment | Key Screen Action | Azure Service Highlighted |
|---------|------------------|--------------------------|
| 1 | Title card | — |
| 2 | Architecture diagram | Full stack |
| 3 | README / features slide | — |
| 4A | Login → Dashboard | Cosmos DB, JWT |
| 4B | Trigger AI pipeline | Azure OpenAI, AI Search, Speech |
| 4C | SOAP record + Publish | Cosmos DB, Socket.io |
| 4D | AI Chat | Azure OpenAI (conversational) |
| 4E | Records / Vitals / Appointments | Blob Storage |
| 5 | Azure Portal resource group | All Azure services |
| 6 | GitHub Actions + VS Code | GitHub, App Service, Key Vault |
| 7 | SOAP record (recall) | Business impact |
| 8 | Agent pipeline diagram | OpenAI, AI Search, Orchestrator |
| 9 | Dashboard / title | — |

### Timing Tips
- Keep segment 4 (live demo) moving fast — aim for one fluid take
- Pause 1 second on the SOAP record output so judges can read it
- Have the Azure Portal pre-filtered to your resource group to avoid navigation delays
- If the live pipeline is slow, cut to a pre-recorded clip for the pipeline execution and rejoin live for the SOAP output display

### CAF/WAF Touch-Points to Emphasise
- **Reliability**: retry logic, graceful DB degraded-mode startup, health endpoint
- **Security**: Key Vault for all secrets, Managed Identity, RBAC (no standing access), Helmet + rate-limit on API
- **Cost Optimisation**: Bicep suffix-based unique names, B1 App Service, free/M10 Cosmos tier, 30-day log retention
- **Operational Excellence**: CI/CD with OIDC, Bicep IaC, Application Insights, structured logging
- **Performance Efficiency**: RAG hybrid search, streaming socket events, Vite + Tailwind frontend build
