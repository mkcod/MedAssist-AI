import json

import pytest
from Backend.summarizer_agent import rag_pipeline as rp


def test_extract_symptoms_llm_falls_back_on_timeout(monkeypatch):
    class FailingCompletions:
        @staticmethod
        def create(*args, **kwargs):
            raise TimeoutError("Request timed out")

    class FailingChat:
        completions = FailingCompletions()

    class FailingClient:
        chat = FailingChat()

    monkeypatch.setattr(rp, "_get_client", lambda: FailingClient())
    monkeypatch.setattr(rp, "_get_chat_deployment", lambda: "dummy-deployment")

    symptoms = rp.extract_symptoms_llm("Patient says I have fever and headache since yesterday.")

    assert symptoms == ["fever", "headache"]


def test_generate_action_plan_llm_falls_back_on_timeout(monkeypatch):
    class FailingCompletions:
        @staticmethod
        def create(*args, **kwargs):
            raise TimeoutError("Request timed out")

    class FailingChat:
        completions = FailingCompletions()

    class FailingClient:
        chat = FailingChat()

    monkeypatch.setattr(rp, "_get_client", lambda: FailingClient())
    monkeypatch.setattr(rp, "_get_chat_deployment", lambda: "dummy-deployment")

    plan = rp.generate_action_plan_llm("Patient says I have fever", "Reference only: Fever", ["fever"])

    assert plan == rp.DEFAULT_ACTION_PLAN


def test_generate_action_plan_llm_uses_override_deployment(monkeypatch):
    captured = {}
    response_content = {
        "action_plan": [
            "Home monitoring: Check your symptom twice daily today and write down changes.",
            "Lab tests: Complete the ordered lab test on the date given and follow fasting instructions.",
            "Medication: Take only prescribed medicine at the exact time on the label today.",
            "Doctor visit: Book a clinic review within 24 to 72 hours if symptoms worsen.",
            "Lifestyle: Follow the care team's diet advice and ask a dietitian if you need meal planning help.",
        ]
    }

    class SuccessfulCompletions:
        @staticmethod
        def create(*args, **kwargs):
            captured["model"] = kwargs.get("model")
            captured["messages"] = kwargs.get("messages")

            class Response:
                choices = [type("Choice", (), {"message": type("Message", (), {"content": json.dumps(response_content)})()})]

            return Response()

    class SuccessfulChat:
        completions = SuccessfulCompletions()

    class SuccessfulClient:
        chat = SuccessfulChat()

    monkeypatch.setenv("AZURE_OPENAI_ACTION_PLAN_DEPLOYMENT", "action-plan-deployment")
    monkeypatch.setattr(rp, "ACTION_PLAN_DEPLOYMENT", None)
    monkeypatch.setattr(rp, "_get_client", lambda: SuccessfulClient())
    monkeypatch.setattr(rp, "_get_chat_deployment", lambda: "chat-deployment")

    plan = rp.generate_action_plan_llm("Patient says I have fever", "Reference only: Fever", ["fever"])

    assert captured["model"] == "action-plan-deployment"
    assert any("home monitoring" in msg["content"].lower() for msg in captured["messages"])
    assert any("when to do it" in msg["content"].lower() for msg in captured["messages"])
    assert len(plan) == 5


def test_generate_action_plan_llm_strips_section_headings(monkeypatch):
    class SuccessfulCompletions:
        @staticmethod
        def create(*args, **kwargs):
            class Response:
                choices = [type("Choice", (), {"message": type("Message", (), {"content": json.dumps({
                    "action_plan": [
                        {"home_monitoring": "Home monitoring: Record headache frequency twice daily today."},
                        {"lab_tests": "1. Lab tests: Arrange a blood test within 24 to 72 hours."},
                        {"medication": "- Medication: Use only prescribed medicine exactly as directed."},
                        {"doctor_visit": "Doctor visit: Book a review within one week if headaches continue."},
                        {"lifestyle": "Lifestyle: Start a regular sleep schedule immediately and ask a dietitian if needed."},
                    ]
                })})()})]

            return Response()

    class SuccessfulChat:
        completions = SuccessfulCompletions()

    class SuccessfulClient:
        chat = SuccessfulChat()

    monkeypatch.setattr(rp, "ACTION_PLAN_DEPLOYMENT", None)
    monkeypatch.setattr(rp, "_get_client", lambda: SuccessfulClient())
    monkeypatch.setattr(rp, "_get_chat_deployment", lambda: "chat-deployment")

    plan = rp.generate_action_plan_llm("Patient says I have headaches", "Reference only: Headache", ["headache"])

    assert len(plan) == 5
    assert all(not item.lower().startswith(("home monitoring", "lab tests", "medication", "doctor visit", "lifestyle")) for item in plan)
    assert plan[0].startswith("Record headache frequency")


def test_fallback_on_retrieval_error(monkeypatch):
    # Make retrieval raise an exception to force deterministic fallback
    monkeypatch.setattr(rp, "retrieve_top_k", lambda q, top_k=5: (_ for _ in ()).throw(Exception("search error")))
    monkeypatch.setattr(rp, "extract_symptoms_llm", lambda text: ["fever"]) 
    monkeypatch.setattr(rp, "is_admin_or_nonclinical_llm", lambda text: False)

    out = rp.run_rag_pipeline("Patient says I have fever and cough")
    assert "diagnosis_status" in out
    assert out["diagnosis_status"] == "low_confidence_reference_only"
    assert out["action_plan"] == rp.DEFAULT_ACTION_PLAN


def test_successful_retrieval_and_reasoning(monkeypatch):
    # Provide a simple retrieval result and mock reasoning + action plan
    dummy_docs = [{
        "condition": "Test Condition",
        "icd_code": "A01",
        "description": "Test description",
        "@search.score": 1.0
    }]

    monkeypatch.setattr(rp, "retrieve_top_k", lambda q, top_k=5: {"value": dummy_docs})
    monkeypatch.setattr(rp, "extract_symptoms_llm", lambda text: ["fever"])
    monkeypatch.setattr(rp, "is_admin_or_nonclinical_llm", lambda text: False)
    monkeypatch.setattr(rp, "choose_condition_with_reasoning", lambda symptoms, matches: {"possible_condition": "Test Condition", "icd10_code": "A01", "confidence": 0.9})
    monkeypatch.setattr(rp, "generate_action_plan_llm", lambda patient_text, condition, symptoms: ["rest", "drink fluids"]) 

    out = rp.run_rag_pipeline("I have fever")
    assert out["possible_condition"] in {"Test Condition", f"Reference only: Test Condition"}
    assert out["icd10_code"] == "A01"
    assert out["action_plan"] == ["rest", "drink fluids"]


def test_compact_retrieval_code_is_normalized_and_used(monkeypatch):
    dummy_docs = [{
        "condition": "Pain in throat",
        "icd_code": "R070",
        "description": "Throat pain",
        "@search.score": 1.0
    }]

    monkeypatch.setattr(rp, "retrieve_top_k", lambda q, top_k=5: {"value": dummy_docs})
    monkeypatch.setattr(rp, "extract_symptoms_llm", lambda text: ["throat irritation", "mild cough"])
    monkeypatch.setattr(rp, "is_admin_or_nonclinical_llm", lambda text: False)
    monkeypatch.setattr(rp, "choose_condition_with_reasoning", lambda symptoms, matches: {"possible_condition": "Doctor review required", "icd10_code": "N/A"})
    monkeypatch.setattr(rp, "generate_action_plan_llm", lambda patient_text, condition, symptoms: rp.DEFAULT_ACTION_PLAN)

    out = rp.run_rag_pipeline("I have throat irritation and mild cough")

    assert out["possible_condition"] == "Reference only: Pain in throat"
    assert out["icd10_code"] == "R07.0"
    assert "Retrieved reference: Pain in throat" in out["clinical_summary"]
