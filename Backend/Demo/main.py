# import asyncio
# import importlib.util
# import json
# import os
# import signal
# import sys
# import threading
# import time
# from pathlib import Path

# from dotenv import load_dotenv

# load_dotenv(dotenv_path=Path(__file__).parent / ".env")

# BASE_DIR = Path(__file__).parent
# CONV_DIR = BASE_DIR / "conversational_agent"
# SUMM_DIR = BASE_DIR / "summarizer_agent"
# PUB_DIR  = BASE_DIR / "Publishing_Agent"

# def _import_from_path(module_name: str, file_path: Path):
#     spec = importlib.util.spec_from_file_location(module_name, str(file_path))
#     mod  = importlib.util.module_from_spec(spec)
#     sys.modules[module_name] = mod
#     spec.loader.exec_module(mod)
#     return mod

# _stop_event = threading.Event()

# def _sigint_handler(sig, frame):
#     print("\n🛑 Ctrl+C - stopping recording...")
#     _stop_event.set()
#     signal.signal(signal.SIGINT, signal.SIG_DFL)


# # =============================================================================
# # STEP 1 - CONVERSATIONAL AGENT
# # =============================================================================
# async def run_conversational_agent() -> dict:
#     print("\n" + "=" * 60)
#     print("STEP 1 - Conversational Agent")
#     print("=" * 60)

#     mod = _import_from_path(
#         "conversation_agent",
#         CONV_DIR / "agent" / "conversation_agent.py"
#     )
#     ConversationAgent = mod.ConversationAgent

#     agent = ConversationAgent(stop_event=_stop_event)
#     final_output = await agent.process()

#     if not final_output:
#         raise RuntimeError("Conversational agent returned no output.")

#     out_path = CONV_DIR / "final_output.json"
#     out_path.write_text(
#         json.dumps(final_output, indent=2, ensure_ascii=False),
#         encoding="utf-8"
#     )
#     print(f"✅ Conversational agent done - saved to {out_path}")
#     return final_output


# # =============================================================================
# # STEP 2 - SUMMARIZER AGENT
# # =============================================================================
# async def run_summarizer_agent(conv_output: dict) -> dict:
#     print("\n" + "=" * 60)
#     print("STEP 2 - Summarizer Agent")
#     print("=" * 60)

#     from mcp import ClientSession, StdioServerParameters
#     from mcp.client.stdio import stdio_client

#     server_path = str(SUMM_DIR / "mcp_server" / "mcp_tools_server.py")

#     params = StdioServerParameters(
#         command=sys.executable,
#         args=["-u", server_path],
#         env={**os.environ},
#     )

#     transcript_input = json.dumps({"transcript": conv_output})

#     print("🧠 Running clinical_summary_pipeline via MCP...")

#     async with stdio_client(params) as (read, write):
#         async with ClientSession(read, write) as session:
#             await session.initialize()

#             result = await session.call_tool(
#                 "clinical_summary_pipeline",
#                 {"transcript": transcript_input}
#             )

#             summary = _extract_mcp_payload(result)

#     if not summary:
#         raise RuntimeError("Summarizer agent returned no output.")

#     print("✅ Summarizer agent done:")
#     print(json.dumps(summary, indent=2))
#     return summary


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


# # =============================================================================
# # STEP 3 - PUBLISHING AGENT
# # =============================================================================
# async def run_publishing_agent(summary: dict, conv_output: dict) -> dict:
#     print("\n" + "=" * 60)
#     print("STEP 3 - Publishing Agent")
#     print("=" * 60)

#     from mcp import ClientSession, StdioServerParameters
#     from mcp.client.stdio import stdio_client

#     server_path = str(PUB_DIR / "mcp_server" / "mcp_tools_server.py")

#     env = {**os.environ, "PYTHONPATH": str(PUB_DIR)}

#     params = StdioServerParameters(
#         command=sys.executable,
#         args=["-u", server_path],
#         env=env,
#     )

#     payload = {**summary}
#     payload.setdefault("patient_id", conv_output.get("conversation_id", "UNKNOWN"))

#     async with stdio_client(params) as (read, write):
#         async with ClientSession(read, write) as session:
#             await session.initialize()

#             # 1. Guardrails
#             print("🛡  Running guardrails check...")
#             guard_result = await session.call_tool(
#                 "guardrails_check_tool",
#                 {"input_text": json.dumps(payload)}
#             )
#             guard = json.loads(guard_result.content[0].text)
#             print(f"   Guardrails: {guard['status']} - {guard.get('reason', '')}")

#             if guard["status"] != "safe":
#                 raise RuntimeError(f"Guardrails blocked: {guard.get('reason')}")

#             # 2. Build SOAP
#             print("📋 Building SOAP record...")
#             soap_result = await session.call_tool(
#                 "build_demo_soap_tool",
#                 {"payload_json": json.dumps(payload)}
#             )
#             soap_record = json.loads(soap_result.content[0].text)

#             # 3. Validate
#             print("✔  Validating SOAP output...")
#             val_result = await session.call_tool(
#                 "validate_soap_output_tool",
#                 {"output_text": json.dumps(soap_record)}
#             )
#             validation = json.loads(val_result.content[0].text)
#             print(f"   Validation: {validation['status']} - {validation.get('reason', '')}")

#             if validation["status"] != "valid":
#                 raise RuntimeError(f"SOAP validation failed: {validation.get('reason')}")

#             # 4. Publish
#             print("🚀 Publishing SOAP record...")
#             pub_result = await session.call_tool(
#                 "publish_soap_record_tool",
#                 {"soap_json": json.dumps(soap_record)}
#             )
#             publish_outcome = json.loads(pub_result.content[0].text)

#     print(f"✅ Publishing agent done - {publish_outcome}")
#     return {"soap_record": soap_record, "publish_result": publish_outcome}


# # =============================================================================
# # MAIN
# # =============================================================================
# async def main():

#     pipeline_start = time.time()

#     conv_output = await run_conversational_agent()
#     summary     = await run_summarizer_agent(conv_output)
#     result      = await run_publishing_agent(summary, conv_output)

#     total_time = round(time.time() - pipeline_start, 2)

#     print("\n" + "=" * 60)
#     print("PIPELINE COMPLETE")
#     print("=" * 60)
#     print(f"⏱  Total time  : {total_time}s")
#     print(f"📄 SOAP record : {result['publish_result'].get('path', 'N/A')}")
#     print(f"🆔 Record ID   : {result['soap_record'].get('record_id', 'N/A')}")
#     print("=" * 60)
#     print("\nFinal SOAP record:")
#     print(json.dumps(result["soap_record"], indent=2, ensure_ascii=False))


# if __name__ == "__main__":
#     signal.signal(signal.SIGINT, _sigint_handler)
#     try:
#         asyncio.run(main())
#     except KeyboardInterrupt:
#         print("\n👋 Force stopped.")
#     except Exception as e:
#         print(f"\n❌ Pipeline error: {e}")
#         raise




"""
MedAssist Orchestrator — single entry point for the full pipeline.

Flow:
    1. ConversationAgent  — mic -> diarize -> classify -> merge -> final_output.json
    2. SummarizerAgent    — final_output.json -> clinical summary dict
    3. PublishingAgent    — clinical summary -> SOAP record -> published_records/

Run:  python main.py
Stop recording:  Ctrl+C (once)

Place this file at Backend/main.py (next to the three agent folders).
"""

import asyncio
import importlib.util
import json
import os
import signal
import sys
import threading
import time
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).parent / ".env")

import logger  # shared logger (logger.py in same folder)

BASE_DIR = Path(__file__).parent
CONV_DIR = BASE_DIR / "conversational_agent"
SUMM_DIR = BASE_DIR / "summarizer_agent"
PUB_DIR  = BASE_DIR / "Publishing_Agent"

# ── Retry config ──────────────────────────────────────────────────────────────
MAX_ATTEMPTS  = 3
BACKOFF_BASE  = 2   # seconds — doubles each attempt: 2s, 4s, 8s


def _import_from_path(module_name: str, file_path: Path):
    spec = importlib.util.spec_from_file_location(module_name, str(file_path))
    mod  = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = mod
    spec.loader.exec_module(mod)
    return mod


_stop_event = threading.Event()


def _sigint_handler(sig, frame):
    print("\n🛑 Ctrl+C - stopping recording...")
    _stop_event.set()
    signal.signal(signal.SIGINT, signal.SIG_DFL)


# ── Retry wrapper ─────────────────────────────────────────────────────────────
async def _with_retry(step_num: int, tool_name: str, coro_fn, *args, **kwargs):
    """
    Calls coro_fn(*args, **kwargs) up to MAX_ATTEMPTS times.
    Exponential backoff: 2s, 4s, 8s between attempts.
    Raises the last exception if all attempts fail.
    """
    last_err = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            logger.step(step_num, f"{tool_name} → attempt {attempt}/{MAX_ATTEMPTS}")
            result = await coro_fn(*args, **kwargs)
            if attempt > 1:
                logger.retry_success(step_num, tool_name, attempt)
            return result
        except Exception as e:
            last_err = e
            if attempt < MAX_ATTEMPTS:
                wait = BACKOFF_BASE ** attempt
                logger.retry_attempt(step_num, tool_name, attempt, MAX_ATTEMPTS, str(e))
                logger.step(step_num, f"Retrying in {wait}s...")
                await asyncio.sleep(wait)
            else:
                logger.retry_exhausted(step_num, tool_name, str(e))
    raise last_err


# ── Partial output save ───────────────────────────────────────────────────────
def _save_partial(data: dict, label: str):
    out_path = BASE_DIR / "pipeline_partial_output.json"
    payload = {
        "saved_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "last_successful_step": label,
        "data": data
    }
    out_path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False),
        encoding="utf-8"
    )
    logger.pipeline(f"Partial output saved → {out_path}")


# =============================================================================
# STEP 1 - CONVERSATIONAL AGENT
# =============================================================================
async def run_conversational_agent() -> dict:
    logger.step(1, "Conversational Agent started")

    print("\n" + "=" * 60)
    print("STEP 1 - Conversational Agent")
    print("=" * 60)

    mod = _import_from_path(
        "conversation_agent",
        CONV_DIR / "agent" / "conversation_agent.py"
    )
    ConversationAgent = mod.ConversationAgent

    agent = ConversationAgent(stop_event=_stop_event)

    t_start = time.time()
    final_output = await agent.process()
    elapsed = round(time.time() - t_start, 2)

    if not final_output:
        raise RuntimeError("Conversational agent returned no output.")

    # ── Metadata log ──────────────────────────────────────────────────────────
    utterances  = final_output.get("utterances", [])
    speaker_ids = list({u["speaker_id"] for u in utterances})
    conv_id     = final_output.get("conversation_id", "N/A")
    start_t     = final_output.get("conversation_time", {}).get("start_time", "N/A")
    end_t       = final_output.get("conversation_time", {}).get("end_time", "N/A")

    logger.step(1, (
        f"Diarization complete | "
        f"conversation_id: {conv_id} | "
        f"utterances: {len(utterances)} | "
        f"speakers: {speaker_ids} | "
        f"start: {start_t} | end: {end_t}"
    ))
    logger.step(1, f"MCP classify+merge complete | SLA: {elapsed}s")
    logger.step(1, "Done")

    out_path = CONV_DIR / "final_output.json"
    out_path.write_text(
        json.dumps(final_output, indent=2, ensure_ascii=False),
        encoding="utf-8"
    )
    print(f"✅ Conversational agent done - saved to {out_path}")
    return final_output


# =============================================================================
# STEP 2 - SUMMARIZER AGENT
# =============================================================================
async def run_summarizer_agent(conv_output: dict) -> dict:
    logger.step(2, "Summarizer Agent started")

    print("\n" + "=" * 60)
    print("STEP 2 - Summarizer Agent")
    print("=" * 60)

    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client

    server_path = str(SUMM_DIR / "mcp_server" / "mcp_tools_server.py")

    params = StdioServerParameters(
        command=sys.executable,
        args=["-u", server_path],
        env={**os.environ},
    )

    transcript_input = json.dumps({"transcript": conv_output})

    print("🧠 Running clinical_summary_pipeline via MCP...")

    # ── Inline call wrapped in retry ──────────────────────────────────────────
    async def _call_summarizer():
        async with stdio_client(params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                result = await session.call_tool(
                    "clinical_summary_pipeline",
                    {"transcript": transcript_input}
                )
                return _extract_mcp_payload(result)

    t_start = time.time()
    summary = await _with_retry(2, "clinical_summary_pipeline", _call_summarizer)
    elapsed = round(time.time() - t_start, 2)

    if not summary:
        raise RuntimeError("Summarizer agent returned no output.")

    # ── Fallback for no symptoms ──────────────────────────────────────────────
    symptoms_found = summary.get("symptoms", [])
    if not symptoms_found:
        logger.warn(2, "No symptoms detected — using fallback payload for publishing")
        summary = {
            "symptoms": ["unspecified"],
            "possible_condition": summary.get("possible_condition", "Doctor Review Required"),
            "icd10_code": "Z71.1",
            "action_plan": summary.get("action_plan", ["Consult doctor for further evaluation"]),
            "clinical_summary": summary.get("clinical_summary",
                "Symptoms could not be identified confidently from the transcript.")
        }

    # ── Metadata log ──────────────────────────────────────────────────────────
    logger.step(2, (
        f"Summary complete | "
        f"symptoms: {len(summary['symptoms'])} ({', '.join(summary['symptoms'][:3])}) | "
        f"condition: {summary.get('possible_condition', 'N/A')} | "
        f"ICD10: {summary.get('icd10_code', 'N/A')} | "
        f"SLA: {elapsed}s"
    ))
    logger.step(2, "Done")

    print("✅ Summarizer agent done:")
    print(json.dumps(summary, indent=2))
    return summary


def _extract_mcp_payload(result):
    if hasattr(result, "content") and result.content:
        first = result.content[0]
        if hasattr(first, "text") and first.text:
            try:
                return json.loads(first.text)
            except Exception:
                return first.text
        if isinstance(first, dict):
            return first
    return None


# =============================================================================
# STEP 3 - PUBLISHING AGENT
# =============================================================================
async def run_publishing_agent(summary: dict, conv_output: dict) -> dict:
    logger.step(3, "Publishing Agent started")

    print("\n" + "=" * 60)
    print("STEP 3 - Publishing Agent")
    print("=" * 60)

    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client

    server_path = str(PUB_DIR / "mcp_server" / "mcp_tools_server.py")

    # Wrapper to silence "MCP server running..." stdout pollution
    wrapper_path = BASE_DIR / "_pub_server_wrapper.py"
    wrapper_path.write_text(
        f"""
import sys, os
sys.path.insert(0, r"{str(PUB_DIR)}")
_real_stdout = sys.stdout
sys.stdout = sys.stderr
import importlib.util
spec = importlib.util.spec_from_file_location("mcp_tools_server", r"{server_path}")
mod  = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
sys.stdout = _real_stdout
mod.mcp.run()
""",
        encoding="utf-8"
    )

    env = {**os.environ, "PYTHONPATH": str(PUB_DIR)}

    params = StdioServerParameters(
        command=sys.executable,
        args=["-u", str(wrapper_path)],
        env=env,
    )

    payload = {**summary}
    payload.setdefault("patient_id", conv_output.get("conversation_id", "UNKNOWN"))

    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            logger.step(3, "MCP server connected")

            # ── Guardrails ────────────────────────────────────────────────────
            async def _guardrails():
                r = await session.call_tool(
                    "guardrails_check_tool",
                    {"input_text": json.dumps(payload)}
                )
                return json.loads(r.content[0].text)

            print("🛡  Running guardrails check...")
            guard = await _with_retry(3, "guardrails_check_tool", _guardrails)
            logger.step(3, f"Guardrails: {guard['status']} | reason: {guard.get('reason', '')}")
            print(f"   Guardrails: {guard['status']} - {guard.get('reason', '')}")

            if guard["status"] != "safe":
                raise RuntimeError(f"Guardrails blocked: {guard.get('reason')}")

            # ── Build SOAP ────────────────────────────────────────────────────
            async def _build_soap():
                r = await session.call_tool(
                    "build_demo_soap_tool",
                    {"payload_json": json.dumps(payload)}
                )
                return json.loads(r.content[0].text)

            print("📋 Building SOAP record...")
            soap_record = await _with_retry(3, "build_demo_soap_tool", _build_soap)
            logger.step(3, (
                f"SOAP built | "
                f"record_id: {soap_record.get('record_id', 'N/A')} | "
                f"confidence: {soap_record.get('confidence_score', 'N/A')} | "
                f"approval_status: {soap_record.get('approval_status', 'N/A')}"
            ))

            # ── Validate ──────────────────────────────────────────────────────
            async def _validate():
                r = await session.call_tool(
                    "validate_soap_output_tool",
                    {"output_text": json.dumps(soap_record)}
                )
                return json.loads(r.content[0].text)

            print("✔  Validating SOAP output...")
            validation = await _with_retry(3, "validate_soap_output_tool", _validate)
            logger.step(3, f"Validation: {validation['status']} | reason: {validation.get('reason', '')}")
            print(f"   Validation: {validation['status']} - {validation.get('reason', '')}")

            if validation["status"] != "valid":
                raise RuntimeError(f"SOAP validation failed: {validation.get('reason')}")

            # ── Publish ───────────────────────────────────────────────────────
            async def _publish():
                r = await session.call_tool(
                    "publish_soap_record_tool",
                    {"soap_json": json.dumps(soap_record)}
                )
                return json.loads(r.content[0].text)

            print("🚀 Publishing SOAP record...")
            publish_outcome = await _with_retry(3, "publish_soap_record_tool", _publish)
            logger.step(3, (
                f"Published | "
                f"file: {publish_outcome.get('filename', 'N/A')} | "
                f"timestamp: {publish_outcome.get('timestamp', 'N/A')}"
            ))
            logger.step(3, "Done")

    wrapper_path.unlink(missing_ok=True)

    print(f"✅ Publishing agent done - {publish_outcome}")
    return {"soap_record": soap_record, "publish_result": publish_outcome}


# =============================================================================
# MAIN
# =============================================================================
async def main():

    pipeline_start = time.time()
    logger.pipeline(f"Pipeline started | pid: {os.getpid()}")

    partial = {}   # accumulates successful step outputs for partial save

    # ── Step 1 ────────────────────────────────────────────────────────────────
    try:
        conv_output = await run_conversational_agent()
        partial["conversational_agent"] = {
            "conversation_id": conv_output.get("conversation_id"),
            "utterance_count": len(conv_output.get("utterances", [])),
            "speakers":        list({u["speaker_id"] for u in conv_output.get("utterances", [])})
        }
    except Exception as e:
        logger.error(1, f"Conversational agent failed — {e}")
        _save_partial(partial, "none — failed at step 1")
        logger.pipeline("Pipeline stopped at step 1")
        return

    # ── Step 2 ────────────────────────────────────────────────────────────────
    try:
        summary = await run_summarizer_agent(conv_output)
        partial["summarizer_agent"] = {
            "symptom_count":      len(summary.get("symptoms", [])),
            "symptoms":           summary.get("symptoms", [])[:5],
            "possible_condition": summary.get("possible_condition"),
            "icd10_code":         summary.get("icd10_code")
        }
    except Exception as e:
        logger.error(2, f"Summarizer agent failed — {e}")
        _save_partial(partial, "step 1 — failed at step 2")
        logger.pipeline("Pipeline stopped at step 2")
        return

    # ── Step 3 ────────────────────────────────────────────────────────────────
    try:
        result = await run_publishing_agent(summary, conv_output)
        partial["publishing_agent"] = {
            "record_id":    result["soap_record"].get("record_id"),
            "confidence":   result["soap_record"].get("confidence_score"),
            "status":       result["publish_result"].get("status"),
            "saved_to":     result["publish_result"].get("path")
        }
    except Exception as e:
        logger.error(3, f"Publishing agent failed — {e}")
        _save_partial(partial, "step 2 — failed at step 3")
        logger.pipeline("Pipeline stopped at step 3")
        return

    # ── Success ───────────────────────────────────────────────────────────────
    total_time = round(time.time() - pipeline_start, 2)

    logger.pipeline(f"Pipeline complete | total_time: {total_time}s")
    logger.pipeline(f"SOAP record: {result['publish_result'].get('path', 'N/A')}")
    logger.pipeline(f"Record ID:   {result['soap_record'].get('record_id', 'N/A')}")

    print("\n" + "=" * 60)
    print("PIPELINE COMPLETE")
    print("=" * 60)
    print(f"⏱  Total time  : {total_time}s")
    print(f"📄 SOAP record : {result['publish_result'].get('path', 'N/A')}")
    print(f"🆔 Record ID   : {result['soap_record'].get('record_id', 'N/A')}")
    print("=" * 60)
    print("\nFinal SOAP record:")
    print(json.dumps(result["soap_record"], indent=2, ensure_ascii=False))


if __name__ == "__main__":
    signal.signal(signal.SIGINT, _sigint_handler)
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n👋 Force stopped.")
    except Exception as e:
        logger.pipeline(f"Unhandled error — {e}")
        print(f"\n❌ Pipeline error: {e}")
        raise
