import json
import os
from datetime import datetime, timezone
from typing import Any, Dict

import certifi
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "medassist-ai-main-db")
MONGO_INPUT_COLLECTION = os.getenv("MONGO_INPUT_COLLECTION", "sample-inputs")
MONGO_OUTPUT_COLLECTION = os.getenv("MONGO_OUTPUT_COLLECTION", "rag-outputs")


def _get_db():
    if not MONGO_URI:
        raise ValueError("MONGO_URI is missing in .env")

    client = MongoClient(
        MONGO_URI,
        tls=True,
        tlsCAFile=certifi.where(),
        retryWrites=False,
        serverSelectionTimeoutMS=5000,
        connectTimeoutMS=5000,
        socketTimeoutMS=5000,
    )

    client.admin.command("ping")
    return client[MONGO_DB_NAME]


def save_input_document(file_name: str, transcript_raw: str) -> str:
    db = _get_db()
    col = db[MONGO_INPUT_COLLECTION]

    try:
        transcript_json = json.loads(transcript_raw)
    except Exception:
        transcript_json = {"raw_text": transcript_raw}

    doc = {
        "file_name": file_name,
        "source_type": "sample_input",
        "transcript": transcript_json,
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    result = col.insert_one(doc)
    return str(result.inserted_id)


def save_output_document(file_name: str, output_data: Dict[str, Any], input_ref_id: str | None = None) -> str:
    db = _get_db()
    col = db[MONGO_OUTPUT_COLLECTION]

    doc = {
        "file_name": file_name,
        "input_ref_id": input_ref_id,
        "source_type": "rag_output",
        "output": output_data,
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    result = col.insert_one(doc)
    return str(result.inserted_id)