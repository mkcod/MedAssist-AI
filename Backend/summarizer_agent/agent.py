import json
import os
import time

from tools.symptom_extractor import (
    extract_symptoms,
    extract_patient_text,
    detect_admin_only_conversation,
    requires_doctor_review,
)
from tools.knowledge_base import search_disease
from tools.report_generator import generate_report


def run_agent():
    start_time = time.time()

    file_name = input("Upload doctor-patient conversation file: ").strip()

    if not file_name:
        raise ValueError("No input file name provided.")

    file_path = os.path.join("samples", file_name)

    if not os.path.exists(file_path):
        raise FileNotFoundError("Input file not found.")

    with open(file_path, "r", encoding="utf-8") as f:
        conversation = f.read().strip()

    if not conversation:
        raise ValueError("Input file is empty.")

    patient_text = extract_patient_text(conversation)
    symptoms = extract_symptoms(conversation)

    # Edge case 1: appointment/test-only conversation
    if detect_admin_only_conversation(patient_text):
        result = {
            "symptoms": [],
            "possible_condition": "N/A",
            "icd10_code": "N/A",
            "action_plan": [],
            "clinical_summary": "No clinical symptoms detected in the conversation.",
            "status": "no_symptoms_detected",
            "execution_time_sec": round(time.time() - start_time, 2)
        }
        print(json.dumps(result, indent=4))
        with open("agent_output.json", "w", encoding="utf-8") as out_file:
            json.dump(result, out_file, indent=4)
        return

    # Edge case 2: ambiguous / unmatched complaint
    if requires_doctor_review(patient_text, symptoms):
        result = {
            "symptoms": [],
            "possible_condition": "Doctor Review Required",
            "icd10_code": "N/A",
            "action_plan": [],
            "clinical_summary": "Symptoms could not be matched confidently with the current knowledge base.",
            "status": "doctor_review_required",
            "execution_time_sec": round(time.time() - start_time, 2)
        }
        print(json.dumps(result, indent=4))
        with open("agent_output.json", "w", encoding="utf-8") as out_file:
            json.dump(result, out_file, indent=4)
        return

    if not symptoms:
        if patient_text.strip():
            result = {
                "symptoms": [],
                "possible_condition": "Doctor Review Required",
                "icd10_code": "N/A",
                "action_plan": [],
                "clinical_summary": "Symptoms could not be matched confidently with the current knowledge base.",
                "status": "doctor_review_required",
                "execution_time_sec": round(time.time() - start_time, 2)
            }

            print(json.dumps(result, indent=4))

            with open("agent_output.json", "w", encoding="utf-8") as out_file:
                json.dump(result, out_file, indent=4)

            return

        raise ValueError("No symptoms detected from input.")

    disease, code = search_disease(symptoms)
    report = generate_report(symptoms, disease, code)
    parsed_report = json.loads(report)

    parsed_report["execution_time_sec"] = round(time.time() - start_time, 2)

    print(json.dumps(parsed_report, indent=4))

    with open("agent_output.json", "w", encoding="utf-8") as out_file:
        json.dump(parsed_report, out_file, indent=4)