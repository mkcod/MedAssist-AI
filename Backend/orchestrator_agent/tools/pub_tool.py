# """
# Tool 3 — Publishing Agent
# Wraps guardrails + SOAP build + validate + publish into a single async callable.
# Called by the orchestration agent after summarizer finishes.
# """

# import json
# import os
# import sys
# from pathlib import Path

# BASE_DIR = Path(__file__).parent.parent
# PUB_DIR  = BASE_DIR.parent / "Publishing_Agent"


# async def run_publishing_agent(summary: dict, conv_output: dict) -> dict:
#     """
#     Takes clinical summary dict, runs guardrails, builds SOAP record,
#     validates and publishes it. Returns the final SOAP record + publish result.
#     """
#     from mcp import ClientSession, StdioServerParameters
#     from mcp.client.stdio import stdio_client

#     server_path = str(PUB_DIR / "mcp_server" / "mcp_tools_server.py")

#     # Wrapper to silence stdout pollution from "MCP server running..." print
#     wrapper_path = BASE_DIR / "_pub_wrapper.py"
#     wrapper_path.write_text(
#         f"""
# import sys, os
# sys.path.insert(0, r"{str(PUB_DIR)}")
# _real_stdout = sys.stdout
# sys.stdout = sys.stderr
# import importlib.util
# spec = importlib.util.spec_from_file_location("mcp_tools_server", r"{server_path}")
# mod  = importlib.util.module_from_spec(spec)
# spec.loader.exec_module(mod)
# sys.stdout = _real_stdout
# mod.mcp.run()
# """,
#         encoding="utf-8"
#     )

#     env    = {**os.environ, "PYTHONPATH": str(PUB_DIR)}
#     params = StdioServerParameters(
#         command=sys.executable,
#         args=["-u", str(wrapper_path)],
#         env=env,
#     )

#     payload = {**summary}
#     payload.setdefault("patient_id", conv_output.get("conversation_id", "UNKNOWN"))

#     try:
#         async with stdio_client(params) as (read, write):
#             async with ClientSession(read, write) as session:
#                 await session.initialize()

#                 # Guardrails
#                 g = await session.call_tool(
#                     "guardrails_check_tool",
#                     {"input_text": json.dumps(payload)}
#                 )
#                 guard = json.loads(g.content[0].text)
#                 if guard["status"] != "safe":
#                     raise RuntimeError(f"Guardrails blocked: {guard.get('reason')}")

#                 # Build SOAP
#                 s = await session.call_tool(
#                     "build_demo_soap_tool",
#                     {"payload_json": json.dumps(payload)}
#                 )
#                 soap_record = json.loads(s.content[0].text)

#                 # Validate
#                 v = await session.call_tool(
#                     "validate_soap_output_tool",
#                     {"output_text": json.dumps(soap_record)}
#                 )
#                 validation = json.loads(v.content[0].text)
#                 if validation["status"] != "valid":
#                     raise RuntimeError(f"SOAP validation failed: {validation.get('reason')}")

#                 # Publish
#                 p = await session.call_tool(
#                     "publish_soap_record_tool",
#                     {"soap_json": json.dumps(soap_record)}
#                 )
#                 publish_outcome = json.loads(p.content[0].text)

#     finally:
#         wrapper_path.unlink(missing_ok=True)

#     return {"soap_record": soap_record, "publish_result": publish_outcome}

"""
Tool 3 — Publishing Agent (updated)
The publishing MCP server's stdout pollution print is now commented out
in the new version so no wrapper script needed anymore.
"""

import json
import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
# Resolve PUB_DIR in priority order:
#  1. Explicit env-var override  (PUBLISHING_AGENT_DIR)
#  2. Co-deployed subdirectory   (BASE_DIR/Publishing_Agent — Azure CI layout)
#  3. Local sibling-folder       (BASE_DIR/../Publishing_Agent — dev checkout)
_pub_dir_env = os.environ.get("PUBLISHING_AGENT_DIR", "").strip()
if _pub_dir_env:
    PUB_DIR = Path(_pub_dir_env)
elif (BASE_DIR / "Publishing_Agent").exists():
    PUB_DIR = BASE_DIR / "Publishing_Agent"
else:
    PUB_DIR = BASE_DIR.parent / "Publishing_Agent"

# ── Import cache — populated on first call, reused thereafter ─────────────────
_guardrails_check  = None
_build_demo_soap   = None
_validate_soap_out = None
_EHRStore          = None


def _load_pub_imports(force_reload: bool = False):
    global _guardrails_check, _build_demo_soap, _validate_soap_out, _EHRStore
    if _guardrails_check is not None and not force_reload:
        return

    from dotenv import load_dotenv
    load_dotenv(str(PUB_DIR / ".env"), override=False)

    _ORCH_TOOLS = {k: sys.modules.pop(k)
                   for k in list(sys.modules)
                   if k == "tools" or k.startswith("tools.")}

    pub_dir_str = str(PUB_DIR)
    _path_added = pub_dir_str not in sys.path
    if _path_added:
        sys.path.insert(0, pub_dir_str)

    try:
        from tools.guardrails_tool import guardrails_check
        from tools.soap_tool import build_demo_soap
        from tools.validation_tool import validate_soap_output as validate_soap_out
        from storage.ehr_store import EHRStore
        _guardrails_check  = guardrails_check
        _build_demo_soap   = build_demo_soap
        _validate_soap_out = validate_soap_out
        _EHRStore          = EHRStore
    finally:
        if _path_added:
            sys.path.remove(pub_dir_str)
        sys.modules.update(_ORCH_TOOLS)


_MAX_OUTPUT_FILES = 100


def _prune_output_dir(output_dir: Path) -> None:
    files = sorted(output_dir.glob("*.json"), key=lambda f: f.stat().st_mtime)
    for f in files[:-_MAX_OUTPUT_FILES]:
        try:
            f.unlink()
        except OSError:
            pass


def _build_clinical_context(summary: dict, conv_output: dict) -> str:
    symptoms = [str(symptom).strip() for symptom in summary.get("symptoms", []) if str(symptom).strip()]
    possible_condition = (
        summary.get("possible_condition")
        or summary.get("possibleCondition")
        or conv_output.get("possible_condition")
        or conv_output.get("possibleCondition")
        or ""
    )
    transcript = str(conv_output.get("full_transcript") or "").strip()
    if not transcript:
        transcript = " ".join(
            str(utt.get("text", "")).strip()
            for utt in conv_output.get("utterances", [])
            if str(utt.get("text", "")).strip()
        )

    context_parts = []
    if symptoms:
        context_parts.append(f"Symptoms: {', '.join(symptoms)}")
    if possible_condition:
        context_parts.append(f"Possible condition: {possible_condition}")
    if transcript:
        context_parts.append(f"Transcript: {transcript[:1200]}")

    return " | ".join(context_parts).strip()


async def run_publishing_agent(summary: dict, conv_output: dict) -> dict:
    """
    Calls the publishing agent's tools directly (no subprocess / MCP stdio)
    to avoid asyncio TaskGroup issues when spawning a child MCP server.

    Steps:
      1. guardrails_check   — validates input safety
      2. build_demo_soap    — generates SOAP record
      3. validate_soap      — validates SOAP structure
      4. EHRStore.publish   — saves to Cosmos DB
    """
    # Allow runtime hot-reload during active debugging to avoid stale import cache.
    force_reload = os.getenv("PUBLISHING_FORCE_RELOAD_IMPORTS", "true").lower() in {"1", "true", "yes"}
    _load_pub_imports(force_reload=force_reload)

    payload = {**summary}

    # Resolve patient_id with strict priority — NEVER fall back to conversation_id.
    patient_id = (
        summary.get("patient_id")
        or summary.get("patientId")
        or conv_output.get("patient_id")
        or conv_output.get("patientId")
    )
    if not patient_id:
        raise RuntimeError(
            "patient_id is missing from both summary and conv_output — "
            "cannot build SOAP record without a valid patient identifier."
        )
    payload["patient_id"] = patient_id
    payload["patientId"]  = patient_id

    # Propagate ICD-10 code from summary or conv_output so build/validate/publish
    # receive the clinical code in both snake_case and camelCase forms.
    icd = (
        summary.get("icd10_code")
        or summary.get("icd10Code")
        or conv_output.get("icd10_code")
        or conv_output.get("icd10Code")
    )
    if icd:
        payload["icd10_code"] = icd
        payload["icd10Code"] = icd

    clinical_context = _build_clinical_context(summary, conv_output)
    if clinical_context:
        payload["clinical_context"] = clinical_context

    # 1. Guardrails
    guard = json.loads(_guardrails_check(json.dumps(payload)))
    if not isinstance(guard, dict):
        raise RuntimeError(f"Guardrails returned non-dict payload: {type(guard).__name__}")
    if guard["status"] != "safe":
        raise RuntimeError(f"Guardrails blocked: {guard.get('reason')}")

    # 2. Build SOAP
    soap_record = _build_demo_soap(payload)
    if not isinstance(soap_record, dict):
        raise RuntimeError(f"build_demo_soap returned non-dict payload: {type(soap_record).__name__}")
    record_id = soap_record["record_id"]          # capture before _normalize() renames it

    # Re-stamp after build — build_demo_soap reads payload["patient_id"] correctly,
    # but we pin it here explicitly so _normalize() renames the right value.
    soap_record["patient_id"] = patient_id
    soap_record["patientId"]  = patient_id
    if icd:
        soap_record["icd10_code"] = icd
        soap_record["icd10Code"] = icd

    possible_condition = (
        summary.get("possible_condition")
        or summary.get("possibleCondition")
        or conv_output.get("possible_condition")
        or conv_output.get("possibleCondition")
    )
    if possible_condition:
        soap_record["possibleCondition"] = possible_condition
        soap_record["possible_condition"] = possible_condition

    assessment = str(soap_record.get("assessment") or "").strip()
    if possible_condition and icd and (
        not assessment
        or assessment.endswith("related to")
        or "reference code:" not in assessment
    ):
        soap_record["assessment"] = (
            "Symptoms and context suggest a possible clinical picture related to "
            f"{possible_condition} (reference code: {icd}) without confirming a diagnosis."
        )

    # 3. Validate
    validation = json.loads(_validate_soap_out(json.dumps(soap_record)))
    if not isinstance(validation, dict):
        raise RuntimeError(f"validate_soap_output returned non-dict payload: {type(validation).__name__}")
    if validation["status"] != "valid":
        raise RuntimeError(f"SOAP validation failed: {validation.get('reason')}")

    # 4. Publish  (store.publish mutates soap_record: record_id → recordId etc.)
    store = _EHRStore()
    publish_outcome = store.publish(soap_record, canonical_patient_id=patient_id)
    if not isinstance(publish_outcome, dict):
        raise RuntimeError(f"EHRStore.publish returned non-dict payload: {type(publish_outcome).__name__}")

    # Raise so the retry wrapper retries on any DB failure
    pub_status = publish_outcome.get("status")
    if pub_status == "skipped":
        print(f"[pub_tool] WARNING: record {publish_outcome.get('recordId')} already exists in Cosmos DB — skipped write")
    elif pub_status != "success":
        raise RuntimeError(
            f"DB publish failed: {publish_outcome.get('error', publish_outcome)}"
        )

    # 5. Save final output JSON + prune old files
    output_dir = BASE_DIR / "final_output"
    output_dir.mkdir(exist_ok=True)
    output_path = output_dir / f"{record_id}.json"
    output_path.write_text(
        json.dumps({
            "record_id": record_id,
            "soap_record": soap_record,
            "publish_result": publish_outcome,
        }, indent=2, ensure_ascii=False, default=str),
        encoding="utf-8",
    )
    _prune_output_dir(output_dir)

    return {"soap_record": soap_record, "publish_result": publish_outcome, "record_id": record_id}
