import json
import os
from datetime import datetime
from tools.guardrails_tool import output_guardrails_check

# Node.js backend URL for emitting socket log events
NODEJS_BACKEND_URL = os.environ.get("NODEJS_BACKEND_URL", "http://localhost:3000/api")


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


# ✅ Support BOTH formats
REQUIRED_MODEL_FIELDS = [
    ("subjective",),
    ("objective",),
    ("assessment",),
    ("plan",),
    ("confidence_score", "confidenceScore"),
]

REQUIRED_FINAL_FIELDS = [
    ("record_id", "recordId"),
    ("patient_id", "patientId"),
    ("icd10_code", "icd10Code", "icd_code"),
    ("subjective",),
    ("objective",),
    ("assessment",),
    ("plan",),
    ("confidence_score", "confidenceScore"),
    ("approval_status", "approvalStatus"),
    ("timestamp",),
]


def _has_field(data: dict, field_tuple):
    return any(field in data for field in field_tuple)


def _get_value(data: dict, field_tuple):
    for field in field_tuple:
        if field in data:
            return data[field]
    return None


def _check_required_fields(data: dict, required_fields):
    for field_tuple in required_fields:
        if not _has_field(data, field_tuple):
            return False, f"Missing required field: {field_tuple[0]}"
    return True, "ok"


def _validate_icd10_value(data: dict):
    icd10 = _get_value(data, ("icd10_code", "icd10Code", "icd_code"))
    if not isinstance(icd10, str):
        return False, "icd10_code must be a string"

    normalized = icd10.strip()
    if not normalized:
        return False, "icd10_code cannot be empty"
    if normalized.lower() == "not provided":
        return False, "icd10_code cannot be 'Not provided'"

    return True, "ok"


def validate_soap_output(output_text: str) -> str:
    _emit_socket_log("publishing", "validate_soap_output started")
    try:
        data = json.loads(output_text)
    except Exception as e:
        return json.dumps({"status": "invalid", "reason": f"Invalid JSON output: {e}"})

    # ✅ Required fields check
    valid, reason = _check_required_fields(data, REQUIRED_FINAL_FIELDS)
    if not valid:
        return json.dumps({"status": "invalid", "reason": reason})

    valid, reason = _validate_icd10_value(data)
    if not valid:
        return json.dumps({"status": "invalid", "reason": reason})

    # ✅ approval status check (support both)
    approval = _get_value(data, ("approval_status", "approvalStatus"))
    if approval not in ("pending", "approved"):
        return json.dumps({"status": "invalid", "reason": f"approval_status must be 'pending' or 'approved', got: {approval!r}"})

    # ✅ confidence check
    confidence = _get_value(data, ("confidence_score", "confidenceScore"))
    if not isinstance(confidence, (int, float)):
        return json.dumps({"status": "invalid", "reason": "confidence_score must be numeric"})

    # ✅ guardrails
    safety = json.loads(output_guardrails_check(output_text))
    if safety.get("status") != "safe":
        return json.dumps({"status": "invalid", "reason": safety.get("reason", "Output failed guardrails")})

    _emit_socket_log("publishing", "validate_soap_output passed")
    return json.dumps({"status": "valid", "reason": "SOAP output is valid"})


class ValidationTool:
    def validate_model_output(self, output_text: str):
        try:
            data = json.loads(output_text)
        except Exception as e:
            return False, f"Invalid JSON output: {e}"

        valid, reason = _check_required_fields(data, REQUIRED_MODEL_FIELDS)
        if not valid:
            return False, reason

        confidence = _get_value(data, ("confidence_score", "confidenceScore"))
        if not isinstance(confidence, (int, float)):
            return False, "confidence_score must be numeric"

        safety = json.loads(output_guardrails_check(output_text))
        if safety.get("status") != "safe":
            return False, safety.get("reason", "Model output failed guardrails")

        return True, "Model output is valid"

    def validate_final_soap(self, output_text: str):
        try:
            data = json.loads(output_text)
        except Exception as e:
            return False, f"Invalid final JSON output: {e}"

        valid, reason = _check_required_fields(data, REQUIRED_FINAL_FIELDS)
        if not valid:
            return False, reason

        valid, reason = _validate_icd10_value(data)
        if not valid:
            return False, reason

        approval = _get_value(data, ("approval_status", "approvalStatus"))
        if approval not in ("pending", "approved"):
            return False, "approval_status must be 'pending' or 'approved'"

        confidence = _get_value(data, ("confidence_score", "confidenceScore"))
        if not isinstance(confidence, (int, float)):
            return False, "confidence_score must be numeric"

        safety = json.loads(output_guardrails_check(output_text))
        if safety.get("status") != "safe":
            return False, safety.get("reason", "Final SOAP failed guardrails")

        return True, "Final SOAP JSON is valid"
