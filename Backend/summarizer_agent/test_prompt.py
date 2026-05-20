def test_symptom_extraction():

    # Example doctor-patient conversation
    conversation = """
    Patient: I have fever and dry cough for 2 days.
    Doctor: Any headache?
    Patient: Yes mild headache.
    """

    # Prompt used for the summariser agent
    prompt = f"""
You are a clinical AI assistant.

Extract only the medical symptoms from the doctor-patient conversation.

Rules:
- Ignore filler words (patient, doctor, yes, no)
- Combine meaningful phrases (dry cough, chest pain)
- Return only symptoms

Output format:
{{
  "symptoms": []
}}

Conversation:
{conversation}
"""

    print("\n--- PROMPT SENT TO MODEL ---\n")
    print(prompt)

    # Mock model response (simulating LLM output)
    result = {
        "symptoms": ["fever", "dry cough", "headache"]
    }

    print("\n--- MODEL OUTPUT ---\n")
    print(result)


if __name__ == "__main__":
    test_symptom_extraction()