"""
MCP Server — exposes two tools:
    1. classify_speakers  — Azure OpenAI infers speaker roles
    2. merge_results      — merges roles into diarized utterances

Launched as subprocess by ConversationAgent.run_mcp_pipeline()
"""

import os
import sys
import json
import re
from pathlib import Path

from dotenv import load_dotenv
load_dotenv(dotenv_path=Path(__file__).parent / ".env")

from kv_loader import load_secrets_from_keyvault
load_secrets_from_keyvault()

from openai import AzureOpenAI
from mcp.server.fastmcp import FastMCP

_required = ["OPENAI_KEY", "OPENAI_ENDPOINT", "DEPLOYMENT_NAME"]
_missing = [k for k in _required if not os.environ.get(k)]
if _missing:
    print(f"[server.py] ERROR: missing env vars: {_missing}", file=sys.stderr)
    sys.exit(1)

client = AzureOpenAI(
    api_key=os.environ["OPENAI_KEY"],
    azure_endpoint=os.environ["OPENAI_ENDPOINT"],
    azure_deployment=os.environ["DEPLOYMENT_NAME"],
    api_version="2024-12-01-preview",
)

mcp = FastMCP("conversation-tools")


def _strip_markdown_fences(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


@mcp.tool()
def classify_speakers(input_json: dict) -> dict:
    """
    Takes diarized utterances and uses Azure OpenAI to infer each speaker's role.
    Returns { "speaker_roles": [ { "speaker_id": ..., "role": ... } ] }
    """
    system_prompt = """
You are a medical conversation analyst specialising in speaker role identification.

Your task: given diarized utterances from a doctor-patient consultation, assign a clinical role to each unique speaker_id.

Role identification cues:
- "doctor": asks diagnostic questions, mentions medications or tests, gives instructions, uses clinical terminology, refers to examination findings
- "patient": describes personal symptoms and their history, answers questions, expresses concerns, uses first-person language ("I feel", "I have", "my pain")
- "attendee": accompanies a patient, speaks on their behalf, asks logistical questions
- "unknown": speaker has too few utterances to classify with confidence

Rules:
- Assign exactly one role per unique speaker_id
- In a typical two-speaker consultation the roles will be "doctor" and "patient"
- If there are 3+ speakers, assign the most fitting role to each based on the cues above
- Do not guess — if genuinely ambiguous, use "unknown" rather than forcing a wrong role
- Return ONLY valid JSON — no markdown fences, no explanation outside the JSON

Required output format:
{
  "speaker_roles": [
    { "speaker_id": "Guest-1", "role": "doctor" },
    { "speaker_id": "Guest-2", "role": "patient" }
  ]
}
"""
    response = client.chat.completions.create(
        model=os.environ["DEPLOYMENT_NAME"],
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": json.dumps(input_json)},
        ],
        temperature=0,
    )
    raw = response.choices[0].message.content
    clean = _strip_markdown_fences(raw)
    return json.loads(clean)


@mcp.tool()
def merge_results(diarized: dict, annotation: dict) -> dict:
    """
    Merges speaker role labels into diarized utterances.
    Returns enriched JSON with a 'speaker' field on each utterance.
    """
    if "speaker_roles" not in annotation:
        raise ValueError("annotation missing 'speaker_roles' key")

    role_map = {
        item["speaker_id"]: item["role"]
        for item in annotation["speaker_roles"]
    }
    for utt in diarized["utterances"]:
        utt["speaker"] = role_map.get(utt["speaker_id"], "unknown")

    return diarized


if __name__ == "__main__":
    mcp.run()
