import json
from tools.symptom_extractor import extract_symptoms

conversation = """
Doctor: What are you feeling today?
Patient: I have fever and headache since yesterday.
Doctor: Do you have cough?
Patient: Yes mild cough.
Doctor: Any chest pain?
Patient: No chest pain.
"""

symptoms = extract_symptoms(conversation)

result = {
    "symptoms": symptoms
}

print(json.dumps(result, indent=4))