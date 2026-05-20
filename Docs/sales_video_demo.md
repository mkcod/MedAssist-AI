# MediAssist-AI — 2-Minute Sales Video Script
**Duration:** 2:00  
**Format:** Voiceover + Screen Recording  
**Audience:** Hospital administrators, clinic owners, healthcare IT buyers, investors  

---

## PRE-RECORDING CHECKLIST

- [ ] App running at `http://localhost:5173` — logged in as Doctor, dashboard visible
- [ ] A completed SOAP note ready to display (no waiting during the recording)
- [ ] Patient view open in a second browser tab
- [ ] Azure Portal open to the resource group (brief pan only)
- [ ] Smooth, clean screen — close all dev tools, terminals, and notifications

---

## SEGMENT 1 — THE PAIN (0:00 – 0:20)

### Screen: Clean stat card or simple slide
> *White background, large text:*  
> **"Clinicians spend up to 2 hours a day on paperwork."**  
> **"That's time not spent with patients."**

**VOICEOVER:**
> "Every day, doctors across the world spend hours doing something they didn't train for — writing notes, coding diagnoses, filing records. Administrative burden is the number one driver of clinician burnout. It delays billing, creates compliance risk, and most importantly, keeps doctors away from the people who need them.
>
> There has to be a better way."

---

## SEGMENT 2 — THE REVEAL (0:20 – 0:35)

### Screen: MediAssist logo fades in, then transitions to the live app dashboard

**VOICEOVER:**
> "Introducing MediAssist-AI — the clinical documentation platform that turns a doctor-patient conversation into a complete, validated medical record in seconds. Automatically. Accurately. Every time."

*[Show the clean, professional MediAssist dashboard with the doctor's name visible — appointments, records, vitals tiles all populated with real data.]*

---

## SEGMENT 3 — THE CORE DEMO (0:35 – 1:10)

### Screen: Navigate to the AI Pipeline / SOP trigger page

**VOICEOVER:**
> "Here is how it works. After a consultation, the doctor simply clicks Trigger — the AI takes it from there."

*[Click the Trigger button. Show the real-time pipeline progress bar or log events streaming in.]*

> "In the background, our AI Orchestrator is coordinating three specialist agents. One analyses the conversation and maps it to an ICD-10 diagnosis code. Another extracts the clinical narrative. The third assembles the full SOAP note — Subjective, Objective, Assessment, Plan."

*[Pause on the loading / in-progress state for 2–3 seconds so the viewer sees work happening.]*

> "And here it is."

*[The completed SOAP record appears on screen. Let it sit for a full 3 seconds — let the viewer read it.]*

> "A complete, structured, ICD-10-coded clinical note. Reviewed in one click, published in the next."

*[Click Publish. Switch to the patient tab — show the notification pop in.]*

> "The patient is notified instantly. Their record is filed. Billing can begin immediately."

---

## SEGMENT 4 — PATIENT EXPERIENCE (1:10 – 1:25)

### Screen: Patient view — Records page and AI Chat

**VOICEOVER:**
> "And the experience doesn't stop with the doctor. Patients log in, see their records, their medications, their vitals — and can ask our AI assistant questions about their diagnosis in plain language."

*[Type a short question in the AI Chat: "What should I do for my recovery?" — show the response streaming in.]*

> "A healthcare companion available to every patient, 24 hours a day."

---

## SEGMENT 5 — TRUST & PLATFORM (1:25 – 1:42)

### Screen: Azure Portal — Resource Group, briefly pan across service icons

**VOICEOVER:**
> "MediAssist-AI is built on Microsoft Azure — the platform trusted by healthcare organisations worldwide. Azure OpenAI powers the intelligence. Azure AI Search grounds every diagnosis in a validated ICD-10 knowledge base, not guesswork. All data is encrypted, all secrets are managed by Azure Key Vault, and the entire platform deploys to any Azure environment with a single command.
>
> Enterprise-grade security and compliance from day one."

---

## SEGMENT 6 — THE BUSINESS CASE (1:42 – 1:52)

### Screen: Simple animated stat cards

> *Card 1:* **30 minutes of documentation → 10 seconds**  
> *Card 2:* **20 doctors × 30 patients = 300 records/day — fully automated**  
> *Card 3:* **Faster billing. Fewer errors. Happier clinicians.**

**VOICEOVER:**
> "Thirty minutes of documentation work reduced to ten seconds. Across a practice of twenty doctors, thirty patients a day — that is hundreds of clinical hours recovered every month. Faster billing cycles, fewer coding errors, and doctors who actually want to come to work."

---

## SEGMENT 7 — CALL TO ACTION (1:52 – 2:00)

### Screen: MediAssist-AI logo, tagline, contact details

**VOICEOVER:**
> "MediAssist-AI. Documentation that works as fast as you do.
>
> Let's talk."

---

## PRODUCTION NOTES

**Tone:** Confident, outcome-focused, empathetic to the clinical audience. Never technical.  
**Music:** Light, forward-moving instrumental — subtle under voiceover, slightly louder on the stat cards.  
**Pacing:** Segment 3 is the hero. Do not rush through the SOAP note reveal — let the viewer see it fully.  
**On-screen text:** Add short caption overlays for the three key stats in Segment 6 if animated cards are not available.  
**Cut points:** If the live pipeline takes more than 5 seconds, cut to the completed SOAP note directly — time is too short for waiting.  

**What NOT to show:**
- Code, terminals, or architecture diagrams
- Azure service configuration screens
- Any loading spinners that sit for more than 2 seconds
- Error states or retry messages
