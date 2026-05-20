import json
from pathlib import Path
from typing import Any
import uuid

from config.settings import settings
from storage.ehr_store import EHRStore

from openai import OpenAI
try:
    from agent_framework.mcp import MCPStdioTool
except (ModuleNotFoundError, ImportError):
    from agent_framework._mcp import MCPStdioTool


class PublishingAgent:
    def __init__(self, prompt_path: Path):
        self.instructions = prompt_path.read_text(encoding="utf-8")
        self.store = EHRStore()

        self.client = OpenAI(
            base_url=f"{settings.azure_openai_endpoint}/openai/v1/",
            api_key=settings.azure_openai_api_key,
        )

        self.mcp_server = MCPStdioTool(
            name="MedAssist-Tools",
            command=settings.mcp_command,
            args=settings.mcp_args,
            load_tools=True,
            load_prompts=False,
        )

    def _mcp_result_to_text(self, value: Any) -> str:
        if isinstance(value, (bytes, bytearray)):
            return value.decode("utf-8")
        if isinstance(value, str):
            return value
        if isinstance(value, (list, tuple)):
            return self._mcp_result_to_text(value[0])
        if isinstance(value, dict):
            for key in ("text", "output_text", "result", "data", "content"):
                if key in value:
                    return self._mcp_result_to_text(value[key])
        return str(value)

    def _mcp_result_to_json(self, value: Any) -> dict:
        return json.loads(self._mcp_result_to_text(value))

    def _normalize_keys(self, data: dict) -> dict:
        if "record_id" in data:
            data["recordId"] = data.pop("record_id")
        if "patient_id" in data:
            data["patientId"] = data.pop("patient_id")
        if "confidence_score" in data:
            data["confidenceScore"] = data.pop("confidence_score")
        if "approval_status" in data:
            data["approvalStatus"] = data.pop("approval_status")
        return data

    async def process(self, payload: dict) -> dict:
        async with self.mcp_server:

            safe = await self.mcp_server.call_tool(
                "guardrails_check_tool",
                input_text=json.dumps(payload)
            )
            safe_data = self._mcp_result_to_json(safe)

            if safe_data.get("status") != "safe":
                return {"status": "blocked", "reason": safe_data.get("reason")}

            response = self.client.responses.create(
                model=settings.azure_openai_deployment,
                input=json.dumps(payload)
            )

            try:
                text = response.output[0].content[0].text
                data = json.loads(text)
            except Exception:
                demo = await self.mcp_server.call_tool(
                    "build_demo_soap_tool",
                    payload_json=json.dumps(payload)
                )
                data = self._mcp_result_to_json(demo)

            data = self._normalize_keys(data)

            # ✅ NEW: ensure IDs exist
            if not data.get("recordId"):
                data["recordId"] = f"SOAP-{uuid.uuid4().hex[:8].upper()}"

            if not data.get("patientId"):
                data["patientId"] = "UNKNOWN"

            validated = await self.mcp_server.call_tool(
                "validate_soap_output_tool",
                output_text=json.dumps(data)
            )
            validation = self._mcp_result_to_json(validated)

            if validation.get("status") != "valid":
                return {"status": "error", "reason": validation.get("reason")}

            return {"status": "success", "data": data}

    async def publish(self, soap_record: dict) -> dict:
        async with self.mcp_server:
            result = await self.mcp_server.call_tool(
                "publish_soap_record_tool",
                soap_json=json.dumps(soap_record)
            )
            return self._mcp_result_to_json(result)

    async def generate_document_with_tool(self, soap_record: dict) -> dict:
        async with self.mcp_server:
            result = await self.mcp_server.call_tool(
                "save_soap_document_tool",
                soap_json=json.dumps(soap_record)
            )
            return self._mcp_result_to_json(result)