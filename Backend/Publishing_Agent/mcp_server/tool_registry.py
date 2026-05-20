import json
from tools.guardrails_tool import guardrails_check, output_guardrails_check
from tools.validation_tool import validate_soap_output
from tools.soap_tool import build_demo_soap, build_doctor_document
from tools.document_tool import save_soap_document

def get_tool_registry():
    return {
        "guardrails_check_tool": {
            "handler": guardrails_check,
            "description": "Inspect input for prompt injection, unsafe content, or policy violations.",
        },
        "output_guardrails_check_tool": {
            "handler": output_guardrails_check,
            "description": "Validate generated output for unsafe or disallowed content.",
        },
        "validate_soap_output_tool": {
            "handler": validate_soap_output,
            "description": "Validate SOAP JSON for required structure, safety, and completeness.",
        },
        "build_demo_soap_tool": {
            "handler": _build_demo_soap_handler,
            "description": "Generate fallback/demo SOAP JSON from structured payload input.",
        },
        "build_doctor_document_tool": {
            "handler": _build_doctor_document_handler,
            "description": "Build doctor-readable SOAP text from validated SOAP JSON.",
        },
        "save_soap_document_tool": {
            "handler": save_soap_document,
            "description": "Generate and store a doctor-readable SOAP document from validated SOAP JSON.",
        },
    }

def _build_demo_soap_handler(payload_text: str) -> str:
    try:
        payload = json.loads(payload_text)
        result = build_demo_soap(payload)
        return json.dumps(result, ensure_ascii=False)
    except Exception as e:
        return json.dumps(
            {
                "status": "error",
                "reason": f"Failed to build demo SOAP: {e}",
            },
            ensure_ascii=False,
        )

def _build_doctor_document_handler(payload_text: str) -> str:
    try:
        soap_record = json.loads(payload_text)
        return build_doctor_document(soap_record)
    except Exception as e:
        return json.dumps(
            {
                "status": "error",
                "reason": f"Failed to build doctor document: {e}",
            },
            ensure_ascii=False,
        )

def execute_registered_tool(name: str, arguments):
    registry = get_tool_registry()

    if name not in registry:
        return json.dumps(
            {
                "status": "error",
                "reason": f"Unknown tool: {name}",
            },
            ensure_ascii=False,
        )

    handler = registry[name]["handler"]

    if isinstance(arguments, dict):
        payload = json.dumps(arguments, ensure_ascii=False)
    else:
        payload = str(arguments)

    try:
        return handler(payload)
    except Exception as e:
        return json.dumps(
            {
                "status": "error",
                "reason": f"Tool execution failed for {name}: {e}",
            },
            ensure_ascii=False,
        )