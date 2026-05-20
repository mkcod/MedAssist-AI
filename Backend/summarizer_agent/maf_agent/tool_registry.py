from tools.symptom_extractor import extract_symptoms
from tools.knowledge_base import search_disease
from tools.report_generator import generate_report


def symptom_tool(conversation: str):

    symptoms = extract_symptoms(conversation)

    return {"symptoms": symptoms}


def disease_tool(symptoms: list):

    disease, code = search_disease(symptoms)

    return {
        "possible_condition": disease,
        "icd10_code": code
    }


def report_tool(symptoms: list, disease: str, code: str):

    return generate_report(symptoms, disease, code)


def get_tools():

    return [
        symptom_tool,
        disease_tool,
        report_tool
    ]