# agent/summarizer_agent.py
from mcp.mcp_server import run_mcp_pipeline


class SummarizerAgent:
    def __init__(self, prompt_path):
        with open(prompt_path, "r", encoding="utf-8") as f:
            self.instructions = f.read()

    def process_text(self, transcript: str):
        return run_mcp_pipeline(transcript)
        # Step 1: symptom extraction
        step1 = call_tool("symptom_extractor", transcript)
        symptoms = step1.get("symptoms", [])

        if not symptoms:
            return {
                "symptoms": [],
                "possible_condition": "N/A",
                "icd10_code": "N/A",
                "action_plan": [],
                "clinical_summary": "No clinical symptoms detected in the conversation.",
                "status": "no_symptoms_detected"
            }

        # Step 2: KB
        step2 = call_tool("knowledge_base", symptoms)

        # Step 3: report
        result = call_tool(
            "report_generator",
            (symptoms, step2["possible_condition"], step2["icd10_code"])
        )

        result["status"] = "success"
        return result