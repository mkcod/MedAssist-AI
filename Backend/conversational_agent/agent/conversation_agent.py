# """
# ConversationAgent — class-based pipeline.

# Methods:
#     run_diarization()        — Azure Speech SDK, sync, blocks until Ctrl+C
#     run_mcp_pipeline()       — async, calls classify_speakers + merge_results via MCP
#     process()                — full pipeline: diarize → classify → merge
# """

# import json
# import os
# import sys
# import time
# import uuid
# import threading
# from datetime import datetime
# from concurrent.futures import ThreadPoolExecutor
# from pathlib import Path

# import azure.cognitiveservices.speech as speechsdk
# from mcp import ClientSession, StdioServerParameters
# from mcp.client.stdio import stdio_client


# class ConversationAgent:

#     def __init__(self, stop_event: threading.Event):
#         """
#         stop_event — threading.Event set by Ctrl+C signal handler in main.py
#                      to stop diarization cleanly.
#         """
#         self.stop_event = stop_event
#         self._base_dir = str(Path(__file__).parent.parent)  # conv_mcp_classes/

#     # ================================================================
#     # 🎤  DIARIZATION  (sync)
#     # ================================================================
#     def run_diarization(self) -> dict:

#         result_json = {
#             "input_type": "speaker_role_inference",
#             "conversation_id": str(uuid.uuid4()),
#             "conversation_time": {"start_time": datetime.now().isoformat()},
#             "conversation_context": {
#                 "domain": "healthcare",
#                 "expected_roles": ["doctor", "patient"]
#             },
#             "utterances": []
#         }
#         counter = 1

#         speech_config = speechsdk.SpeechConfig(
#             subscription=os.environ["SPEECH_KEY"],
#             region=os.environ["SPEECH_REGION"]
#         )
#         audio_config = speechsdk.audio.AudioConfig(use_default_microphone=True)
#         transcriber = speechsdk.transcription.ConversationTranscriber(
#             speech_config=speech_config,
#             audio_config=audio_config
#         )

#         def to_ms(v):
#             return int(v / 10_000)

#         def on_transcribed(evt):
#             nonlocal counter
#             if evt.result.text:
#                 result_json["utterances"].append({
#                     "utterance_id":  counter,
#                     "speaker_id":    evt.result.speaker_id,
#                     "text":          evt.result.text,
#                     "start_time_ms": to_ms(evt.result.offset),
#                     "duration_ms":   to_ms(evt.result.duration)
#                 })
#                 print(f"  🗣  [{evt.result.speaker_id}] {evt.result.text}")
#                 counter += 1

#         def on_session_started(evt):
#             print("🎤 Recording started... press Ctrl+C ONCE to stop\n")

#         transcriber.transcribed.connect(on_transcribed)
#         transcriber.session_started.connect(on_session_started)
#         transcriber.start_transcribing_async()

#         self.stop_event.wait()  # blocks until Ctrl+C

#         print("\n⏹  Stopping transcription...")
#         transcriber.stop_transcribing_async()
#         time.sleep(1)

#         result_json["conversation_time"]["end_time"] = datetime.now().isoformat()
#         print(f"✅ Diarization done — {len(result_json['utterances'])} utterance(s) captured\n")
#         return result_json

#     # ================================================================
#     # 🧠  MCP PIPELINE  (async)
#     # ================================================================
#     async def run_mcp_pipeline(self, diarized: dict) -> dict:

#         print("─" * 50)
#         print("🚀 Starting MCP pipeline...")
#         print("─" * 50)

#         server_params = StdioServerParameters(
#             command=sys.executable,
#             args=[os.path.join(self._base_dir, "server.py")],
#             env={**os.environ},
#         )

#         async with stdio_client(server_params) as (read, write):
#             async with ClientSession(read, write) as session:

#                 await session.initialize()
#                 print("✅ MCP server connected\n")

#                 # ── classify_speakers ─────────────────────────────────────────
#                 print("🧠 Step 2: Classifying speakers via MCP...")
#                 classify_result = await session.call_tool(
#                     "classify_speakers",
#                     arguments={"input_json": diarized}
#                 )
#                 text = classify_result.content[0].text
#                 if not text:
#                     raise ValueError("MCP pipeline returned empty content for classification result.")
#                 try:
#                     annotation = json.loads(text)
#                 except json.JSONDecodeError as e:
#                     raise ValueError(f"Invalid JSON from MCP pipeline: {text}") from e
#                 print("✅ Classification done:")
#                 print(json.dumps(annotation, indent=2))
#                 print()

#                 # ── merge_results ─────────────────────────────────────────────
#                 print("🔗 Step 3: Merging results via MCP...")
#                 merge_result = await session.call_tool(
#                     "merge_results",
#                     arguments={"diarized": diarized, "annotation": annotation}
#                 )
#                 final_output = json.loads(merge_result.content[0].text)
#                 print("✅ Merge done\n")

#                 return final_output

#     # ================================================================
#     # 🚀  FULL PIPELINE
#     # ================================================================
#     async def process(self) -> dict:
#         import asyncio

#         loop = asyncio.get_event_loop()
#         executor = ThreadPoolExecutor(max_workers=1)

#         # Step 1: diarize in thread (keeps event loop free for Ctrl+C)
#         print("⏳ Initialising Azure Speech...")
#         diarized = await loop.run_in_executor(executor, self.run_diarization)

#         if not diarized["utterances"]:
#             print("⚠️  No utterances captured. Exiting.")
#             return {}

#         # Step 2 + 3: MCP classify + merge
#         sla_start = time.time()
#         final_output = await self.run_mcp_pipeline(diarized)
#         sla_end = time.time()

#         print(f"⏱  MCP SLA: {round(sla_end - sla_start, 2)} seconds\n")

#         return final_output


"""
ConversationAgent — class-based pipeline with retry + logging on MCP calls.

Methods:
    run_diarization()    — Azure Speech SDK, sync, blocks until Ctrl+C
    run_mcp_pipeline()   — async, calls classify_speakers + merge_results via MCP
    process()            — full pipeline: diarize -> classify -> merge
"""

import json
import os
import sys
import time
import uuid
import logging
import asyncio
import threading
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import azure.cognitiveservices.speech as speechsdk
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

# ── Retry config ──────────────────────────────────────────────────────────────
MAX_ATTEMPTS = 3
BACKOFF_BASE = 2   # 2s, 4s, 8s

# ── Logger (writes to conv_agent.log + terminal) ──────────────────────────────
_log_path = Path(__file__).parent.parent / "conv_agent.log"

def _build_logger():
    logger = logging.getLogger("medassist.conv_agent")
    if logger.handlers:
        return logger
    logger.setLevel(logging.DEBUG)

    fmt = logging.Formatter(
        fmt="[%(asctime)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )

    ch = logging.StreamHandler(sys.stdout)
    ch.setFormatter(fmt)
    logger.addHandler(ch)

    fh = logging.FileHandler(str(_log_path), encoding="utf-8")
    fh.setFormatter(fmt)
    logger.addHandler(fh)

    return logger

_log = _build_logger()


# ── Retry wrapper ─────────────────────────────────────────────────────────────
async def _with_retry(tool_name: str, coro_fn, *args, **kwargs):
    last_err = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            _log.info(f"[CONV] {tool_name} → attempt {attempt}/{MAX_ATTEMPTS}")
            result = await coro_fn(*args, **kwargs)
            if attempt > 1:
                _log.info(f"[CONV] {tool_name} → succeeded on attempt {attempt}")
            return result
        except Exception as e:
            last_err = e
            if attempt < MAX_ATTEMPTS:
                wait = BACKOFF_BASE ** attempt
                _log.warning(f"[CONV] {tool_name} → attempt {attempt} failed | {e} | retrying in {wait}s")
                await asyncio.sleep(wait)
            else:
                _log.error(f"[CONV] {tool_name} → FAILED after {MAX_ATTEMPTS} attempts | {e}")
    raise last_err


class ConversationAgent:

    def __init__(self, stop_event: threading.Event):
        self.stop_event = stop_event
        self._base_dir  = str(Path(__file__).parent.parent)

    # ================================================================
    # DIARIZATION  (sync)
    # ================================================================
    def run_diarization(self) -> dict:

        result_json = {
            "input_type": "speaker_role_inference",
            "conversation_id": str(uuid.uuid4()),
            "conversation_time": {"start_time": datetime.now().isoformat()},
            "conversation_context": {
                "domain": "healthcare",
                "expected_roles": ["doctor", "patient"]
            },
            "utterances": []
        }
        counter = 1

        speech_config = speechsdk.SpeechConfig(
            subscription=os.environ["SPEECH_KEY"],
            region=os.environ["SPEECH_REGION"]
        )
        audio_config = speechsdk.audio.AudioConfig(use_default_microphone=True)
        transcriber  = speechsdk.transcription.ConversationTranscriber(
            speech_config=speech_config,
            audio_config=audio_config
        )

        def to_ms(v):
            return int(v / 10_000)

        def on_transcribed(evt):
            nonlocal counter
            if evt.result.text:
                result_json["utterances"].append({
                    "utterance_id":  counter,
                    "speaker_id":    evt.result.speaker_id,
                    "text":          evt.result.text,
                    "start_time_ms": to_ms(evt.result.offset),
                    "duration_ms":   to_ms(evt.result.duration)
                })
                print(f"  🗣  [{evt.result.speaker_id}] {evt.result.text}")
                counter += 1

        def on_session_started(evt):
            _log.info(f"[CONV] Diarization session started | conversation_id: {result_json['conversation_id']}")
            print("🎤 Recording started... press Ctrl+C ONCE to stop\n")

        transcriber.transcribed.connect(on_transcribed)
        transcriber.session_started.connect(on_session_started)
        transcriber.start_transcribing_async()

        self.stop_event.wait()

        print("\n⏹  Stopping transcription...")
        transcriber.stop_transcribing_async()
        time.sleep(1)

        result_json["conversation_time"]["end_time"] = datetime.now().isoformat()

        utt_count  = len(result_json["utterances"])
        speaker_ids = list({u["speaker_id"] for u in result_json["utterances"]})
        _log.info(
            f"[CONV] Diarization complete | "
            f"utterances: {utt_count} | "
            f"speakers: {speaker_ids} | "
            f"conversation_id: {result_json['conversation_id']}"
        )
        print(f"✅ Diarization done — {utt_count} utterance(s) captured\n")
        return result_json

    # ================================================================
    # MCP PIPELINE  (async) — with retry on each tool call
    # ================================================================
    async def run_mcp_pipeline(self, diarized: dict) -> dict:

        print("─" * 50)
        print("🚀 Starting MCP pipeline...")
        print("─" * 50)

        server_params = StdioServerParameters(
            command=sys.executable,
            args=[os.path.join(self._base_dir, "server.py")],
            env={**os.environ},
        )

        async with stdio_client(server_params) as (read, write):
            async with ClientSession(read, write) as session:

                await session.initialize()
                _log.info("[CONV] MCP server connected")
                print("✅ MCP server connected\n")

                # ── classify_speakers with retry ──────────────────────────────
                async def _classify():
                    result = await session.call_tool(
                        "classify_speakers",
                        arguments={"input_json": diarized}
                    )
                    return json.loads(result.content[0].text)

                print("🧠 Classifying speakers via MCP...")
                annotation = await _with_retry("classify_speakers", _classify)

                roles = {
                    item["speaker_id"]: item["role"]
                    for item in annotation.get("speaker_roles", [])
                }
                _log.info(f"[CONV] Classification complete | roles: {roles}")
                print("✅ Classification done:")
                print(json.dumps(annotation, indent=2))
                print()

                # ── merge_results with retry ──────────────────────────────────
                async def _merge():
                    result = await session.call_tool(
                        "merge_results",
                        arguments={"diarized": diarized, "annotation": annotation}
                    )
                    return json.loads(result.content[0].text)

                print("🔗 Merging results via MCP...")
                final_output = await _with_retry("merge_results", _merge)

                annotated = sum(
                    1 for u in final_output.get("utterances", [])
                    if u.get("speaker") and u["speaker"] != "unknown"
                )
                _log.info(
                    f"[CONV] Merge complete | "
                    f"utterances annotated: {annotated}/{len(final_output.get('utterances', []))}"
                )
                print("✅ Merge done\n")

                return final_output

    # ================================================================
    # FULL PIPELINE
    # ================================================================
    async def process(self) -> dict:

        loop     = asyncio.get_event_loop()
        executor = ThreadPoolExecutor(max_workers=1)

        print("⏳ Initialising Azure Speech...")
        _log.info("[CONV] Starting diarization in background thread")

        diarized = await loop.run_in_executor(executor, self.run_diarization)

        if not diarized["utterances"]:
            _log.warning("[CONV] No utterances captured — pipeline will not continue")
            print("⚠️  No utterances captured. Exiting.")
            return {}

        sla_start    = time.time()
        final_output = await self.run_mcp_pipeline(diarized)
        sla_end      = time.time()

        _log.info(f"[CONV] MCP pipeline complete | SLA: {round(sla_end - sla_start, 2)}s")
        print(f"⏱  MCP SLA: {round(sla_end - sla_start, 2)} seconds\n")

        return final_output
