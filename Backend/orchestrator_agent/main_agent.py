# # """
# # MedAssist Agentic Orchestrator — entry point.

# # The LLM orchestration agent decides what to call and when.
# # You just run this and press Ctrl+C once to stop recording.

# # Run:  python main_agent.py
# # """

# # import asyncio
# # import json
# # import os
# # import signal
# # import sys
# # import time
# # import threading
# # from pathlib import Path

# # from dotenv import load_dotenv
# # load_dotenv(dotenv_path=Path(__file__).parent / ".env")

# # from agent_orchestrator import AgentOrchestrator

# # # ── Shared stop event — set by Ctrl+C to stop mic recording ──────────────────
# # _stop_event = threading.Event()


# # def _sigint_handler(sig, frame):
# #     print("\n🛑 Ctrl+C — stopping recording...")
# #     _stop_event.set()
# #     signal.signal(signal.SIGINT, signal.SIG_DFL)


# # async def main():
# #     pipeline_start = time.time()

# #     print("=" * 60)
# #     print(" MedAssist Agentic Orchestrator")
# #     print("=" * 60)
# #     print("The orchestration agent will now decide the flow.")
# #     print("Press Ctrl+C ONCE to stop the mic recording.\n")

# #     orchestrator = AgentOrchestrator(stop_event=_stop_event)

# #     try:
# #         final_response = await orchestrator.run()
# #     except Exception as e:
# #         print(f"\n❌ Orchestration failed: {e}")
# #         raise

# #     total_time = round(time.time() - pipeline_start, 2)
# #     print(f"\n⏱  Total pipeline time: {total_time}s")


# # if __name__ == "__main__":
# #     signal.signal(signal.SIGINT, _sigint_handler)
# #     try:
# #         asyncio.run(main())
# #     except KeyboardInterrupt:
# #         print("\n👋 Force stopped.")
# #     except Exception as e:
# #         print(f"\n❌ Error: {e}")
# #         raise

# """
# MedAssist Agentic Orchestrator — entry point.
# Run:  python main_agent.py
# Stop recording: Ctrl+C once
# """

# import asyncio
# import os
# import signal
# import sys
# import time
# import threading
# from pathlib import Path

# from dotenv import load_dotenv

# # Load orchestrator .env first
# load_dotenv(dotenv_path=Path(__file__).parent / ".env", override=True)

# import logger as log
# from agent_orchestrator import AgentOrchestrator

# _stop_event = threading.Event()


# def _sigint_handler(sig, frame):
#     print("\n🛑 Ctrl+C — stopping recording...")
#     log.agent("Ctrl+C received — stopping recording")
#     _stop_event.set()
#     signal.signal(signal.SIGINT, signal.SIG_DFL)


# async def main():
#     pipeline_start = time.time()

#     log.pipeline(f"Agentic pipeline started | pid: {os.getpid()}")
#     log.pipeline(f"Orchestration model: {os.environ.get('ORCHESTRATION_DEPLOYMENT_NAME', 'NOT SET')}")

#     print("=" * 60)
#     print(" MedAssist Agentic Orchestrator")
#     print("=" * 60)
#     print("The orchestration agent will decide the flow.")
#     print("Press Ctrl+C ONCE to stop the mic recording.\n")

#     orchestrator = AgentOrchestrator(stop_event=_stop_event)

#     try:
#         final_response = await orchestrator.run()
#     except Exception as e:
#         log.error(f"Orchestration failed — {e}")
#         print(f"\n❌ Orchestration failed: {e}")
#         raise

#     total_time = round(time.time() - pipeline_start, 2)
#     log.pipeline(f"Agentic pipeline complete | total_time: {total_time}s")
#     print(f"\n⏱  Total pipeline time: {total_time}s")


# if __name__ == "__main__":
#     signal.signal(signal.SIGINT, _sigint_handler)
#     try:
#         asyncio.run(main())
#     except KeyboardInterrupt:
#         print("\n👋 Force stopped.")
#     except Exception as e:
#         log.error(f"Unhandled error — {e}")
#         print(f"\n❌ Error: {e}")
#         raise


"""
MedAssist Agentic Orchestrator — entry point.
Run:  python main_agent.py
Stop recording: Ctrl+C once
"""

import asyncio
import os
import signal
import sys
import time
import threading
import uuid
from pathlib import Path

from dotenv import load_dotenv
load_dotenv(dotenv_path=Path(__file__).parent / ".env", override=False)

from kv_loader import load_secrets_from_keyvault
load_secrets_from_keyvault()

import logger as log
from agent_orchestrator import AgentOrchestrator

_stop_event = threading.Event()


def _sigint_handler(sig, frame):
    print("\n🛑 Ctrl+C — stopping recording...")
    log.agent("Ctrl+C received — stopping recording")
    _stop_event.set()
    signal.signal(signal.SIGINT, signal.SIG_DFL)


async def main():
    pipeline_start = time.time()
    session_id     = str(uuid.uuid4())

    log.pipeline(f"Agentic pipeline started | session_id: {session_id} | pid: {os.getpid()}")
    log.pipeline(f"Orchestration model: {os.environ.get('ORCHESTRATION_DEPLOYMENT_NAME', 'NOT SET')}")

    print("=" * 60)
    print(" MedAssist Agentic Orchestrator")
    print("=" * 60)
    print(f" Session: {session_id}")
    print(" Press Ctrl+C ONCE to stop the mic recording.\n")

    orchestrator = AgentOrchestrator(
        stop_event=_stop_event,
        session_meta={
            "user_id":    os.environ.get("DEFAULT_USER_ID", "cli"),
            "patient_id": None,
            "doctor_id":  None,
        }
    )

    try:
        await orchestrator.run(session_id=session_id)
    except Exception as e:
        log.error(f"Orchestration failed — {e}")
        print(f"\n❌ Orchestration failed: {e}")
        raise

    total = round(time.time() - pipeline_start, 2)
    log.pipeline(f"Pipeline complete | session_id: {session_id} | total_time: {total}s")
    print(f"\n⏱  Total pipeline time: {total}s")


if __name__ == "__main__":
    signal.signal(signal.SIGINT, _sigint_handler)
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n👋 Force stopped.")
    except Exception as e:
        log.error(f"Unhandled error — {e}")
        print(f"\n❌ Error: {e}")
        raise


