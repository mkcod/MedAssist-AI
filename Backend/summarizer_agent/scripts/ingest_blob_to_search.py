import hashlib
import io
import json
import logging
import os
import re
from typing import Iterable, List

import PyPDF2
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
INDEX_NAME = os.getenv("AZURE_SEARCH_INDEX")

STORAGE_CONNECTION_STRING = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
STORAGE_CONTAINER = os.getenv("AZURE_BLOB_CONTAINER_NAME")
STORAGE_BLOB_NAME = os.getenv("AZURE_BLOB_MEDICAL_KB_FILE")

OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")
OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY")
OPENAI_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-01")
EMBEDDING_DEPLOYMENT = os.getenv("AZURE_OPENAI_EMBEDDING_DEPLOYMENT")

CHUNK_SIZE = int(os.getenv("INGEST_CHUNK_SIZE", "1600"))
CHUNK_OVERLAP = int(os.getenv("INGEST_CHUNK_OVERLAP", "200"))
EMBED_BATCH_SIZE = int(os.getenv("INGEST_EMBED_BATCH_SIZE", "32"))
UPLOAD_BATCH_SIZE = int(os.getenv("INGEST_UPLOAD_BATCH_SIZE", "100"))


def require_env(value: str, name: str) -> str:
    if not value:
        raise SystemExit(f"Missing required environment variable: {name}")
    return value


def download_blob_pdf() -> bytes:
    blob_service = BlobServiceClient.from_connection_string(require_env(STORAGE_CONNECTION_STRING, "AZURE_STORAGE_CONNECTION_STRING"))
    blob_client = blob_service.get_blob_client(
        container=require_env(STORAGE_CONTAINER, "AZURE_BLOB_CONTAINER_NAME"),
        blob=require_env(STORAGE_BLOB_NAME, "AZURE_BLOB_MEDICAL_KB_FILE"),
    )
    logger.info("Downloading blob %s/%s", STORAGE_CONTAINER, STORAGE_BLOB_NAME)
    return blob_client.download_blob().readall()


def extract_pdf_text(pdf_bytes: bytes) -> str:
    reader = PyPDF2.PdfReader(io.BytesIO(pdf_bytes))
    pages = []
    for page in reader.pages:
        pages.append(page.extract_text() or "")
    text = "\n".join(pages)
    text = re.sub(r"\r\n?", "\n", text)
    text = re.sub(r"[\t ]+", " ", text)
    return text.strip()


def split_text(text: str, chunk_size: int, overlap: int) -> List[str]:
    paragraphs = [part.strip() for part in text.split("\n") if part.strip()]
    chunks: List[str] = []
    current = ""

    def flush_current() -> None:
        nonlocal current
        if current.strip():
            chunks.append(current.strip())
        current = ""

    for paragraph in paragraphs:
        if len(paragraph) > chunk_size:
            flush_current()
            start = 0
            while start < len(paragraph):
                chunks.append(paragraph[start:start + chunk_size].strip())
                start += max(1, chunk_size - overlap)
            continue

        if len(current) + len(paragraph) + 1 <= chunk_size:
            current = f"{current} {paragraph}".strip()
        else:
            flush_current()
            current = paragraph

    flush_current()
    return [chunk for chunk in chunks if chunk]


def batched(items: List[str], size: int) -> Iterable[List[str]]:
    for start in range(0, len(items), size):
        yield items[start:start + size]


def build_documents(blob_name: str, chunks: List[str], embeddings: List[List[float]]) -> List[dict]:
    documents = []
    for index, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
        content = chunk.strip()
        documents.append({
            "id": hashlib.sha1(f"{blob_name}:{index}:{content}".encode("utf-8")).hexdigest(),
            "source": blob_name,
            "symptom": "",
            "condition": content[:120],
            "icd_code": "",
            "description": f"Extracted from {blob_name}",
            "content": content,
            "embedding": embedding,
        })
    return documents


def create_embeddings(chunks: List[str]) -> List[List[float]]:
    client = AzureOpenAI(
        api_key=require_env(OPENAI_API_KEY, "AZURE_OPENAI_API_KEY"),
        api_version=OPENAI_API_VERSION,
        azure_endpoint=require_env(OPENAI_ENDPOINT, "AZURE_OPENAI_ENDPOINT"),
    )

    embeddings: List[List[float]] = []
    for batch_index, batch in enumerate(batched(chunks, EMBED_BATCH_SIZE), start=1):
        logger.info("Creating embeddings for batch %s (%s chunks)", batch_index, len(batch))
        response = client.embeddings.create(model=require_env(EMBEDDING_DEPLOYMENT, "AZURE_OPENAI_EMBEDDING_DEPLOYMENT"), input=batch)
        embeddings.extend(item.embedding for item in response.data)
    return embeddings


def upload_documents(documents: List[dict]) -> None:
    url = f"{require_env(SEARCH_ENDPOINT, 'AZURE_SEARCH_ENDPOINT')}/indexes/{require_env(INDEX_NAME, 'AZURE_SEARCH_INDEX')}/docs/index?api-version=2024-07-01"
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
            "Uploading batch %s to Azure Search | docs=%s | ids=%s",
            batch_index,
            len(batch),
            [doc["id"] for doc in batch[:3]],
        )
        response = requests.post(url, headers=headers, json=payload, timeout=30, verify=False)
        if response.status_code not in {200, 201}:
            raise RuntimeError(f"Azure Search upload failed with {response.status_code}: {response.text[:500]}")
        logger.info("Azure Search upload batch %s succeeded", batch_index)


def main() -> None:
    pdf_bytes = download_blob_pdf()
    text = extract_pdf_text(pdf_bytes)
    chunks = split_text(text, CHUNK_SIZE, CHUNK_OVERLAP)

    if not chunks:
        raise SystemExit("No extractable text found in the blob PDF")

    logger.info("Extracted %s chunks from blob PDF", len(chunks))
    embeddings = create_embeddings(chunks)
    documents = build_documents(require_env(STORAGE_BLOB_NAME, "AZURE_BLOB_MEDICAL_KB_FILE"), chunks, embeddings)
    upload_documents(documents)

    print(json.dumps({"status": "success", "chunks": len(chunks), "documents": len(documents)}, indent=2))


if __name__ == "__main__":
    main()