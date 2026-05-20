"""
MedAssist Python Agent Bridge — FastAPI Server

This server bridges the Node.js backend with the 3 Python AI agents.

Flow:
  Frontend (records audio/transcript)
      → Node.js /api/orchestrator/trigger
      → THIS FastAPI server /run-pipeline
      → Summarizer Agent (symptoms, ICD-10)
      → Publishing Agent (SOAP record)
      → Returns SOAP JSON to Node.js
      → Node.js saves to MongoDB + notifies via socket

Run:  python -m uvicorn api_server:app --host 127.0.0.1 --port 8000
"""

import asyncio
import json
import logging

# On Windows, stdout/stderr default to cp1252 which can't encode emoji in log messages.
# Force UTF-8 so all console output is consistent across platforms.
import sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

# Inject OS certificate store so requests trusts Windows/macOS/Linux system CAs
# (fixes SSL errors on Windows with corporate/self-signed certificates)
try:
    import truststore
    truststore.inject_into_ssl()
except ImportError:
    pass  # truststore not installed, fall back to certifi
import os
import sys
import time
import traceback

# ── Azure Monitor / Application Insights ─────────────────────────────────────
# Must be called before the FastAPI app is created so that the OpenTelemetry
# middleware is injected and all incoming requests + outgoing HTTP calls are
# captured in the Log Analytics requests / dependencies tables.
def _init_azure_monitor():
    conn_str = os.environ.get("APPLICATIONINSIGHTS_CONNECTION_STRING")
    if not conn_str:
        return
    try:
        from azure.monitor.opentelemetry import configure_azure_monitor
        configure_azure_monitor(
            connection_string=conn_str,
            logger_name="medassist",
        )
    except Exception as exc:
        print(f"[api_server] Azure Monitor init skipped: {exc}", file=sys.stderr)

_init_azure_monitor()

from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Header, File, UploadFile, Form
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# ── Load environment ──────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent
load_dotenv(dotenv_path=BASE_DIR / ".env", override=False)  # .env sets bootstrap only; KV overrides secrets

# ── Load secrets from Key Vault (Managed Identity on App Service; SP locally) ─
from kv_loader import load_secrets_from_keyvault
load_secrets_from_keyvault()

# ── Add orchestrator_agent to path so tools can be imported ──────────────────
# The api_server.py lives inside the orchestrator_agent folder, so BASE_DIR
# already points to that directory. Avoid joining it again which caused
# a duplicated path like .../orchestrator_agent/orchestrator_agent.
ORCHESTRATOR_DIR = BASE_DIR
sys.path.insert(0, str(ORCHESTRATOR_DIR))

app = FastAPI(title="MedAssist Agent Bridge", version="1.0.0")
RUNTIME_BUILD = "api_server_2026_05_01_02"


def _job_id_from_body(body: bytes) -> Optional[str]:
    try:
        payload = json.loads(body.decode(errors="ignore") or "{}")
        return payload.get("job_id") or payload.get("jobId")
    except Exception:
        return None


@app.middleware("http")
async def log_requests(request, call_next):
    content_type = request.headers.get("content-type", "")
    is_binary = any(t in content_type for t in ("multipart/", "audio/", "video/", "image/", "application/octet"))

    try:
        body = b'' if is_binary else await request.body()
    except Exception:
        body = b''

    job_id = _job_id_from_body(body)
    message = f"Incoming request: {request.method} {request.url.path}"
    # Never print binary payloads — they crash stdout on Azure App Service
    body_preview = f"<binary {content_type}>" if is_binary else body.decode(errors='ignore')[:500]
    _middleware_log = logging.getLogger("api_server.middleware")
    _middleware_log.info("[api_server] %s body=%s", message, body_preview)
    if job_id:
        asyncio.create_task(_log_event_async(job_id, "api_server", message))
    try:
        response = await call_next(request)
        message = f"Response: {request.method} {request.url.path} -> {response.status_code}"
        _middleware_log.info("[api_server] %s", message)
        if job_id:
            asyncio.create_task(_log_event_async(job_id, "api_server", message))
        return response
    except Exception as e:
        message = f"Error handling request {request.method} {request.url.path}: {e}"
        _middleware_log.error("[api_server] %s", message)
        if job_id:
            asyncio.create_task(_log_event_async(job_id, "api_server", message, level="error"))
        # Always return a Response — never re-raise, which would cause Starlette
        # to emit "No response returned" instead of a proper 500.
        return JSONResponse({"detail": "Internal server error"}, status_code=500)


@app.on_event("startup")
async def _log_startup_info():
    try:
        pid = os.getpid()
        print(
            f"[api_server] Startup | PID={pid} | build={RUNTIME_BUILD} | "
            f"ORCHESTRATOR_DIR={ORCHESTRATOR_DIR} | "
            f"INTERNAL_SECRET={'SET' if os.getenv('INTERNAL_API_SECRET') else 'DEFAULT'}"
        )
    except Exception:
        pass

# ── CORS — allow Node.js backend to call this ─────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5000", "http://localhost:8080", "*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Secret key for Node.js → Python auth (set in .env) ───────────────────────
INTERNAL_SECRET = os.getenv("INTERNAL_API_SECRET", "medassist-internal-secret-2024")


# ── Request / Response models ─────────────────────────────────────────────────
class PipelineRequest(BaseModel):
    transcript: str           # Text transcript from frontend recording
    patient_id: str           # MongoDB patient _id
    patient_name: str         # Patient name for notifications
    duration_sec: Optional[float] = None
    job_id: Optional[str] = None  # For correlating logs
    node_log_endpoint: Optional[str] = None


class PipelineResponse(BaseModel):
    success: bool
    soap_data: Optional[dict] = None
    conversation_id: Optional[str] = None
    error: Optional[str] = None
    stage_reached: Optional[str] = None
    duration_sec: Optional[float] = None


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "service": "MedAssist Python Agent Bridge"}


def _transcribe_audio_bytes(audio_bytes: bytes, mime_type: str, language: str = "en-IN") -> dict:
    """
    Transcribe audio using the Azure Speech-to-Text REST API.

    The frontend now sends 16 kHz mono PCM WAV (decoded in-browser from WebM),
    so no server-side format conversion is needed. WAV is Azure's preferred format.
    """
    import requests as _requests

    key    = os.environ["SPEECH_KEY"]
    region = os.environ.get("SPEECH_REGION", "eastus").strip()

    # Always use audio/wav — the browser decodes WebM→WAV before uploading
    ct = "audio/wav"

    url = (
        f"https://{region}.stt.speech.microsoft.com"
        f"/speech/recognition/conversation/cognitiveservices/v1"
        f"?language={language}&format=detailed"
    )

    resp = _requests.post(
        url,
        data=audio_bytes,
        headers={
            "Ocp-Apim-Subscription-Key": key,
            "Content-Type": ct,
        },
        timeout=60,
    )

    _log = logging.getLogger(__name__)
    _log.info("[transcribe] Azure status=%s body=%s", resp.status_code, resp.text[:400])

    if not resp.ok:
        raise RuntimeError(
            f"Azure Speech API returned {resp.status_code}: {resp.text[:400]}"
        )

    body   = resp.json()
    status = body.get("RecognitionStatus", "")
    _log.info("[transcribe] RecognitionStatus=%s", status)

    text = body.get("DisplayText", "").strip() if status == "Success" else ""
    return {"transcript": text, "segments": [text] if text else []}


@app.post("/transcribe-audio")
async def transcribe_audio(
    audio: UploadFile = File(...),
    language: Optional[str] = Form(None),
    x_internal_secret: Optional[str] = Header(None),
):
    if x_internal_secret != INTERNAL_SECRET:
        raise HTTPException(status_code=403, detail="Unauthorized — internal service only")

    if not audio:
        raise HTTPException(status_code=400, detail="Audio file is required")

    audio_bytes = await audio.read()
    # Use the MIME type the browser set; default to webm if unknown
    mime_type = audio.content_type or "audio/webm;codecs=opus"

    result = await asyncio.to_thread(
        _transcribe_audio_bytes, audio_bytes, mime_type, language or "en-IN"
    )

    return JSONResponse(
        content={
            "success": True,
            "transcript": result["transcript"],
            "segments": result["segments"],
            "language": language or "en-IN",
        }
    )


# ── Main pipeline endpoint ────────────────────────────────────────────────────

import requests
from datetime import datetime
import logging

def log_event(job_id, stage, message, level="info", override_url: Optional[str] = None):
    """
    Send a log event to the Node.js backend for real-time UI updates.
    """
    payload = {
        "job_id": job_id,
        "stage": stage,
        "message": message,
        "level": level,
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }
    urls = []
    if override_url:
        urls.append(override_url)
    env_url = os.getenv("NODE_LOG_ENDPOINT")
    if env_url:
        urls.append(env_url)
    urls.extend([
        "http://localhost:8080/api/orchestrator/log",
        "http://localhost:5000/api/orchestrator/log",
    ])
    for backend_url in urls:
        try:
            response = requests.post(backend_url, json=payload, timeout=1)
            if response.ok:
                return
        except Exception:
            continue


async def _log_event_async(job_id, stage, message, level="info", override_url=None):
    """Non-blocking fire-and-forget wrapper — runs log_event in a thread pool
    so synchronous HTTP calls never block the async event loop."""
    try:
        await asyncio.to_thread(log_event, job_id, stage, message, level, override_url)
    except Exception:
        pass


@app.post("/run-pipeline", response_model=PipelineResponse)
async def run_pipeline(
    request: PipelineRequest,
    x_internal_secret: Optional[str] = Header(None),
):
    # ── Auth: only Node.js backend can call this ──────────────────────────────
    if x_internal_secret != INTERNAL_SECRET:
        raise HTTPException(status_code=403, detail="Unauthorized — internal service only")

    if not request.transcript or not request.transcript.strip():
        raise HTTPException(status_code=400, detail="Transcript is required")

    start = time.time()
    job_id = request.job_id or f"job_{int(start)}"

    # Debug: log incoming pipeline trigger to stdout for visibility
    try:
        print(f"[api_server] /run-pipeline called | job_id={job_id} patient_id={request.patient_id} duration={request.duration_sec}")
    except Exception:
        pass

    log_event(job_id, "start", "Pipeline started", override_url=request.node_log_endpoint)

    # Optionally spawn main_agent.py on-demand for this request (useful for
    # capturing agent logs). Enable with SPAWN_MAIN_AGENT_ON_REQUEST=true.
    spawn_flag = os.getenv("SPAWN_MAIN_AGENT_ON_REQUEST", "false").lower()
    agent_proc = None
    agent_task = None
    if spawn_flag in ("1", "true", "yes"):
        main_py = ORCHESTRATOR_DIR / "main_agent.py"
        if main_py.exists():
            try:
                # Pass job_id as an env var so the subprocess can include it in logs
                env = {**os.environ, "INCOMING_JOB_ID": str(job_id)}
                agent_proc = await asyncio.create_subprocess_exec(
                    sys.executable, str(main_py),
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.STDOUT,
                    cwd=str(ORCHESTRATOR_DIR),
                    env=env,
                )
                agent_task = asyncio.create_task(_stream_process(agent_proc, job_id))
                message = f"Spawned main_agent.py for job {job_id} (pid={agent_proc.pid})"
                print(f"[api_server] {message}")
                log_event(job_id, "api_server", message, override_url=request.node_log_endpoint)
            except Exception as e:
                message = f"Failed to spawn main_agent.py: {e}"
                print(f"[api_server] {message}")
                log_event(job_id, "api_server", message, level="error", override_url=request.node_log_endpoint)

    try:
        # ── Step 1: Build conversation JSON from transcript ───────────────────
        log_event(job_id, "conversational", "Building conversation JSON from transcript", override_url=request.node_log_endpoint)
        conv_output = _build_conv_output_from_transcript(
            transcript=request.transcript,
            patient_id=request.patient_id,
        )

        # ── Step 2: Run Summarizer Agent ──────────────────────────────────────
        log_event(job_id, "summarizer", "Running Summarizer Agent", override_url=request.node_log_endpoint)
        from tools.summ_tool import run_summarizer_agent
        summary = await run_summarizer_agent(conv_output)
        log_event(job_id, "summarizer", "Summarizer Agent complete", override_url=request.node_log_endpoint)

        # Stamp patient_id onto summary so publishing agent has it directly.
        # This is the authoritative MongoDB _id from the incoming request.
        summary["patient_id"] = request.patient_id
        summary["patientId"]  = request.patient_id

        # ── Step 3: Run Publishing Agent ──────────────────────────────────────
        log_event(job_id, "publishing", "Running Publishing Agent", override_url=request.node_log_endpoint)
        from tools.pub_tool import run_publishing_agent
        soap_result = await run_publishing_agent(summary, conv_output)
        # Ensure the final SOAP record preserves authoritative summary metadata.
        try:
            orig_pid = request.patient_id
            soap_rec = soap_result.get("soap_record") or {}
            soap_rec["patient_id"] = orig_pid
            soap_rec["patientId"] = orig_pid

            icd = summary.get("icd10_code") or summary.get("icd10Code")
            if icd:
                soap_rec["icd10_code"] = icd
                soap_rec["icd10Code"] = icd

            possible_condition = summary.get("possible_condition") or summary.get("possibleCondition")
            if possible_condition:
                soap_rec["possible_condition"] = possible_condition
                soap_rec["possibleCondition"] = possible_condition

            assessment = str(soap_rec.get("assessment") or "").strip()
            if possible_condition and icd and (
                not assessment
                or assessment.endswith("related to")
                or "reference code:" not in assessment
            ):
                soap_rec["assessment"] = (
                    "Symptoms and context suggest a possible clinical picture related to "
                    f"{possible_condition} (reference code: {icd}) without confirming a diagnosis."
                )

            soap_result["soap_record"] = soap_rec
        except Exception:
            pass
        log_event(job_id, "publishing", "Publishing Agent complete", override_url=request.node_log_endpoint)

        duration = round(time.time() - start, 2)
        log_event(job_id, "complete", f"Pipeline complete in {duration}s", override_url=request.node_log_endpoint)

        resp = {
            "success": True,
            "build": RUNTIME_BUILD,
            "soap_data": soap_result,
            "summary": summary,
            "conversation_id": conv_output.get("conversation_id"),
            "stage_reached": "complete",
            "duration_sec": duration,
        }

        # Final safeguard: ensure response SOAP patient id matches incoming request
        try:
            if resp.get("soap_data") and isinstance(resp["soap_data"], dict):
                s = resp["soap_data"].get("soap_record") or {}
                current = s.get("patientId") or s.get("patient_id")
                if current != request.patient_id:
                    print(f"[api_server] Overriding SOAP patient id: {current} -> {request.patient_id}")
                s["patientId"] = request.patient_id
                s["patient_id"] = request.patient_id
                icd = summary.get("icd10_code") or summary.get("icd10Code")
                if icd:
                    s["icd10Code"] = icd
                    s["icd10_code"] = icd
                possible_condition = summary.get("possible_condition") or summary.get("possibleCondition")
                if possible_condition:
                    s["possibleCondition"] = possible_condition
                    s["possible_condition"] = possible_condition
                resp["soap_data"]["soap_record"] = s
        except Exception:
            pass
        try:
            message = f"Returning response for job {job_id}: {json.dumps(resp)[:1000]}"
            print(f"[api_server] {message}")
            log_event(job_id, "api_server", message, override_url=request.node_log_endpoint)
        except Exception:
            pass

        # Clean up spawned agent subprocess (if any)
        try:
            if agent_task:
                agent_task.cancel()
                await asyncio.wait_for(asyncio.shield(agent_task), timeout=3)
        except Exception:
            pass
        try:
            if agent_proc:
                agent_proc.terminate()
                try:
                    await asyncio.wait_for(agent_proc.wait(), timeout=5)
                except asyncio.TimeoutError:
                    agent_proc.kill()
        except Exception:
            pass

        return JSONResponse(content=resp)

    except Exception as e:
        duration = round(time.time() - start, 2)
        log_event(job_id, "error", f"Pipeline error: {e}", level="error", override_url=request.node_log_endpoint)
        tb = traceback.format_exc()
        # Clean up spawned agent subprocess (if any)
        try:
            if agent_task:
                agent_task.cancel()
                await asyncio.wait_for(asyncio.shield(agent_task), timeout=3)
        except Exception:
            pass
        try:
            if agent_proc:
                agent_proc.terminate()
                try:
                    await asyncio.wait_for(agent_proc.wait(), timeout=5)
                except asyncio.TimeoutError:
                    agent_proc.kill()
        except Exception:
            pass
        resp = {
            "success": False,
            "error": str(e),
            "traceback": tb,
            "build": RUNTIME_BUILD,
            "stage_reached": "error",
            "duration_sec": duration,
        }
        try:
            print(f"[api_server] Traceback for job {job_id}:\n{tb}")
            message = f"Returning error response for job {job_id}: {resp}"
            print(f"[api_server] {message}")
            log_event(job_id, "api_server", message, level="error", override_url=request.node_log_endpoint)
        except Exception:
            pass
        return JSONResponse(content=resp, status_code=500)


# ── Helper: convert plain transcript → conv_output format ────────────────────
def _build_conv_output_from_transcript(transcript: str, patient_id: str) -> dict:
    """
    Conversational agent normally records from mic and returns diarized JSON.
    Since frontend already recorded and sent transcript text,
    we format it into the same structure the summarizer agent expects.
    """
    lines = transcript.strip().split("\n")
    utterances = []

    for i, line in enumerate(lines):
        line = line.strip()
        if not line:
            continue

        # Try to detect speaker from format "Doctor: ..." or "Patient: ..."
        if line.lower().startswith("doctor:"):
            role = "doctor"
            text = line[7:].strip()
        elif line.lower().startswith("patient:"):
            role = "patient"
            text = line[8:].strip()
        else:
            # Alternate speaker assignment if no label
            role = "patient" if i % 2 == 0 else "doctor"
            text = line

        utterances.append({
            "speaker": role,
            "text": text,
            "timestamp": i * 2.0,  # fake timestamps
        })

    return {
        "conversation_id": f"conv_{int(time.time())}",  # correlation ID only — no patient_id embedded
        "patient_id": patient_id,   # snake_case for summarizer
        "patientId":   patient_id,   # camelCase for publisher/SOAP schema
        "utterances": utterances,
        "full_transcript": transcript,
        "duration_sec": len(utterances) * 2.0,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api_server:app", host="0.0.0.0", port=8001, reload=True)


# Note: main_agent subprocess is NOT started at FastAPI startup to avoid
# unintended recordings or background agent loops. If desired, the agent
# can be spawned on-demand per incoming `/run-pipeline` request by setting
# the environment variable `SPAWN_MAIN_AGENT_ON_REQUEST=true`.


async def _stream_process(proc, job_id=None):
    try:
        while True:
            line = await proc.stdout.readline()
            if not line:
                break
            try:
                message = line.decode().rstrip()
                print(f"[main_agent] {message}")
                if job_id:
                    log_event(job_id, "main_agent", message)
            except Exception:
                message = str(line)
                print(f"[main_agent] {message}")
                if job_id:
                    log_event(job_id, "main_agent", message)
    except asyncio.CancelledError:
        return
