"""
Entry point — creates ConversationAgent and runs the full pipeline.
Run:  python main.py
"""

import asyncio
import json
import os
import signal
import threading
from pathlib import Path

from dotenv import load_dotenv
load_dotenv(dotenv_path=Path(__file__).parent / ".env")

from kv_loader import load_secrets_from_keyvault
load_secrets_from_keyvault()

from agent.conversation_agent import ConversationAgent

# Shared stop event — set by Ctrl+C, passed into the agent
_stop_event = threading.Event()


def _sigint_handler(sig, frame):
    print("\n🛑 Ctrl+C — stopping recording...")
    _stop_event.set()
    signal.signal(signal.SIGINT, signal.SIG_DFL)  # second Ctrl+C force quits


async def main():

    agent = ConversationAgent(stop_event=_stop_event)

    final_output = await agent.process()

    if not final_output:
        return

    output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "final_output.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(final_output, f, indent=2, ensure_ascii=False)

    print("─" * 50)
    print(f"📄 Saved → {output_path}")
    print("─" * 50)
    print(json.dumps(final_output, indent=2))


if __name__ == "__main__":
    signal.signal(signal.SIGINT, _sigint_handler)
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n👋 Force stopped.")
