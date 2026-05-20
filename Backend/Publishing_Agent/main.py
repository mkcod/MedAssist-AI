import asyncio
import json
import sys
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(override=False)

try:
    from kv_loader import load_secrets_from_keyvault as _load_kv
    _load_kv()
except Exception:
    pass

# Ensure this file's own directory is on sys.path so the agent/ package
# resolves correctly regardless of the Azure working directory.
_here = Path(__file__).resolve().parent
if str(_here) not in sys.path:
    sys.path.insert(0, str(_here))

from agent.publishing_agent import PublishingAgent


BANNER = """
==============================================================
MedAssist Agentic Publishing Agent - MAF Lite Terminal Mode
Paste input JSON and press Enter.
==============================================================
"""

SAMPLE = {
    "symptoms": ["fatigue"],
    "possible_condition": "Postviral and related fatigue syndromes",
    "icd10_code": "G93.30",
    "action_plan": [
        "Take rest",
        "Drink fluids",
        "Monitor symptoms",
        "Consult a healthcare professional if symptoms worsen"
    ],
    "clinical_summary": "Patient reports fatigue which may indicate Postviral and related fatigue syndromes."
}


def build_preview_doc(data: dict) -> str:
    return f"""
================================================================
MEDASSIST SOAP CLINICAL DOCUMENT
================================================================
Record ID      : {data.get("recordId")}
Patient ID     : {data.get("patientId")}
Generated Time : {data.get("timestamp", "PENDING")}
Confidence     : {data.get("confidenceScore", "")}

S - SUBJECTIVE
----------------------------------------------------------------
{data.get("subjective")}

O - OBJECTIVE
----------------------------------------------------------------
{data.get("objective")}

A - ASSESSMENT
----------------------------------------------------------------
{data.get("assessment")}

P - PLAN
----------------------------------------------------------------
{data.get("plan")}

Clinical note generated from validated SOAP JSON output for doctor review.
================================================================
"""


async def run():
    print(BANNER)
    print("Example input:")
    print(json.dumps(SAMPLE, indent=2, ensure_ascii=False))

    raw = input("\nInput JSON: ").strip()

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as e:
        print("\nERROR:")
        print(json.dumps({"status": "error", "reason": f"Invalid JSON: {e}"}, indent=2))
        return

    agent = PublishingAgent(Path("prompts/agent_prompt.md"))
    result = await agent.process(payload)

    print("\nSOAP OUTPUT:")
    print(json.dumps(result, indent=2, ensure_ascii=False))

    if result.get("status") != "success":
        return

    data = result["data"]

    # ✅ Show IDs clearly
    print("\nGenerated IDs:")
    print(f"Record ID  : {data.get('recordId')}")
    print(f"Patient ID : {data.get('patientId')}")

    # ✅ Document preview (same as Cosmos format)
    choice_doc = input("\nView SOAP document preview? (y/n): ").strip().lower()
    if choice_doc == "y":
        print(build_preview_doc(data))

    # ✅ Approval flow
    choice = input("\nApprove or Decline? (approve/decline): ").strip().lower()

    if choice == "approve":
        data["approvalStatus"] = "approved"

        publish_result = await agent.publish(data)

        print("\nCOSMOS RESULT:")
        print(json.dumps(publish_result, indent=2, ensure_ascii=False))

    else:
        print("\nDECLINED:")
        print(json.dumps({"status": "skipped", "reason": "User declined"}, indent=2))


if __name__ == "__main__":
    asyncio.run(run())