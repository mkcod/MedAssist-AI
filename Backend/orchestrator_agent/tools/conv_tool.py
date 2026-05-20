# """
# Tool 1 — Conversational Agent
# Wraps the diarization + classify + merge pipeline into a single async callable.
# Called by the orchestration agent when it decides to start recording.
# """

# import json
# import os
# import sys
# import threading
# from pathlib import Path

# BASE_DIR = Path(__file__).parent.parent
# CONV_DIR = BASE_DIR.parent / "conversational_agent"


# def _import_from_path(module_name, file_path):
#     import importlib.util
#     spec = importlib.util.spec_from_file_location(module_name, str(file_path))
#     mod  = importlib.util.module_from_spec(spec)
#     sys.modules[module_name] = mod
#     spec.loader.exec_module(mod)
#     return mod


# async def run_conversational_agent(stop_event: threading.Event) -> dict:
#     """
#     Starts mic recording, diarizes, classifies speakers, merges roles.
#     Returns the annotated conversation JSON.
#     Blocks until Ctrl+C sets stop_event.
#     """
#     mod = _import_from_path(
#         "conversation_agent",
#         CONV_DIR / "agent" / "conversation_agent.py"
#     )
#     ConversationAgent = mod.ConversationAgent

#     agent        = ConversationAgent(stop_event=stop_event)
#     final_output = await agent.process()

#     if not final_output:
#         raise RuntimeError("Conversational agent produced no output — no utterances captured.")

#     # Save for reference
#     out_path = CONV_DIR / "final_output.json"
#     out_path.write_text(
#         json.dumps(final_output, indent=2, ensure_ascii=False),
#         encoding="utf-8"
#     )
#     return final_output


"""
Tool 1 — Conversational Agent
Wraps the diarization + classify + merge pipeline into a single async callable.
"""

import json
import os
import sys
import threading
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
CONV_DIR = BASE_DIR.parent / "conversational_agent"


def _import_from_path(module_name, file_path):
    import importlib.util
    spec = importlib.util.spec_from_file_location(module_name, str(file_path))
    mod  = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = mod
    spec.loader.exec_module(mod)
    return mod


async def run_conversational_agent(stop_event: threading.Event) -> dict:
    """
    Starts mic recording, diarizes, classifies speakers, merges roles.
    Returns the annotated conversation JSON.
    Blocks until Ctrl+C sets stop_event.
    """
    # Load conversational agent's own .env so SPEECH_KEY,
    # OPENAI_KEY, DEPLOYMENT_NAME etc. are available
    conv_env_path = CONV_DIR / ".env"
    if conv_env_path.exists():
        from dotenv import load_dotenv
        load_dotenv(dotenv_path=str(conv_env_path), override=True)

    mod = _import_from_path(
        "conversation_agent",
        CONV_DIR / "agent" / "conversation_agent.py"
    )
    ConversationAgent = mod.ConversationAgent

    agent        = ConversationAgent(stop_event=stop_event)
    final_output = await agent.process()

    if not final_output:
        raise RuntimeError("Conversational agent produced no output — no utterances captured.")

    # Save for reference
    out_path = CONV_DIR / "final_output.json"
    out_path.write_text(
        json.dumps(final_output, indent=2, ensure_ascii=False),
        encoding="utf-8"
    )
    return final_output
