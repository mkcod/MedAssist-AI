import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from mcp.server.fastmcp import FastMCP
from storage.ehr_store import EHRStore
from tools.guardrails_tool import guardrails_check, output_guardrails_check
from tools.validation_tool import validate_soap_output
from tools.soap_tool import build_demo_soap, build_doctor_document
from tools.document_tool import save_soap_document

mcp = FastMCP("MedAssist-Tools")
store = EHRStore()


@mcp.tool()
def guardrails_check_tool(input_text: str) -> str:
    return guardrails_check(input_text)


@mcp.tool()
def output_guardrails_check_tool(output_text: str) -> str:
    return output_guardrails_check(output_text)


@mcp.tool()
def validate_soap_output_tool(output_text: str) -> str:
    return validate_soap_output(output_text)


@mcp.tool()
def build_demo_soap_tool(payload_json: str) -> str:
    payload = json.loads(payload_json)
    return json.dumps(build_demo_soap(payload), ensure_ascii=False)


@mcp.tool()
def build_doctor_document_tool(soap_json: str) -> str:
    data = json.loads(soap_json)
    return build_doctor_document(data)


@mcp.tool()
def save_soap_document_tool(soap_json: str) -> str:
    return save_soap_document(soap_json)


@mcp.tool()
def publish_soap_record_tool(soap_json: str) -> str:
    data = json.loads(soap_json)
    result = store.publish(data)
    return json.dumps(result, ensure_ascii=False)


if __name__ == "__main__":
    #print("MCP server running...")
    mcp.run(transport="stdio")