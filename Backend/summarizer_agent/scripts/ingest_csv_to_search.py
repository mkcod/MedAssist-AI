import hashlib
import csv
import io
import json
import logging
import os
import re
from typing import Dict, Iterable, List, Optional

import requests
import urllib3
from azure.storage.blob import BlobServiceClient
from dotenv import load_dotenv
from openai import AzureOpenAI

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

load_dotenv()

logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)

SEARCH_ENDPOINT = os.getenv("AZURE_SEARCH_ENDPOINT")
SEARCH_ADMIN_KEY = os.getenv("AZURE_SEARCH_ADMIN_KEY")
INDEX_NAME = os.getenv("AZURE_SEARCH_INDEX1")

STORAGE_CONNECTION_STRING = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
STORAGE_CONTAINER = os.getenv("AZURE_BLOB_CONTAINER_NAME1")
STORAGE_BLOB_NAME = os.getenv("AZURE_BLOB_MEDICAL_KB_FILE1")

OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")
OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY")
OPENAI_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-01")
EMBEDDING_DEPLOYMENT = os.getenv("AZURE_OPENAI_EMBEDDING_DEPLOYMENT")

EMBED_BATCH_SIZE = int(os.getenv("INGEST_EMBED_BATCH_SIZE", "2048")) #MAX
UPLOAD_BATCH_SIZE = int(os.getenv("INGEST_UPLOAD_BATCH_SIZE", "1000")) #MAX


def require_env(value: Optional[str], name: str) -> str:
    if not value:
        raise SystemExit(f"Missing required environment variable: {name}")
    return value


def normalize_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(value).strip().lower())


def download_blob_xlsx() -> bytes:
    blob_service = BlobServiceClient.from_connection_string(require_env(STORAGE_CONNECTION_STRING, "AZURE_STORAGE_CONNECTION_STRING"))
    blob_client = blob_service.get_blob_client(
        container=require_env(STORAGE_CONTAINER, "AZURE_BLOB_CONTAINER_NAME1"),
        blob=require_env(STORAGE_BLOB_NAME, "AZURE_BLOB_CSV_FILE"),
    )
    logger.info("Downloading blob %s/%s", STORAGE_CONTAINER, STORAGE_BLOB_NAME)
    return blob_client.download_blob().readall()


def rows_from_csv(csv_bytes: bytes) -> List[Dict[str, str]]:
    text = csv_bytes.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    records: List[Dict[str, str]] = []

    for row in reader:
        cleaned = {
            normalize_key(key): str(value).strip()
            for key, value in row.items()
            if key and value is not None and str(value).strip()
        }
        if cleaned:
            records.append(cleaned)

    return records


def first_value(record: Dict[str, str], *candidate_keys: str) -> str:
    normalized = {normalize_key(key): value for key, value in record.items()}
    for candidate in candidate_keys:
        value = normalized.get(normalize_key(candidate), "")
        if value:
            return str(value).strip()
    return ""


def build_content(record: Dict[str, str]) -> Dict[str, str]:
    icd_code = first_value(record, "ICD-10 Code", "ICD10 Code", "ICD Code", "code", "icd_code")
    condition = first_value(record, "Short Description", "Description", "Disease", "Condition", "Title", "Name")
    description = first_value(record, "Description", "Long Description", "Detail", "Narrative", "Chapter")
    chapter = first_value(record, "Chapter", "Section", "Category")

    if not condition and description:
        condition = description[:120]

    content_parts = [part for part in [icd_code, condition, description, chapter] if part]
    content = " | ".join(content_parts) if content_parts else json.dumps(record, ensure_ascii=False)

    return {
        "icd_code": icd_code,
        "condition": condition,
        "description": description or chapter,
        "content": content,
    }


def batched(items: List[dict], size: int) -> Iterable[List[dict]]:
    for start in range(0, len(items), size):
        yield items[start:start + size]


def create_embeddings(chunks: List[str]) -> List[List[float]]:
    client = AzureOpenAI(
        api_key=require_env(OPENAI_API_KEY, "AZURE_OPENAI_API_KEY"),
        api_version=OPENAI_API_VERSION,
        azure_endpoint=require_env(OPENAI_ENDPOINT, "AZURE_OPENAI_ENDPOINT"),
    )

    embeddings: List[List[float]] = []
    for batch_index, batch in enumerate(batched([{"content": chunk} for chunk in chunks], EMBED_BATCH_SIZE), start=1):
        inputs = [item["content"] for item in batch]
        logger.info("Creating embeddings for xlsx batch %s (%s rows)", batch_index, len(batch))
        response = client.embeddings.create(
            model=require_env(EMBEDDING_DEPLOYMENT, "AZURE_OPENAI_EMBEDDING_DEPLOYMENT"),
            input=inputs,
        )
        embeddings.extend(item.embedding for item in response.data)
    return embeddings


def upload_documents(documents: List[dict]) -> None:
    url = f"{require_env(SEARCH_ENDPOINT, 'AZURE_SEARCH_ENDPOINT')}/indexes/{require_env(INDEX_NAME, 'AZURE_SEARCH_INDEX1')}/docs/index?api-version=2024-07-01"
    headers = {
        "Content-Type": "application/json",
        "api-key": require_env(SEARCH_ADMIN_KEY, "AZURE_SEARCH_ADMIN_KEY"),
    }

    for batch_index, batch in enumerate(batched(documents, UPLOAD_BATCH_SIZE), start=1):
        payload = {
            "value": [
                {
                    "@search.action": "mergeOrUpload",
                    **doc,
                }
                for doc in batch
            ]
        }
        logger.info(
            "Uploading xlsx batch %s to Azure Search | docs=%s | ids=%s",
            batch_index,
            len(batch),
            [doc["id"] for doc in batch[:3]],
        )
        response = requests.post(url, headers=headers, json=payload, timeout=30, verify=False)
        if response.status_code not in {200, 201}:
            raise RuntimeError(f"Azure Search upload failed with {response.status_code}: {response.text[:500]}")
        logger.info("Azure Search upload batch %s succeeded", batch_index)


def purge_existing_documents() -> int:
    url = f"{require_env(SEARCH_ENDPOINT, 'AZURE_SEARCH_ENDPOINT')}/indexes/{require_env(INDEX_NAME, 'AZURE_SEARCH_INDEX1')}/docs/search?api-version=2024-07-01"
    headers = {
        "Content-Type": "application/json",
        "api-key": require_env(SEARCH_ADMIN_KEY, "AZURE_SEARCH_ADMIN_KEY"),
    }

    deleted = 0
    page_size = 1000
    skip = 0

    while True:
        payload = {
            "search": "*",
            "top": page_size,
            "skip": skip,
            "select": "id",
            "count": True,
        }
        response = requests.post(url, headers=headers, json=payload, timeout=30, verify=False)
        if response.status_code != 200:
            raise RuntimeError(f"Azure Search list-for-delete failed with {response.status_code}: {response.text[:500]}")

        result = response.json()
        docs = result.get("value", [])
        if not docs:
            break

        ids = [doc.get("id") for doc in docs if doc.get("id")]
        if ids:
            delete_url = f"{require_env(SEARCH_ENDPOINT, 'AZURE_SEARCH_ENDPOINT')}/indexes/{require_env(INDEX_NAME, 'AZURE_SEARCH_INDEX1')}/docs/index?api-version=2024-07-01"
            for batch_index, batch in enumerate(batched([{ "id": doc_id } for doc_id in ids], UPLOAD_BATCH_SIZE), start=1):
                delete_payload = {
                    "value": [
                        {
                            "@search.action": "delete",
                            **doc,
                        }
                        for doc in batch
                    ]
                }
                delete_response = requests.post(delete_url, headers=headers, json=delete_payload, timeout=30, verify=False)
                if delete_response.status_code not in {200, 201}:
                    raise RuntimeError(
                        f"Azure Search delete failed with {delete_response.status_code}: {delete_response.text[:500]}"
                    )
                deleted += len(batch)
                logger.info("Deleted batch %s from Azure Search | docs=%s", batch_index, len(batch))

        if len(docs) < page_size:
            break
        skip += page_size

    return deleted


def confirm_purge() -> bool:
    answer = input(
        f"This will delete all existing documents from Azure Search index '{INDEX_NAME}'. Continue? [y/N]: "
    ).strip().lower()
    return answer in {"y", "yes"}


def main() -> None:
    logger.info("Batch settings | embed=%s | upload=%s", EMBED_BATCH_SIZE, UPLOAD_BATCH_SIZE)

    if confirm_purge():
        existing_deleted = purge_existing_documents()
        logger.info("Purged %s existing documents from Azure Search index %s", existing_deleted, INDEX_NAME)
    else:
        logger.info("Purge skipped; existing documents in Azure Search index %s were left intact", INDEX_NAME)

    csv_bytes = download_blob_xlsx()
    workbook_rows = rows_from_csv(csv_bytes)

    if not workbook_rows:
        raise SystemExit("No usable rows found in the csv blob")

    normalized_rows: List[dict] = []
    contents: List[str] = []
    source_name = require_env(STORAGE_BLOB_NAME, "AZURE_BLOB_CSV_FILE")

    for row_index, row in enumerate(workbook_rows):
        fields = build_content(row)
        content = fields["content"]
        normalized_rows.append(
            {
                "id": hashlib.sha1(f"{source_name}:{row_index}:{content}".encode("utf-8")).hexdigest(),
                "source": source_name,
                "symptom": "",
                "condition": fields["condition"],
                "icd_code": fields["icd_code"],
                "description": fields["description"],
                "content": content,
            }
        )
        contents.append(content)

    logger.info("Prepared %s csv rows for embedding and upload", len(normalized_rows))
    embeddings = create_embeddings(contents)

    if len(embeddings) != len(normalized_rows):
        raise RuntimeError(f"Embedding count mismatch: {len(embeddings)} embeddings for {len(normalized_rows)} rows")

    for row, embedding in zip(normalized_rows, embeddings):
        row["embedding"] = embedding

    upload_documents(normalized_rows)

    print(json.dumps({"status": "success", "rows": len(normalized_rows), "documents": len(normalized_rows)}, indent=2))


if __name__ == "__main__":
    main()