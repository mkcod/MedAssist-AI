"""
audit_store.py — Cosmos DB (MongoDB API) audit log writer.

Place at: Backend/orchestrator_agent/audit_store.py

Writes one document per pipeline session to:
  DB:         medassist_ai-main-db
  Collection: pipeline_logs

Each document tracks every tool call with metadata (no transcript text).
"""

import os
import time
from datetime import datetime, timezone
from pathlib import Path
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).parent / ".env", override=False)
from kv_loader import load_secrets_from_keyvault
load_secrets_from_keyvault()

# ── Connection ────────────────────────────────────────────────────────────────
_client     = None
_collection = None


def _get_collection():
    global _client, _collection
    if _collection is not None:
        return _collection

    uri = os.environ.get("COSMOS_AUDIT_URI")
    db  = os.environ.get("COSMOS_AUDIT_DB", "medassist_ai-main-db")
    col = os.environ.get("COSMOS_AUDIT_COLLECTION", "pipeline_logs")

    if not uri:
        raise RuntimeError("COSMOS_AUDIT_URI not set in .env")

    _client     = MongoClient(uri, serverSelectionTimeoutMS=5000)
    _collection = _client[db][col]
    return _collection


# ── AuditSession — one per pipeline run ──────────────────────────────────────
class AuditSession:
    """
    Created at pipeline start.
    Call log_step() after every tool call.
    Call complete() or fail() at the end.
    """

    def __init__(self, session_id: str, meta: dict = None):
        self.session_id  = session_id
        self.started_at  = datetime.now(timezone.utc)
        self._steps      = []
        self._step_num   = 0
        self._meta       = meta or {}
        self._doc_id     = None
        self._col        = None

        try:
            self._col = _get_collection()
            result = self._col.insert_one({
                "session_id":   session_id,
                "started_at":   self.started_at,
                "completed_at": None,
                "total_duration_sec": None,
                "status":       "running",
                "triggered_by": {
                    "user_id":    self._meta.get("user_id"),
                    "patient_id": self._meta.get("patient_id"),
                    "doctor_id":  self._meta.get("doctor_id"),
                },
                "steps":            [],
                "summary_metadata": {},
                "soap_metadata":    {},
                "error_info":       None,
            })
            self._doc_id = result.inserted_id
        except Exception as e:
            print(f"[AuditStore] WARNING: Could not create audit doc — {e}")

    def log_step(
        self,
        tool_name:  str,
        mcp_server: str,
        status:     str,           # "success" | "error"
        metadata:   dict = None,   # lightweight — no transcript
        duration_sec: float = 0,
        error:      str = None,
        attempt:    int = 1,
    ):
        self._step_num += 1
        step = {
            "step_number":  self._step_num,
            "tool_name":    tool_name,
            "mcp_server":   mcp_server,
            "timestamp":    datetime.now(timezone.utc),
            "duration_sec": round(duration_sec, 3),
            "status":       status,
            "attempt":      attempt,
            "metadata":     metadata or {},
            "error":        error,
        }
        self._steps.append(step)

        if self._col is not None and self._doc_id is not None:
            try:
                self._col.update_one(
                    {"_id": self._doc_id},
                    {"$push": {"steps": step}}
                )
            except Exception as e:
                print(f"[AuditStore] WARNING: Could not log step — {e}")

    def set_summary_metadata(self, data: dict):
        """Call after summarizer step completes."""
        safe = {k: v for k, v in data.items()
                if k in ["utterance_count","speakers","roles",
                         "symptoms","possible_condition","icd10_code",
                         "action_plan","diagnosis_status"]}
        if self._col is not None and self._doc_id is not None:
            try:
                self._col.update_one(
                    {"_id": self._doc_id},
                    {"$set": {"summary_metadata": safe}}
                )
            except Exception as e:
                print(f"[AuditStore] WARNING: Could not set summary metadata — {e}")

    def set_soap_metadata(self, data: dict):
        """Call after publishing step completes."""
        safe = {k: v for k, v in data.items()
                if k in ["record_id","confidence_score",
                         "approval_status","published_path","timestamp"]}
        if self._col is not None and self._doc_id is not None:
            try:
                self._col.update_one(
                    {"_id": self._doc_id},
                    {"$set": {"soap_metadata": safe}}
                )
            except Exception as e:
                print(f"[AuditStore] WARNING: Could not set SOAP metadata — {e}")

    def complete(self):
        """Mark session as successfully complete."""
        now      = datetime.now(timezone.utc)
        duration = round((now - self.started_at).total_seconds(), 2)
        if self._col is not None and self._doc_id is not None:
            try:
                self._col.update_one(
                    {"_id": self._doc_id},
                    {"$set": {
                        "status":             "complete",
                        "completed_at":       now,
                        "total_duration_sec": duration,
                    }}
                )
            except Exception as e:
                print(f"[AuditStore] WARNING: Could not mark complete — {e}")

    def fail(self, error: str, failed_at_tool: str = None):
        """Mark session as failed."""
        now      = datetime.now(timezone.utc)
        duration = round((now - self.started_at).total_seconds(), 2)
        if self._col is not None and self._doc_id is not None:
            try:
                self._col.update_one(
                    {"_id": self._doc_id},
                    {"$set": {
                        "status":             "error",
                        "completed_at":       now,
                        "total_duration_sec": duration,
                        "error_info": {
                            "message":       error,
                            "failed_at_tool": failed_at_tool,
                            "timestamp":     now,
                        }
                    }}
                )
            except Exception as e:
                print(f"[AuditStore] WARNING: Could not mark failed — {e}")
