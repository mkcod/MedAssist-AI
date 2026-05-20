import json
import re
import os
from datetime import datetime
from typing import Any, Tuple

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


REQUIRED_FIELDS = [
    "symptoms",
    "possible_condition",
    # "icd10_code",
    "action_plan",
    "clinical_summary",
]


MEDICAL_SYMPTOM_HINTS = {
    "fatigue", "fever", "cough", "headache", "pain", "nausea", "vomiting",
    "dizziness", "sore throat", "body ache", "weakness", "chills",
    "shortness of breath", "diarrhea", "rash",
    "insomnia", "sleeplessness", "sleep disturbance", "poor sleep", "sleep",
    "night sweats", "sweating", "sweats", "appetite loss", "loss of appetite",
    "decreased appetite", "reduced appetite", "anorexia"
}


MEDICAL_CONDITION_HINTS = {
    "syndrome", "infection", "viral", "fatigue", "disease", "condition",
    "illness", "disorder", "fever", "respiratory", "gastroenteritis"
}


SAFE_ACTION_HINTS = {
    "rest", "drink fluids", "monitor symptoms", "consult a healthcare professional",
    "hydration", "follow up", "seek medical attention", "observe symptoms"
}


SAFE_EXCEPTIONS = [
    "no diagnosis requested",
    "do not provide diagnosis",
    "without diagnosis",
    "no medication suggestion requested",
    "do not prescribe",
    "avoid treatment advice",
]


PROMPT_INJECTION_PHRASES = [
    "ignore previous instructions",
    "ignore system instructions",
    "ignore system prompt",
    "override guardrails",
    "override security",
    "bypass safety",
    "forget your role",
    "you are now a doctor",
    "act as",
    "debug mode",
    "admin mode",
    "system override",
]


UNSAFE_MEDICAL_PHRASES = [
    "prescribe medication",
    "give me a prescription",
    "what medicine should i take",
    "recommend antibiotics",
    "suggest dosage",
    "which drug should i use",
    "give me medication",
    "diagnose this patient",
    "what is the diagnosis",
    "what disease do i have",
    "tell me the disease name",
    "confirm the diagnosis",
    "take aspirin",
    "take ibuprofen",
    "start antibiotic",
    "start antibiotics",
    "mg once daily",
]


# ICD10_PATTERN = re.compile(r"^[A-TV-Z][0-9][0-9AB](\.[0-9A-Z]{1,4})?$")


def normalize_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip().lower()


def blocked_response(reason: str) -> str:
    return json.dumps({
        "status": "blocked",
        "reason": reason
    }, ensure_ascii=False)


def safe_response(message: str = "Input passed guardrails") -> str:
    return json.dumps({
        "status": "safe",
        "reason": message
    }, ensure_ascii=False)


def parse_json_input(input_text: str) -> Tuple[bool, Any, str]:
    try:
        data = json.loads(input_text)
    except Exception as e:
        return False, None, f"Invalid JSON input: {e}"

    if not isinstance(data, dict):
        return False, None, "Input JSON must be an object"

    return True, data, ""


def validate_required_fields(payload: dict) -> Tuple[bool, str]:
    if not payload:
        return False, "Input JSON is empty"

    missing = [f for f in REQUIRED_FIELDS if f not in payload]
    if missing:
        return False, f"Missing required field(s): {', '.join(missing)}"

    for field in REQUIRED_FIELDS:
        value = payload.get(field)

        if value is None:
            return False, f"Field '{field}' is empty"

        if isinstance(value, str) and not value.strip():
            return False, f"Field '{field}' is empty"

        if isinstance(value, list) and len(value) == 0:
            return False, f"Field '{field}' is empty"

    if not isinstance(payload["symptoms"], list):
        return False, "Field 'symptoms' must be a list"

    if not all(isinstance(x, str) and x.strip() for x in payload["symptoms"]):
        return False, "Field 'symptoms' must contain non-empty strings"

    if not isinstance(payload["action_plan"], list):
        return False, "Field 'action_plan' must be a list"

    if not all(isinstance(x, str) and x.strip() for x in payload["action_plan"]):
        return False, "Field 'action_plan' must contain non-empty strings"

    if not isinstance(payload["possible_condition"], str):
        return False, "Field 'possible_condition' must be a string"

    if not isinstance(payload["clinical_summary"], str):
        return False, "Field 'clinical_summary' must be a string"

    # if not isinstance(payload["icd10_code"], str):
    #     return False, "Field 'icd10_code' must be a string"

    return True, "Required fields present"


def validate_medical_domain(payload: dict) -> Tuple[bool, str]:
    symptoms = " ".join(normalize_text(x) for x in payload.get("symptoms", []))
    condition = normalize_text(payload.get("possible_condition", ""))
    actions = " ".join(normalize_text(x) for x in payload.get("action_plan", []))
    summary = normalize_text(payload.get("clinical_summary", ""))
    clinical_context = normalize_text(payload.get("clinical_context", ""))
    # icd10 = payload.get("icd10_code", "").strip()

    # if not ICD10_PATTERN.match(icd10):
    #     return False, "Invalid ICD-10 code format"

    medical_signal = 0

    if any(hint in symptoms for hint in MEDICAL_SYMPTOM_HINTS):
        medical_signal += 1
    if any(hint in condition for hint in MEDICAL_CONDITION_HINTS):
        medical_signal += 1
    if any(hint in actions for hint in SAFE_ACTION_HINTS):
        medical_signal += 1
    if any(hint in summary for hint in MEDICAL_CONDITION_HINTS.union(MEDICAL_SYMPTOM_HINTS)):
        medical_signal += 1
    if any(hint in clinical_context for hint in MEDICAL_CONDITION_HINTS.union(MEDICAL_SYMPTOM_HINTS)):
        medical_signal += 1

    if medical_signal < 2:
        return False, "Input is not sufficiently medical in context"

    return True, "Medical domain validation passed"


def has_safe_exception(text: str) -> bool:
    return any(p in text for p in SAFE_EXCEPTIONS)


def scan_text(text: str) -> Tuple[bool, str]:
    normalized = normalize_text(text)

    if not normalized:
        return False, "Empty text"

    if has_safe_exception(normalized):
        return True, "Safe exception matched"

    for phrase in PROMPT_INJECTION_PHRASES:
        if phrase in normalized:
            return False, f"Prompt injection detected: {phrase}"

    for phrase in UNSAFE_MEDICAL_PHRASES:
        if phrase in normalized:
            return False, f"Unsafe medical request detected: {phrase}"

    return True, "Text passed screening"


def scan_payload(payload: dict) -> Tuple[bool, str]:
    combined = " ".join([
        " ".join(payload.get("symptoms", [])),
        payload.get("possible_condition", ""),
        " ".join(payload.get("action_plan", [])),
        payload.get("clinical_summary", ""),
        payload.get("clinical_context", ""),
        # payload.get("icd10_code", ""),
    ])

    if len(combined) > 10000:
        return False, "Input too long; potential injection risk"

    return scan_text(combined)


def guardrails_check(input_text: str) -> str:
    _emit_socket_log("publishing", "guardrails_check started")
    ok, data, reason = parse_json_input(input_text)
    if not ok:
        _emit_socket_log("publishing", f"guardrails_check blocked: {reason}", level="error")
        return blocked_response(reason)

    ok, reason = validate_required_fields(data)
    if not ok:
        _emit_socket_log("publishing", f"guardrails_check failed: {reason}", level="warning")
        return blocked_response(reason)

    ok, reason = scan_payload(data)
    if not ok:
        _emit_socket_log("publishing", f"guardrails_check failed: {reason}", level="warning")
        return blocked_response(reason)

    ok, reason = validate_medical_domain(data)
    if not ok:
        _emit_socket_log("publishing", f"guardrails_check failed: {reason}", level="warning")
        return blocked_response(reason)

    _emit_socket_log("publishing", "guardrails_check passed")
    return safe_response("Input passed guardrails")


def output_guardrails_check(output_text: str) -> str:
    _emit_socket_log("publishing", "output_guardrails_check started")
    if output_text is None or not str(output_text).strip():
        _emit_socket_log("publishing", "output_guardrails_check blocked: empty output", level="error")
        return blocked_response("Output is empty")

    ok, reason = scan_text(output_text)
    if not ok:
        _emit_socket_log("publishing", f"output_guardrails_check failed: {reason}", level="warning")
        return blocked_response(reason)

    _emit_socket_log("publishing", "output_guardrails_check passed")
    return safe_response("Output passed guardrails")


class GuardrailsTool:
    def validate_input_json(self, input_text: str) -> Tuple[bool, str, Any]:
        ok, data, reason = parse_json_input(input_text)
        if not ok:
            return False, reason, None

        ok, reason = validate_required_fields(data)
        if not ok:
            return False, reason, None

        ok, reason = scan_payload(data)
        if not ok:
            return False, reason, None

        ok, reason = validate_medical_domain(data)
        if not ok:
            return False, reason, None

        return True, "Input passed guardrails", data

    def validate_input(self, data: Any) -> Tuple[bool, str]:
        if not isinstance(data, dict):
            return False, "Input must be a JSON object"

        ok, reason = validate_required_fields(data)
        if not ok:
            return False, reason

        ok, reason = scan_payload(data)
        if not ok:
            return False, reason

        ok, reason = validate_medical_domain(data)
        if not ok:
            return False, reason

        return True, "Input passed guardrails"

    def validate_output(self, text: str) -> Tuple[bool, str]:
        if text is None or not str(text).strip():
            return False, "Output is empty"

        return scan_text(text)