import json
import logging
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from typing import Dict, List, Optional

# Define logger immediately so it is always available even if a later import fails
# and leaves the module in a partially-initialised state.
logger = logging.getLogger(__name__)

from dotenv import load_dotenv
from openai import AzureOpenAI
from pathlib import Path as _Path

# Ensure this file's own directory is on sys.path so retrieval.py resolves
# correctly regardless of which caller triggered the import.
_here = _Path(__file__).resolve().parent
if str(_here) not in sys.path:
    sys.path.insert(0, str(_here))

load_dotenv(override=False)  # bootstrap only
try:
    from kv_loader import load_secrets_from_keyvault as _load_kv
    _load_kv()
except Exception:
    pass

from retrieval import retrieve_top_k
# Node.js backend URL for emitting socket log events
NODEJS_BACKEND_URL = os.environ.get("NODEJS_BACKEND_URL", "http://localhost:3000/api")


def _emit_socket_log(stage: str, message: str, level: str = "info"):
    """Emit a log event to the Node.js backend via HTTP POST."""
    try:
        import requests
        payload = {
            "job_id": None,  # Will be set by caller if needed
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


# Lazy-initialized — created on first use so that Azure App Settings env vars
# are guaranteed to be present regardless of import order.
_client: AzureOpenAI = None


def _get_client() -> AzureOpenAI:
    global _client
    if _client is None:
        _client = AzureOpenAI(
            api_key=os.getenv("AZURE_OPENAI_API_KEY"),
            api_version=os.getenv("AZURE_OPENAI_API_VERSION"),
            azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
            timeout=25.0,
            max_retries=0,
        )
    return _client


CHAT_DEPLOYMENT: str = None  # resolved lazily in _get_chat_deployment()
ACTION_PLAN_DEPLOYMENT: str = None  # optional override for action-plan generation


def _get_chat_deployment() -> str:
    global CHAT_DEPLOYMENT
    if CHAT_DEPLOYMENT is None:
        # Try all known env var name variants (including historical typos)
        CHAT_DEPLOYMENT = (
            os.getenv("AZURE_OPENAI_CHAT_DEPLOYMENT")
            or os.getenv("AZURE_OPENAI_DEPLOYMENT")
            or os.getenv("AZURE_OPENAI_DEPLOYEMENT")  # typo present in some .env files
            or os.getenv("DEPLOYMENT_NAME")
        )
    return CHAT_DEPLOYMENT


def _get_action_plan_deployment() -> str:
    global ACTION_PLAN_DEPLOYMENT
    if ACTION_PLAN_DEPLOYMENT is None:
        ACTION_PLAN_DEPLOYMENT = (
            os.getenv("AZURE_OPENAI_ACTION_PLAN_DEPLOYMENT")
            or os.getenv("AZURE_OPENAI_ACTION_PLAN_MODEL")
            or _get_chat_deployment()
        )
    return ACTION_PLAN_DEPLOYMENT

ICD10_CODE_RE = re.compile(r"^[A-TV-Z][0-9][0-9A-Z](?:\.[0-9A-Z]{1,4})?$", re.IGNORECASE)
ICD10_RANGE_RE = re.compile(r"^[A-TV-Z][0-9]{2}\s*-\s*[A-TV-Z]?[0-9]{2}$", re.IGNORECASE)
ICD10_COMPACT_RE = re.compile(r"^([A-TV-Z]\d{2})([A-Z0-9]{1,4})$", re.IGNORECASE)

DEFAULT_CLINICAL_CONDITION = "Illness, unspecified"
DEFAULT_CLINICAL_ICD10 = "R69"

DEFAULT_ACTION_PLAN = [
    "Check and write down the specific symptom, the time it started, how severe it is, and any clear triggers twice daily until the doctor reviews it.",
    "Complete any ordered test on the date given by the doctor and follow the lab instructions exactly, including fasting if the lab requires it.",
    "Take only the medicines already prescribed, at the exact dose and timing on the label, and do not start new medicine without doctor approval.",
    "Book a clinic review within 24 to 72 hours if symptoms are getting worse, affecting daily activity, or not improving as expected.",
    "Follow the diet or activity advice already given by the care team and ask a dietitian for meal planning support if needed.",
]

MAX_SYMPTOM_EXTRACTION_CHARS = 2500


COMMON_SYMPTOM_ICD10 = [
    (("fever", "feverish", "temperature"), "Fever, unspecified", "R50.9"),
    (("cough", "coughing"), "Cough, unspecified", "R05.9"),
    (("throat irritation", "sore throat", "throat pain"), "Pain in throat", "R07.0"),
    (("breathlessness", "shortness of breath", "dyspnea", "breathing issue"), "Dyspnea, unspecified", "R06.00"),
    (("body pain", "body ache", "aches", "myalgia"), "Myalgia", "M79.1"),
    (("weakness", "fatigue", "tiredness"), "Weakness", "R53.1"),
    (("headache",), "Headache, unspecified", "R51.9"),
    (("chest pain", "chest discomfort"), "Chest pain, unspecified", "R07.9"),
    (("dizziness", "giddiness"), "Dizziness and giddiness", "R42"),
    (("nausea",), "Nausea", "R11.0"),
    (("vomiting",), "Vomiting, unspecified", "R11.10"),
    (("abdominal pain", "stomach pain"), "Unspecified abdominal pain", "R10.9"),
    (("diarrhea", "loose motion", "loose motions"), "Diarrhea, unspecified", "R19.7"),
    (("runny nose", "nasal congestion", "blocked nose"), "Nasal congestion", "R09.81"),
]


def truncate_for_llm(text: str, max_chars: int = MAX_SYMPTOM_EXTRACTION_CHARS) -> str:
    text = str(text or "")
    if len(text) <= max_chars:
        return text
    return text[:max_chars]


def parse_llm_json(content: str, context: str) -> dict:
    try:
        return json.loads(content or "{}")
    except json.JSONDecodeError as e:
        preview = (content or "").replace("\n", " ")[:300]
        logger.warning("%s returned invalid JSON: %s | preview=%r", context, e, preview)
        return {}


def _normalize_action_plan_item(item) -> str:
    if isinstance(item, dict):
        if len(item) == 1:
            item = next(iter(item.values()))
        else:
            item = " ".join(str(value).strip() for value in item.values() if str(value).strip())

    text = str(item or "").strip()
    text = re.sub(r"^\s*(?:\d+\.|[-*])\s*", "", text)
    text = re.sub(
        r"^(home monitoring|lab tests|medication|doctor visit|lifestyle)\s*[:\-]\s*",
        "",
        text,
        flags=re.IGNORECASE,
    )
    return text.strip()


def normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", str(text).strip().lower())


def normalize_icd10_code(code: str) -> str:
    code = re.sub(r"[\s-]", "", str(code or "")).upper().strip()
    if not code:
        return ""
    if "." in code:
        return code
    match = ICD10_COMPACT_RE.match(code)
    if match:
        return f"{match.group(1)}.{match.group(2)}"
    return code


def is_usable_icd10_code(code: str) -> bool:
    code = normalize_icd10_code(code)
    if not code or normalize_text(code) in {"n/a", "na", "none", "unknown", "not provided"}:
        return False
    if ICD10_RANGE_RE.match(code):
        return False
    return bool(ICD10_CODE_RE.match(code))


def symptom_icd10_fallback(patient_text: str, symptoms: List[str]) -> Optional[dict]:
    symptom_text = " ".join(str(s) for s in symptoms if str(s).strip())
    haystack = normalize_text(symptom_text or patient_text)
    for aliases, condition, code in COMMON_SYMPTOM_ICD10:
        if any(alias in haystack for alias in aliases):
            return {"possible_condition": condition, "icd10_code": normalize_icd10_code(code)}
    return None


def deterministic_symptom_fallback(patient_text: str) -> List[str]:
    haystack = normalize_text(patient_text)
    extracted: List[str] = []
    seen = set()

    for aliases, _, _ in COMMON_SYMPTOM_ICD10:
        canonical = normalize_text(aliases[0])
        if canonical in seen:
            continue
        if any(alias in haystack for alias in aliases):
            extracted.append(canonical)
            seen.add(canonical)

    return extracted[:8]


def best_usable_reference(top_matches: List[dict]) -> Optional[dict]:
    for match in top_matches:
        code = normalize_icd10_code(match.get("icd10_code") or match.get("icd_code"))
        condition = str(match.get("condition") or "").strip()
        description = str(match.get("description") or "").strip()
        if is_usable_icd10_code(code) and condition and not is_generic_reference(condition, description):
            return {"possible_condition": condition, "icd10_code": code}
    return None


def is_generic_reference(condition: str, description: str = "") -> bool:
    text = normalize_text(f"{condition} {description}")
    generic_terms = {
        "chapter",
        "block",
        "category",
        "range",
        "symptoms signs and abnormal clinical",
        "not elsewhere classified",
        "diagnoses and procedures",
        "guidelines",
    }
    return any(term in text for term in generic_terms)


def clinical_icd10_fallback(patient_text: str, symptoms: List[str], top_matches: List[dict] = None) -> dict:
    top_matches = top_matches or []
    reference = best_usable_reference(top_matches)
    if reference:
        return reference

    symptom_match = symptom_icd10_fallback(patient_text, symptoms)
    if symptom_match:
        return symptom_match

    return {"possible_condition": DEFAULT_CLINICAL_CONDITION, "icd10_code": DEFAULT_CLINICAL_ICD10}


def tokenize(text: str) -> List[str]:
    text = re.sub(r"[^a-z0-9\s]", " ", normalize_text(text))
    return [t for t in text.split() if len(t) > 2]


def parse_transcript(input_data) -> List[Dict[str, str]]:
    if isinstance(input_data, str):
        try:
            input_data = json.loads(input_data)
        except Exception:
            return [{"speaker_id": "unknown", "text": normalize_text(input_data)}]

    if isinstance(input_data, dict):
        utterances = input_data.get("transcript", {}).get("utterances", [])
        return [
            {
                "speaker_id": str(utt.get("speaker_id", "")).strip().lower(),
                "text": normalize_text(utt.get("text", ""))
            }
            for utt in utterances
        ]

    return [{"speaker_id": "unknown", "text": normalize_text(str(input_data))}]


def choose_patient_speaker(utterances: List[Dict[str, str]]) -> Optional[str]:
    speaker_stats: Dict[str, Dict[str, int]] = {}
    first_person_words = {"i", "im", "i'm", "ive", "i've", "me", "my", "am"}

    for utt in utterances:
        speaker = utt["speaker_id"]
        text = utt["text"]
        tokens = tokenize(text)

        if speaker not in speaker_stats:
            speaker_stats[speaker] = {
                "first_person": 0,
                "questions": 0,
                "token_count": 0
            }

        speaker_stats[speaker]["token_count"] += len(tokens)
        speaker_stats[speaker]["questions"] += 1 if "?" in str(text) else 0
        speaker_stats[speaker]["first_person"] += sum(1 for t in tokens if t in first_person_words)

    best_speaker = None
    best_score = None

    for speaker, stats in speaker_stats.items():
        score = stats["first_person"] * 5 + stats["token_count"] - stats["questions"] * 3
        if best_score is None or score > best_score:
            best_score = score
            best_speaker = speaker

    return best_speaker


def extract_patient_text(input_data) -> str:
    utterances = parse_transcript(input_data)

    if not utterances:
        return ""

    patient_speaker = choose_patient_speaker(utterances)

    if not patient_speaker:
        return normalize_text(" ".join(u["text"] for u in utterances))

    patient_lines = [u["text"] for u in utterances if u["speaker_id"] == patient_speaker]
    return normalize_text(" ".join(patient_lines))


def extract_symptoms_llm(patient_text: str) -> List[str]:
    llm_text = truncate_for_llm(patient_text)
    prompt = f"""
Extract only real patient symptoms from this text.

Rules:
- Return strict JSON only
- Use format: {{"symptoms": ["symptom1", "symptom2"]}}
- Only extract symptoms the patient EXPLICITLY states — do not infer, assume, or generalize
- Include symptoms as the patient described them (e.g. "sharp chest pain", not just "pain")
- No filler words or duplicates
- No explanation
- Maximum 8 symptoms
- If there are no clearly stated symptoms, return {{"symptoms": []}}

Text:
{llm_text}
"""

    try:
        response = _get_client().chat.completions.create(
            model=_get_chat_deployment(),
            messages=[
                {
                    "role": "system",
                    "content": "Extract only medically meaningful symptoms explicitly mentioned by the patient. Never infer or generalize. Return strict JSON."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0,
            max_completion_tokens=150,
            response_format={"type": "json_object"}
        )

        data = parse_llm_json(response.choices[0].message.content, "extract_symptoms_llm")
        if not data:
            return []
        symptoms = data.get("symptoms", [])

        if not isinstance(symptoms, list):
            return []

        cleaned: List[str] = []
        seen = set()

        for s in symptoms:
            item = normalize_text(str(s))
            item = re.sub(r"\b(\w+)( \1\b)+", r"\1", item).strip()
            if item and item not in seen:
                cleaned.append(item)
                seen.add(item)

        if cleaned:
            return cleaned[:8]

        return deterministic_symptom_fallback(patient_text)
    except Exception as e:
        logger.warning("extract_symptoms_llm failed: %s", e)
        return deterministic_symptom_fallback(patient_text)


def build_query(patient_text: str, symptoms: List[str], max_tokens: int = 32) -> str:
    base_tokens = tokenize(patient_text)[:max_tokens]
    merged = base_tokens + [normalize_text(s) for s in symptoms]
    final = []
    seen = set()

    for item in merged:
        if item and item not in seen:
            final.append(item)
            seen.add(item)

    return " ".join(final[:max_tokens + 8])


def is_admin_or_nonclinical_llm(patient_text: str) -> bool:
    prompt = f"""
Decide whether this text is NON-CLINICAL or ADMINISTRATIVE ONLY.

Examples:
- rescheduling appointment
- asking for report status
- general non-medical discussion
- no real symptoms

Return strict JSON only:
{{"admin_only": true}}

Text:
{patient_text}
"""

    try:
        response = _get_client().chat.completions.create(
            model=_get_chat_deployment(),
            messages=[
                {
                    "role": "system",
                    "content": "Classify whether the text is purely administrative and non-clinical."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0,
            max_completion_tokens=50,
            response_format={"type": "json_object"}
        )

        data = parse_llm_json(response.choices[0].message.content, "is_admin_or_nonclinical_llm")
        if not data:
            return False
        return bool(data.get("admin_only", False))
    except Exception as e:
        logger.warning("is_admin_or_nonclinical_llm failed: %s", e)
        return False


def choose_condition_with_reasoning(symptoms: List[str], top_matches: List[dict]) -> dict:
    prompt = f"""
You are a strict clinical reasoning system.

Given extracted patient symptoms and candidate conditions from an ICD-10 knowledge base, your job is to select the BEST matching condition — or decline if no strong match exists.

Evaluation rules:
- Match symptoms against conditions based on clinical meaning, NOT text similarity
- Reject ICD administrative codes, chapter headers, and generic/vague descriptions
- A condition is acceptable ONLY if the majority of the patient's symptoms are explained by it
- If confidence would be below 0.80, return "Doctor review required" — do not force a diagnosis
- Do not guess or hallucinate condition names

Return ONLY valid JSON:
{{
  "possible_condition": "...",
  "icd10_code": "...",
  "confidence": 0.0,
  "reason": "one-line clinical justification"
}}

Patient symptoms:
{json.dumps(symptoms)}

Candidate conditions:
{json.dumps(top_matches, indent=2)}
"""

    try:
        response = _get_client().chat.completions.create(
            model=_get_chat_deployment(),
            messages=[
                {"role": "system", "content": "You are a strict clinical reasoning AI. Prefer rejection over a wrong diagnosis. Never guess."},
                {"role": "user", "content": prompt}
            ],
            temperature=0,
            max_completion_tokens=400,
            response_format={"type": "json_object"}
        )

        data = parse_llm_json(response.choices[0].message.content, "choose_condition_with_reasoning")
        if not data:
            return {"possible_condition": "Doctor review required", "icd10_code": "N/A"}

        confidence = float(data.get("confidence", 0))
        condition = str(data.get("possible_condition", "Doctor review required")).strip()
        code = str(data.get("icd10_code", "N/A")).strip()

        if confidence < 0.80:
            return {"possible_condition": "Doctor review required", "icd10_code": "N/A"}

        if not condition or normalize_text(condition) in {"n/a", "none", "unknown", "doctor review required"}:
            return {"possible_condition": "Doctor review required", "icd10_code": "N/A"}

        return {
            "possible_condition": condition,
            "icd10_code": code if code else "N/A",
            "confidence": confidence,
        }

    except Exception as e:
        logger.warning("choose_condition_with_reasoning failed: %s", e, exc_info=True)
        return {"possible_condition": "Doctor review required", "icd10_code": "N/A"}


def generate_action_plan_llm(patient_text: str, condition: str, symptoms: List[str]) -> List[str]:
    prompt = f"""
Generate a short, safe, generic clinical action plan for a patient visit.

Rules:
- Return strict JSON only: {{"action_plan": ["item1", "item2", ...]}}
- Generate exactly 5 items when possible, as a numbered list with no headings
- Every item must include what to do, when to do it, and how to do it
- Items must be safe, generic, and appropriate for a general audience (not prescriptive)
- Do not invent details that are not supported by the transcript or symptoms
- Do not recommend specific medications, dosages, or treatments
- Do not use vague wording such as "monitor symptoms", "discuss lifestyle", or "schedule follow-up"
- Prefer explicit timing language such as "today", "twice daily", "before the lab test", or "within 24 to 72 hours"
- Do not prefix items with section headings like "Home monitoring:" or "Medication:"
- Each item should be a distinct action (no duplicates)
- No explanation outside JSON

Patient text:
{patient_text}

Possible condition:
{condition}

Symptoms:
{json.dumps(symptoms, ensure_ascii=False)}
"""

    try:
        response = _get_client().chat.completions.create(
            model=_get_action_plan_deployment(),
            messages=[
                {
                    "role": "system",
                    "content": "Generate 5 short, safe, non-prescriptive action plan items with explicit timing and return strict JSON."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0,
            max_completion_tokens=600,
            response_format={"type": "json_object"}
        )

        data = parse_llm_json(response.choices[0].message.content, "generate_action_plan_llm")
        if not data:
            return DEFAULT_ACTION_PLAN
        plan = data.get("action_plan", [])

        if not isinstance(plan, list):
            return DEFAULT_ACTION_PLAN

        cleaned = []
        seen = set()

        for item in plan:
            text = _normalize_action_plan_item(item)
            if text and text not in seen:
                cleaned.append(text)
                seen.add(text)

        if cleaned:
            return cleaned[:5]

        return DEFAULT_ACTION_PLAN
    except Exception as e:
        logger.warning("generate_action_plan_llm failed: %s", e, exc_info=True)
        return DEFAULT_ACTION_PLAN


def build_clinical_summary(symptoms: List[str], final_condition: str, reference_condition: str, is_reference_only: bool) -> str:
    if is_reference_only:
        if symptoms:
            return (
                f"Patient reports {', '.join(symptoms)}. Retrieved reference: {reference_condition}. "
                f"Confidence was insufficient for a diagnosis from the current knowledge base."
            )
        return f"Retrieved reference: {reference_condition}. Confidence was insufficient for a diagnosis from the current knowledge base."

    if symptoms:
        return f"Patient reports {', '.join(symptoms)} which may indicate {final_condition}."

    return f"Patient text may indicate {final_condition}."


def run_rag_pipeline(transcript_text: str) -> dict:
    started_at = time.monotonic()
    patient_text = extract_patient_text(transcript_text)

    if not patient_text.strip():
        return {
            "symptoms": [],
            "possible_condition": "Doctor review required",
            "icd10_code": "N/A",
            "action_plan": [],
            "clinical_summary": "Transcript is empty or invalid."
        }

    # ── Parallel stage 1: admin-check + symptom-extraction run concurrently ─────
    # Previously sequential (~6-10s total); now ~3-5s (whichever is slower).
    stage_started = time.monotonic()
    with ThreadPoolExecutor(max_workers=2) as pool:
        f_admin    = pool.submit(is_admin_or_nonclinical_llm, patient_text)
        f_symptoms = pool.submit(extract_symptoms_llm, patient_text)
        try:
            is_admin = f_admin.result(timeout=12)
        except Exception as e:
            logger.warning("admin_check timed out or failed: %s — treating as clinical", e)
            is_admin = False
        try:
            symptoms = f_symptoms.result(timeout=12)
        except Exception as e:
            logger.warning("symptom_extraction timed out or failed: %s — returning empty", e)
            symptoms = deterministic_symptom_fallback(patient_text)

    if is_admin:
        return {
            "symptoms": [],
            "possible_condition": "Doctor review required",
            "icd10_code": "N/A",
            "action_plan": [],
            "clinical_summary": "The conversation is administrative or does not contain clinically useful symptoms."
        }
    _emit_socket_log("summarizer", "admin_check + symptom_extraction completed (parallel)")
    logger.info("RAG stage admin+symptoms completed in %.2fs", time.monotonic() - stage_started)
    query = build_query(patient_text, symptoms)
    stage_started = time.monotonic()
    try:
        results = retrieve_top_k(query, top_k=5)
    except Exception as e:
        logger.warning("retrieve_top_k failed; using deterministic ICD fallback: %s", e)
        fallback = clinical_icd10_fallback(patient_text, symptoms)
        final_condition = f"Reference only: {fallback['possible_condition']}"
        return {
            "symptoms": symptoms,
            "possible_condition": final_condition,
            "icd10_code": fallback["icd10_code"],
            "action_plan": DEFAULT_ACTION_PLAN,
            "clinical_summary": build_clinical_summary(
                symptoms,
                final_condition,
                fallback["possible_condition"],
                True,
            ),
            "diagnosis_status": "low_confidence_reference_only"
        }
    _emit_socket_log("summarizer", "retrieval completed")
    logger.info("RAG stage retrieval completed in %.2fs", time.monotonic() - stage_started)

    docs = results.get("value", [])
    if not docs:
        fallback = clinical_icd10_fallback(patient_text, symptoms)
        final_condition = f"Reference only: {fallback['possible_condition']}"
        return {
            "symptoms": symptoms,
            "possible_condition": final_condition,
            "icd10_code": fallback["icd10_code"],
            "action_plan": generate_action_plan_llm(patient_text, final_condition, symptoms),
            "clinical_summary": build_clinical_summary(
                symptoms,
                final_condition,
                fallback["possible_condition"],
                True,
            ),
            "diagnosis_status": "low_confidence_reference_only"
        }

    top_matches = [
        {
            "condition": doc.get("condition", ""),
            "icd10_code": doc.get("icd_code", "") or doc.get("icd10_code", ""),
            "description": doc.get("description", ""),
            "score": doc.get("_final_score", doc.get("@search.score", 0)),
            "semantic_score": doc.get("_semantic_score", 0)
        }
        for doc in docs
    ]

    # ── Parallel stage 2: condition-reasoning + action-plan run concurrently ────
    # action_plan uses symptoms + patient_text which are already known; we can
    # start generating it with a placeholder condition and replace if needed.
    # This saves ~4-6s vs waiting for reasoning to finish first.
    stage_started = time.monotonic()
    fallback = clinical_icd10_fallback(patient_text, symptoms, top_matches)
    top_reference = top_matches[0] if top_matches else {}
    reference_condition = fallback.get("possible_condition") or top_reference.get("condition", DEFAULT_CLINICAL_CONDITION)
    reference_code = fallback.get("icd10_code") or top_reference.get("icd10_code", DEFAULT_CLINICAL_ICD10)

    with ThreadPoolExecutor(max_workers=2) as pool:
        f_reasoning   = pool.submit(choose_condition_with_reasoning, symptoms, top_matches)
        # Start action plan with fallback condition; will be replaced below if
        # reasoning returns a confident condition.
        f_action_plan = pool.submit(generate_action_plan_llm, patient_text, reference_condition, symptoms)
        try:
            chosen = f_reasoning.result(timeout=25)
        except Exception as e:
            logger.warning("condition_reasoning timed out or failed: %s", e)
            chosen = {"possible_condition": "Doctor review required", "icd10_code": "N/A"}
        try:
            action_plan_prefetch = f_action_plan.result(timeout=25)
        except Exception as e:
            logger.warning("action_plan prefetch timed out: %s", e)
            action_plan_prefetch = DEFAULT_ACTION_PLAN

    _emit_socket_log("summarizer", "condition_reasoning + action_plan completed (parallel)")
    logger.info("RAG stage reasoning+action completed in %.2fs", time.monotonic() - stage_started)

    confident_condition = chosen.get("possible_condition", "Doctor review required")
    confident_code = chosen.get("icd10_code", "N/A")


    fallback = clinical_icd10_fallback(patient_text, symptoms, top_matches)
    top_reference = top_matches[0] if top_matches else {}
    reference_condition = fallback.get("possible_condition") or top_reference.get("condition", DEFAULT_CLINICAL_CONDITION)
    reference_code = fallback.get("icd10_code") or top_reference.get("icd10_code", DEFAULT_CLINICAL_ICD10)


    is_reference_only = normalize_text(confident_condition) == "doctor review required"

    if is_reference_only:
        final_condition = (
            f"Reference only: {reference_condition}"
            if reference_condition and reference_condition != "N/A"
            else f"Reference only: {DEFAULT_CLINICAL_CONDITION}"
        )
        final_code = reference_code if is_usable_icd10_code(reference_code) else fallback["icd10_code"]
        # Reuse action plan generated for the reference condition
        action_plan = action_plan_prefetch
    else:
        final_condition = confident_condition
        final_code = confident_code if is_usable_icd10_code(confident_code) else fallback["icd10_code"]
        if normalize_text(final_condition) != normalize_text(reference_condition):
            # Reasoning returned a different condition — regenerate action plan for accuracy
            stage_started = time.monotonic()
            action_plan = generate_action_plan_llm(patient_text, final_condition, symptoms)
            logger.info("RAG action_plan regenerated in %.2fs", time.monotonic() - stage_started)
        else:
            action_plan = action_plan_prefetch

    clinical_summary = build_clinical_summary(symptoms, final_condition, reference_condition, is_reference_only)

    output = {
        "symptoms": symptoms,
        "possible_condition": final_condition,
        "icd10_code": final_code,
        "action_plan": action_plan,
        "clinical_summary": clinical_summary
    }

    if symptoms and not is_usable_icd10_code(output.get("icd10_code")):
        fallback = clinical_icd10_fallback(patient_text, symptoms, top_matches)
        output["icd10_code"] = fallback["icd10_code"]
        if normalize_text(str(output.get("possible_condition", ""))) in {
            "doctor review required",
            "reference only: n/a",
            "reference only: doctor review required",
        } or is_generic_reference(str(output.get("possible_condition", ""))):
            output["possible_condition"] = f"Reference only: {fallback['possible_condition']}"
        output["diagnosis_status"] = "low_confidence_reference_only"

    if is_reference_only:
        output["diagnosis_status"] = "low_confidence_reference_only"


    _emit_socket_log("summarizer", "pipeline completed")
    logger.info("RAG pipeline completed in %.2fs", time.monotonic() - started_at)

    return output
