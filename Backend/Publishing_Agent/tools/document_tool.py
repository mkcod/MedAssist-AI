import json
from typing import Annotated

from pydantic import Field

from storage.document_store import DocumentStore
from tools.soap_tool import build_doctor_document

try:
    from agent_framework import tool
except Exception:
    def tool(*args, **kwargs):
        def decorator(fn):
            return fn
        return decorator


document_store = DocumentStore("output")


@tool(
    name="save_soap_document",
    description="Generate and save a doctor-readable SOAP text document to output/<record_id>.txt from a validated SOAP JSON record.",
    approval_mode="never_require",
)
def save_soap_document(
    soap_record_json: Annotated[
        str,
        Field(description="Validated SOAP record in JSON string format.")
    ]
) -> str:
    try:
        soap_record = json.loads(soap_record_json)
    except Exception as e:
        return json.dumps({
            "status": "error",
            "reason": f"Invalid JSON passed to save_soap_document: {e}"
        })

    try:
        doc_text = build_doctor_document(soap_record)
        result = document_store.save_document(doc_text, soap_record)
        return json.dumps(result)
    except Exception as e:
        return json.dumps({
            "status": "error",
            "reason": f"Document generation/storage failed: {e}"
        })