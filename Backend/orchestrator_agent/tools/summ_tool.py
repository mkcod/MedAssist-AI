# """
# Tool 2 — Summarizer Agent
# Wraps the clinical_summary_pipeline MCP call into a single async callable.
# Called by the orchestration agent after conversational agent finishes.
# """

# import json
# import os
# import sys
# from pathlib import Path

# BASE_DIR = Path(__file__).parent.parent
# SUMM_DIR = BASE_DIR.parent / "summarizer_agent"


# def _extract_mcp_payload(result):
#     if hasattr(result, "content") and result.content:
#         first = result.content[0]
#         if hasattr(first, "text") and first.text:
#             try:
#                 return json.loads(first.text)
#             except Exception:
#                 return first.text
#         if isinstance(first, dict):
#             return first
#     return None


# async def run_summarizer_agent(conv_output: dict) -> dict:
#     """
#     Takes annotated conversation JSON, extracts symptoms, ICD-10 code,
#     action plan and clinical summary via MCP.
#     Returns the clinical summary dict.
#     """
#     from mcp import ClientSession, StdioServerParameters
#     from mcp.client.stdio import stdio_client

#     server_path = str(SUMM_DIR / "mcp_server" / "mcp_tools_server.py")

#     params = StdioServerParameters(
#         command=sys.executable,
#         args=["-u", server_path],
#         env={**os.environ},
#     )

#     transcript_input = json.dumps({"transcript": conv_output})

#     async with stdio_client(params) as (read, write):
#         async with ClientSession(read, write) as session:
#             await session.initialize()
#             result = await session.call_tool(
#                 "clinical_summary_pipeline",
#                 {"transcript": transcript_input}
#             )
#             summary = _extract_mcp_payload(result)

#     if not summary:
#         raise RuntimeError("Summarizer agent produced no output.")

#     # Fallback if no symptoms detected
#     if not summary.get("symptoms"):
#         summary = {
#             "symptoms": ["unspecified"],
#             "possible_condition": summary.get("possible_condition", "Doctor Review Required"),
#             "icd10_code": "Z71.1",
#             "action_plan": summary.get("action_plan", ["Consult doctor for further evaluation"]),
#             "clinical_summary": summary.get("clinical_summary",
#                 "Symptoms could not be identified confidently from the transcript.")
#         }

#     return summary

"""
Tool 2 — Summarizer Agent (direct call, no MCP subprocess)
Calls run_rag_pipeline directly to avoid stdio_client hang issues:
  extract_patient_text -> extract_symptoms_llm -> Azure AI Search RAG
  -> choose_condition_with_reasoning -> generate_action_plan_llm
"""

import asyncio
import json
import os
import re
import sys
from pathlib import Path

import logger as log

BASE_DIR = Path(__file__).parent.parent
# Resolve SUMM_DIR in priority order:
#  1. Explicit env-var override  (SUMMARIZER_AGENT_DIR)
#  2. Co-deployed subdirectory   (BASE_DIR/summarizer_agent — Azure CI layout)
#  3. Local sibling-folder       (BASE_DIR/../summarizer_agent — dev checkout)
_summ_dir_env = os.environ.get("SUMMARIZER_AGENT_DIR", "").strip()
if _summ_dir_env:
    SUMM_DIR = Path(_summ_dir_env)
elif (BASE_DIR / "summarizer_agent").exists():
    SUMM_DIR = BASE_DIR / "summarizer_agent"
else:
    SUMM_DIR = BASE_DIR.parent / "summarizer_agent"

FALLBACK_SYMPTOM_ICD10 = [
    (("fever", "feverish", "temperature"), "Fever, unspecified", "R50.9"),
    (("cough", "coughing"), "Cough, unspecified", "R05.9"),
    (("throat irritation", "sore throat", "throat pain"), "Pain in throat", "R07.0"),
    (("breathlessness", "shortness of breath", "dyspnea", "breathing issue"), "Dyspnea, unspecified", "R06.00"),
    (("body pain", "body ache", "aches", "myalgia"), "Myalgia", "M79.1"),
    (("weakness", "fatigue", "tiredness"), "Weakness", "R53.1"),
    (("headache",), "Headache, unspecified", "R51.9"),
    (("chest pain", "chest discomfort"), "Chest pain, unspecified", "R07.9"),
    (("dizziness", "giddiness"), "Dizziness and giddiness", "R42"),
    (("nausea",), "Nausea", "R11.0"),
    (("vomiting",), "Vomiting, unspecified", "R11.10"),
    (("abdominal pain", "stomach pain"), "Unspecified abdominal pain", "R10.9"),
    (("diarrhea", "loose motion", "loose motions"), "Diarrhea, unspecified", "R19.7"),
    (("runny nose", "nasal congestion", "blocked nose"), "Nasal congestion", "R09.81"),
]

RAG_TIMEOUT_SEC = float(os.getenv("RAG_PIPELINE_TIMEOUT_SEC", "35"))
DEFAULT_ACTION_PLAN = [
    "Document symptom details including onset, duration, severity, and triggers.",
    "Monitor symptoms and note any worsening or new associated concerns.",
    "Arrange clinician review if symptoms persist, worsen, or affect daily activity.",
]

def _is_missing_icd10(code) -> bool:
    return str(code or "").strip().lower() in {"", "n/a", "na", "none", "unknown", "not provided"}


def _fallback_icd10_from_symptoms(symptoms):
    haystack = " ".join(str(s).lower() for s in symptoms if str(s).strip())
    for aliases, condition, code in FALLBACK_SYMPTOM_ICD10:
        if any(alias in haystack for alias in aliases):
            return condition, code
    return "Illness, unspecified", "R69"


def _extract_patient_text(conv_output: dict) -> str:
    return " ".join(
        str(utt.get("text", "")).strip()
        for utt in conv_output.get("utterances", [])
        if str(utt.get("text", "")).strip()
    )


def _fallback_symptoms_from_text(text: str):
    normalized = re.sub(r"\s+", " ", str(text).lower()).strip()
    symptoms = []
    for aliases, condition, _code in FALLBACK_SYMPTOM_ICD10:
        if any(alias in normalized for alias in aliases):
            symptoms.append(aliases[0])
    return symptoms or ["unspecified symptom"]


def _fallback_summary(conv_output: dict, reason: str) -> dict:
    text = _extract_patient_text(conv_output)
    symptoms = _fallback_symptoms_from_text(text)
    condition, code = _fallback_icd10_from_symptoms(symptoms)
    summary = {
        "symptoms": symptoms,
        "possible_condition": f"Reference only: {condition}",
        "icd10_code": code,
        "action_plan": DEFAULT_ACTION_PLAN,
        "clinical_summary": (
            f"Patient reports {', '.join(symptoms)}. "
            "Clinical summary generated from symptom-pattern fallback; clinician review is recommended."
        ),
        "diagnosis_status": "fallback_after_rag_timeout",
    }
    log.tool(
        "run_summarizer_agent",
        f"RAG fallback summary used | reason: {reason} | symptoms: {symptoms} | icd10: {code}",
    )
    return summary
def _ensure_icd10(summary: dict) -> dict:
    symptoms = summary.get("symptoms") or []
    if not symptoms or not _is_missing_icd10(summary.get("icd10_code")):
        return summary

    condition, code = _fallback_icd10_from_symptoms(symptoms)
    summary["icd10_code"] = code
    if not summary.get("possible_condition") or "doctor review required" in str(summary.get("possible_condition")).lower():
        summary["possible_condition"] = f"Reference only: {condition}"
    summary["diagnosis_status"] = summary.get("diagnosis_status") or "low_confidence_reference_only"
    log.tool(
        "run_summarizer_agent",
        f"ICD fallback applied | symptoms: {symptoms} | condition: {summary.get('possible_condition')} | icd10: {code}",
    )
    return summary

# Ensure summarizer_agent is on the path so run_rag_pipeline can be imported
if str(SUMM_DIR) not in sys.path:
    sys.path.insert(0, str(SUMM_DIR))

# Load summarizer .env if present so RAG pipeline can find its credentials
_summ_env_path = SUMM_DIR / ".env"
if _summ_env_path.exists():
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=str(_summ_env_path), override=False)


async def run_summarizer_agent(conv_output: dict) -> dict:
    """
    Takes annotated conversation JSON from the conversational agent.
    Runs the full RAG pipeline directly (no MCP subprocess):
      - LLM extracts patient symptoms
      - Azure AI Search retrieves matching ICD-10 conditions
      - LLM reasons over candidates to pick best condition
      - LLM generates action plan
    Returns clinical summary dict.
    """
    from rag_pipeline import run_rag_pipeline

    # Build the transcript payload the RAG pipeline expects
    transcript_payload = json.dumps({
        "transcript": {
            "utterances": conv_output.get("utterances", [])
        }
    })

    log.tool("run_summarizer_agent", "starting RAG pipeline (direct call)")

    # run_rag_pipeline is synchronous — run in a thread so we don't block
    # the async event loop, and apply a generous timeout
    loop = asyncio.get_event_loop()
    try:
        summary = await asyncio.wait_for(
            loop.run_in_executor(None, run_rag_pipeline, transcript_payload),
            timeout=RAG_TIMEOUT_SEC
        )
    except asyncio.TimeoutError:
        summary = _fallback_summary(conv_output, f"timeout after {RAG_TIMEOUT_SEC:.0f}s")
    except Exception as e:
        import traceback as _tb
        log.tool("run_summarizer_agent", f"RAG pipeline exception: {e}\n{_tb.format_exc()}")
        summary = _fallback_summary(conv_output, str(e))

    if not summary:
        raise RuntimeError("Summarizer agent produced no output.")

    summary = _ensure_icd10(summary)

    log.tool("run_summarizer_agent", f"RAG pipeline complete | symptoms: {summary.get('symptoms')} | condition: {summary.get('possible_condition')} | icd10: {summary.get('icd10_code')}")

    symptoms = summary.get("symptoms", [])
    if not symptoms:
        raise RuntimeError(
            "Quality check failed: no symptoms detected in the conversation. "
            "Please ensure the recording captures specific health concerns."
        )

    return summary
