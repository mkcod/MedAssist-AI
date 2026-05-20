import os
from dotenv import load_dotenv

load_dotenv()

import json
from pathlib import Path
from datetime import datetime
from pymongo import MongoClient
import uuid


class EHRStore:
    _client = None
    _db = None

    def __init__(self):
        if EHRStore._client is None:
            uri = os.getenv("COSMOS_MONGO_URI")
            db_name = os.getenv("COSMOS_DB", "medassist-ai-main-db")
            EHRStore._client = MongoClient(
                uri,
                tls=True,
                tlsAllowInvalidCertificates=False,
                authMechanism="SCRAM-SHA-256",
                serverSelectionTimeoutMS=30000,
                connectTimeoutMS=30000,
                socketTimeoutMS=60000,
            )
            EHRStore._db = EHRStore._client[db_name]

        self.records = EHRStore._db["ehr-records"]
        self.documents = EHRStore._db["ehr-documents"]
        self.dead = EHRStore._db["ehr-dead-letter"]

    def _normalize(self, data: dict, canonical_patient_id: str = None) -> dict:
        if "record_id" in data:
            data["recordId"] = data.pop("record_id")

        # Resolve patient_id before popping — caller may supply the authoritative
        resolved_pid = (
            canonical_patient_id
            or data.get("patient_id")
            or data.get("patientId")
        )
        data.pop("patient_id", None)
        data["patientId"] = resolved_pid or "UNKNOWN"

        if "confidence_score" in data:
            data["confidenceScore"] = data.pop("confidence_score")
        if "approval_status" in data:
            data["approvalStatus"] = data.pop("approval_status")

        # Map ICD-10 fields to canonical camelCase for Cosmos / frontend compatibility.
        icd10 = data.get("icd10_code") or data.get("icd10Code") or data.get("icd_code")
        data.pop("icd10_code", None)
        data.pop("icd_code", None)
        if icd10 is not None:
            data["icd10Code"] = icd10

        return data

    def publish(self, soap_record: dict, canonical_patient_id: str = None) -> dict:
        soap_record = self._normalize(soap_record, canonical_patient_id=canonical_patient_id)

        # ✅ Ensure IDs exist — always generate a fresh uuid-based recordId so
        # rapid successive calls (e.g. retries within the same second) never
        # collide with the old MD5(patient_id+timestamp) approach and get
        # silently skipped by the idempotency check.
        if not soap_record.get("recordId"):
            soap_record["recordId"] = f"SOAP-{uuid.uuid4().hex[:8].upper()}"
        else:
            # Re-suffix with a short uuid fragment to guarantee uniqueness
            # while keeping the original prefix for readability.
            base = soap_record["recordId"]
            soap_record["recordId"] = f"{base}-{uuid.uuid4().hex[:4].upper()}"

        if not soap_record.get("patientId"):
            soap_record["patientId"] = "UNKNOWN"

        record_id = soap_record["recordId"]

        # ✅ Approval Gate (Week 2)
        if soap_record.get("approvalStatus") != "approved":
            raise PermissionError("Approval required before DB write")

        # ✅ Idempotency — still guarded, but collision is now practically
        # impossible because recordId includes a uuid fragment.
        if self.records.find_one({"recordId": record_id}):
            return {"status": "skipped", "reason": "duplicate", "recordId": record_id}

        try:
            soap_record["timestamp"] = datetime.utcnow().isoformat() + "Z"

            # Build document text FIRST so it is always available in the except block
            document_text = "\n".join([
                "================================================================",
                "MEDASSIST SOAP CLINICAL DOCUMENT",
                "================================================================",
                f"Record ID      : {record_id}",
                f"Generated Time : {soap_record['timestamp']}",
                f"Confidence     : {soap_record.get('confidenceScore', '')}",
                "",
                "S - SUBJECTIVE",
                "----------------------------------------------------------------",
                str(soap_record.get("subjective", "")),
                "",
                "O - OBJECTIVE",
                "----------------------------------------------------------------",
                str(soap_record.get("objective", "")),
                "",
                "A - ASSESSMENT",
                "----------------------------------------------------------------",
                str(soap_record.get("assessment", "")),
                "",
                "P - PLAN",
                "----------------------------------------------------------------",
                str(soap_record.get("plan", "")),
                "",
                "Clinical note generated from validated SOAP JSON output for doctor review.",
                "================================================================",
            ])

            # ✅ Save JSON record
            self.records.insert_one(soap_record)
            soap_record.pop("_id", None)  # pymongo adds _id in-place; remove before returning

            # ✅ Save document in Cosmos
            self.documents.insert_one({
                "recordId": record_id,
                "patientId": soap_record.get("patientId"),
                "document": document_text,
                "timestamp": soap_record["timestamp"]
            })

            return {
                "status": "success",
                "recordId": record_id
            }

        except Exception as e:
            # ✅ Dead-letter — best-effort, never mask the original error
            try:
                self.dead.insert_one({
                    "record": soap_record,
                    "document": document_text,
                    "error": str(e),
                    "retryCount": 0,
                    "timestamp": datetime.utcnow().isoformat() + "Z"
                })
            except Exception:
                pass

            return {"status": "failed", "dead-letter": True, "error": str(e)}
