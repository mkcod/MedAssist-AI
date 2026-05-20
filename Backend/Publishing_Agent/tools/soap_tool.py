import json
import hashlib
import os
from datetime import datetime
from config.settings import settings

# Node.js backend URL for emitting socket log events
NODEJS_BACKEND_URL = os.environ.get("NODEJS_BACKEND_URL", "http://localhost:3000/api")

try:
    from openai import AzureOpenAI
except Exception:
    AzureOpenAI = None


def _emit_socket_log(stage: str, message: str, level: str = "info"):
    """Emit a log event to the Node.js backend via HTTP POST."""
    try:
        import requests
        payload = {
            "job_id": None,
            "stage": stage,
            "message": message,
            "level": level,
            "timestamp": datetime.now().isoformat(),
        }
        response = requests.post(
            f"{NODEJS_BACKEND_URL}/orchestrator/log",
            json=payload,
            timeout=5,
            headers={"Content-Type": "application/json"}
        )
        if response.status_code == 200:
            return True
    except Exception:
        pass
    return False

def build_demo_soap(payload: dict) -> dict:
    _emit_socket_log("publishing", "build_demo_soap started")
    patient_id = str(payload.get("patient_id", "UNKNOWN")).strip() or "UNKNOWN"

    symptoms = payload.get("symptoms", [])
    if not isinstance(symptoms, list):
        symptoms = [str(symptoms)]
    symptoms = [str(s).strip() for s in symptoms if str(s).strip()]

    clinical_summary = str(payload.get("clinical_summary", "No clinical summary provided.")).strip() or "No clinical summary provided."
    possible_condition = str(payload.get("possible_condition", "Not provided")).strip() or "Not provided"
    icd10_code = str(
        payload.get("icd10_code")
        or payload.get("icd10Code")
        or payload.get("icd_code")
        or "Not provided"
    ).strip() or "Not provided"

    action_plan = payload.get("action_plan", [])
    if not isinstance(action_plan, list):
        action_plan = [str(action_plan)]
    action_plan = [str(step).strip() for step in action_plan if str(step).strip()]

    rid = "SOAP-" + hashlib.md5(
        f"{patient_id}-{datetime.utcnow().isoformat()}".encode()
    ).hexdigest()[:8].upper()

    confidence = 86.0 if symptoms and clinical_summary != "No clinical summary provided." else 72.0

    subjective_text = ", ".join(symptoms) if symptoms else "symptoms not provided"
    plan_text = "\n".join(
        f"{index}. {step}"
        for index, step in enumerate(action_plan, start=1)
    ) if action_plan else "1. Recommend clinician evaluation and monitoring."

    result = {
        "record_id": rid,
        "patient_id": patient_id,
        "subjective": f"Patient reports {subjective_text}.",
        "objective": f"Clinical summary: {clinical_summary}",
        "assessment": (
            f"Symptoms and context suggest a possible clinical picture related to {possible_condition} (reference code: {icd10_code}) without confirming a diagnosis."
        ),
        "plan": plan_text,
        "confidence_score": confidence,
        "approval_status": "approved",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "icd10_code": icd10_code,
        "icd10Code": icd10_code,
    }
    _emit_socket_log("publishing", "build_demo_soap completed")
    return result


def build_doctor_document(soap_record: dict) -> str:
    record_id = soap_record.get("record_id", "UNKNOWN")
    patient_id = soap_record.get("patient_id", "UNKNOWN")
    subjective = str(soap_record.get("subjective", "")).strip()
    objective = str(soap_record.get("objective", "")).strip()
    assessment = str(soap_record.get("assessment", "")).strip()
    plan = str(soap_record.get("plan", "")).strip()
    confidence = soap_record.get("confidence_score", "")
    timestamp = soap_record.get("timestamp", "")

    lines = [
        "================================================================",
        "MEDASSIST SOAP CLINICAL DOCUMENT",
        "================================================================",
        f"Record ID      : {record_id}",
        f"Generated Time : {timestamp}",
        f"Confidence     : {confidence}",
        "",
        "S - SUBJECTIVE",
        "----------------------------------------------------------------",
        subjective or "No subjective information available.",
        "",
        "O - OBJECTIVE",
        "----------------------------------------------------------------",
        objective or "No objective information available.",
        "",
        "A - ASSESSMENT",
        "----------------------------------------------------------------",
        assessment or "No assessment available.",
        "",
        "P - PLAN",
        "----------------------------------------------------------------",
        plan or "No plan available.",
        "",
        "Clinical note generated from validated SOAP JSON output for doctor review.",
        "================================================================",
    ]
    result = "\n".join(lines)
    _emit_socket_log("publishing", "build_doctor_document completed")
    return result


class SOAPTool:
    def __init__(self):
        self.client = None
        if AzureOpenAI is not None and settings.azure_openai_configured:
            self.client = AzureOpenAI(
                api_key=settings.azure_openai_api_key,
                api_version=settings.azure_openai_api_version,
                azure_endpoint=settings.azure_openai_endpoint,
            )

    def generate(self, system_prompt: str, payload: dict) -> str:
        if not self.client:
            return json.dumps(build_demo_soap(payload), ensure_ascii=False)

        response = self.client.chat.completions.create(
            model=settings.azure_openai_deployment,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
            ],
            temperature=0.2,
            response_format={"type": "json_object"},
        )

        return response.choices[0].message.content
