import json
import os
import re

from tools.symptom_extractor import extract_symptoms
from tools.knowledge_base import search_disease
from tools.report_generator import generate_report

SAMPLES_DIR = "samples"

INVALID_TERMS = {"doctor", "patient", "yes", "no", "symptom", "symptoms"}

# adjust if your diarization changes
PATIENT_SPEAKER_ID = "speaker_1"
DOCTOR_SPEAKER_ID = "speaker_2"


def load_sample(file_path: str):
    with open(file_path, "r", encoding="utf-8") as f:
        return f.read()


def get_patient_text_from_json(raw_text: str) -> str:
    payload = json.loads(raw_text)
    utterances = payload.get("transcript", {}).get("utterances", [])

    patient_texts = []
    for utt in utterances:
        speaker_id = str(utt.get("speaker_id", "")).strip().lower()
        text = str(utt.get("text", "")).strip().lower()

        if speaker_id == PATIENT_SPEAKER_ID:
            patient_texts.append(text)

    return " ".join(patient_texts)


def validate_json_structure(report_dict: dict):
    required_keys = {
        "symptoms",
        "possible_condition",
        "icd10_code",
        "action_plan",
        "clinical_summary",
    }

    missing = required_keys - set(report_dict.keys())
    if missing:
        raise AssertionError(f"Missing JSON keys: {missing}")

    if not isinstance(report_dict["symptoms"], list):
        raise AssertionError("'symptoms' must be a list")

    if not isinstance(report_dict["possible_condition"], str):
        raise AssertionError("'possible_condition' must be a string")

    if not isinstance(report_dict["icd10_code"], str):
        raise AssertionError("'icd10_code' must be a string")

    if not isinstance(report_dict["action_plan"], list):
        raise AssertionError("'action_plan' must be a list")

    if not isinstance(report_dict["clinical_summary"], str):
        raise AssertionError("'clinical_summary' must be a string")


def validate_symptom_quality(symptoms: list, patient_text: str):
    for symptom in symptoms:
        if not isinstance(symptom, str):
            raise AssertionError(f"Symptom is not string: {symptom}")

        if symptom.lower() in INVALID_TERMS:
            raise AssertionError(f"Invalid symptom term found: {symptom}")

        # symptom should be present in patient text OR allowed alias outcome
        allowed_alias_outputs = {
            "shortness of breath",
            "chest tightness",
            "cough",
            "chest pain",
            "sore throat",
        }

        if symptom.lower() not in patient_text and symptom.lower() not in allowed_alias_outputs:
            raise AssertionError(
                f"Symptom '{symptom}' not found in patient text and not in allowed alias outputs"
            )

        # negation validation
        neg_pattern = rf"\b(no|not|without)\s+{re.escape(symptom.lower())}\b"
        if re.search(neg_pattern, patient_text):
            raise AssertionError(f"Negated symptom incorrectly extracted: {symptom}")


def run_pipeline(raw_input: str):
    symptoms = extract_symptoms(raw_input)
    disease, code = search_disease(symptoms)
    report = generate_report(symptoms, disease, code)

    if isinstance(report, str):
        report_dict = json.loads(report)
    else:
        report_dict = report

    return symptoms, report_dict


def test_single_file(file_name: str):
    file_path = os.path.join(SAMPLES_DIR, file_name)
    raw_text = load_sample(file_path)

    # Ensure valid JSON input format
    payload = json.loads(raw_text)
    if "transcript" not in payload or "utterances" not in payload["transcript"]:
        raise AssertionError("Invalid transcript format")

    patient_text = get_patient_text_from_json(raw_text)

    symptoms, report_dict = run_pipeline(raw_text)

    validate_json_structure(report_dict)
    validate_symptom_quality(symptoms, patient_text)

    print(f"PASS: {file_name}")
    print(json.dumps(report_dict, indent=4))
    print("-" * 60)


def run_all_tests():
    files = [
        f for f in os.listdir(SAMPLES_DIR)
        if f.lower().endswith(".txt")
    ]

    if not files:
        print("No sample files found in samples/ folder")
        return

    passed = 0
    failed = 0

    for file_name in files:
        try:
            test_single_file(file_name)
            passed += 1
        except Exception as e:
            failed += 1
            print(f"FAIL: {file_name}")
            print(f"Reason: {str(e)}")
            print("-" * 60)

    print(f"\nE2E Testing Completed → Passed: {passed}, Failed: {failed}")


if __name__ == "__main__":
    run_all_tests()