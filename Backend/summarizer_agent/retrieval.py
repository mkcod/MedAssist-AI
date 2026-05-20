import json
import math
import logging
import os
import re
from typing import Dict, List

import requests
import urllib3
from dotenv import load_dotenv
from openai import AzureOpenAI

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
load_dotenv()

logger = logging.getLogger(__name__)

# Lazy-initialized — created on first use so that Azure App Settings env vars
# are guaranteed to be present regardless of import order.
_client: AzureOpenAI = None


def _get_client() -> AzureOpenAI:
    global _client
    if _client is None:
        _client = AzureOpenAI(
            api_key=os.getenv("AZURE_OPENAI_API_KEY"),
            api_version=os.getenv("AZURE_OPENAI_API_VERSION"),
            azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
            timeout=20.0,
        )
    return _client


EMBEDDING_DEPLOYMENT = None  # resolved lazily via _get_config()
SEARCH_ENDPOINT = None
SEARCH_ADMIN_KEY = None
INDEX_NAME = None


def _get_config():
    global EMBEDDING_DEPLOYMENT, SEARCH_ENDPOINT, SEARCH_ADMIN_KEY, INDEX_NAME
    if EMBEDDING_DEPLOYMENT is None:
        EMBEDDING_DEPLOYMENT = os.getenv("AZURE_OPENAI_EMBEDDING_DEPLOYMENT")
        SEARCH_ENDPOINT = os.getenv("AZURE_SEARCH_ENDPOINT")
        SEARCH_ADMIN_KEY = os.getenv("AZURE_SEARCH_ADMIN_KEY")
        INDEX_NAME = os.getenv("AZURE_SEARCH_INDEX1")


def normalize_text(text: str) -> str:
    return " ".join(str(text).strip().lower().split())


def tokenize(text: str) -> List[str]:
    text = re.sub(r"[^a-z0-9\s]", " ", normalize_text(text))
    return [t for t in text.split() if len(t) > 2]


def shorten_query(query: str, max_tokens: int = 32) -> str:
    tokens = tokenize(query)
    if not tokens:
        return normalize_text(query)
    return " ".join(tokens[:max_tokens])


def get_embedding(text: str) -> List[float]:
    _get_config()
    response = _get_client().embeddings.create(
        model=EMBEDDING_DEPLOYMENT,
        input=text
    )
    return response.data[0].embedding


def cosine_similarity(a: List[float], b: List[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0

    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))

    if norm_a == 0 or norm_b == 0:
        return 0.0

    return dot / (norm_a * norm_b)


def is_generic_description(description: str) -> bool:
    description = normalize_text(description)
    generic_phrases = {
        "certain infectious and parasitic diseases",
        "neoplasms",
        "diseases of the blood and blood forming organs",
        "endocrine nutritional and metabolic diseases",
        "diseases of the respiratory system",
        "diseases of the digestive system",
        "diseases of the circulatory system",
        "symptoms signs and abnormal clinical findings"
    }
    return description in generic_phrases


def score_doc(query_text: str, doc: Dict, query_embedding: List[float]) -> float:
    condition = doc.get("condition", "") or ""
    description = doc.get("description", "") or ""
    content = doc.get("content", "") or ""
    icd_code = doc.get("icd_code", "") or ""
    source = doc.get("source", "") or ""

    lexical_tokens = set(tokenize(query_text))
    condition_tokens = set(tokenize(condition))
    description_tokens = set(tokenize(description))
    content_tokens = set(tokenize(content))

    condition_overlap = len(lexical_tokens.intersection(condition_tokens))
    description_overlap = len(lexical_tokens.intersection(description_tokens))
    content_overlap = len(lexical_tokens.intersection(content_tokens))

    base_score = float(doc.get("@search.score", 0.0))

    score = 0.0
    score += base_score
    score += condition_overlap * 2.5
    score += description_overlap * 0.5
    score += content_overlap * 0.5

    if str(icd_code).strip():
        score += 1.0

    if normalize_text(source) == "medical_kb_json":
        score += 0.5

    if is_generic_description(description):
        score -= 1.5

    doc["_semantic_score"] = float(doc.get("@search.rerankerScore", 0.0) or 0.0)
    return score


def retrieve_top_k(query: str, top_k: int = 5) -> Dict:
    _get_config()
    clean_query = shorten_query(query)
    query_embedding = get_embedding(clean_query)

    url = f"{SEARCH_ENDPOINT}/indexes/{INDEX_NAME}/docs/search?api-version=2024-07-01"
    headers = {
        "Content-Type": "application/json",
        "api-key": SEARCH_ADMIN_KEY
    }

    payload = {
        "count": True,
        "top": 15,
        "search": clean_query,
        "select": "id,source,symptom,condition,icd_code,description,content",
        "vectorQueries": [
            {
                "kind": "vector",
                "vector": query_embedding,
                "fields": "embedding",
                "k": 15
            }
        ]
    }

    logger.info(
        "Azure Search request | index=%s | query=%r | payload=%s",
        INDEX_NAME,
        clean_query,
        json.dumps(
            {
                "count": payload["count"],
                "top": payload["top"],
                "search": payload["search"],
                "select": payload["select"],
                "vectorQueries": [
                    {
                        "kind": payload["vectorQueries"][0]["kind"],
                        "fields": payload["vectorQueries"][0]["fields"],
                        "k": payload["vectorQueries"][0]["k"],
                        "vector_dim": len(query_embedding),
                    }
                ],
            },
            ensure_ascii=False,
        ),
    )

    response = requests.post(url, headers=headers, json=payload, timeout=20, verify=False)
    if response.status_code != 200:
        raise RuntimeError(
            f"Azure Search query failed with {response.status_code}: {response.text[:500]}"
        )

    result = response.json()
    docs = result.get("value", [])

    logger.info(
        "Azure Search response | status=%s | count=%s | sample=%s",
        response.status_code,
        len(docs),
        json.dumps(
            [
                {
                    "id": doc.get("id"),
                    "condition": doc.get("condition"),
                    "icd_code": doc.get("icd_code"),
                    "search_score": doc.get("@search.score"),
                    "reranker_score": doc.get("@search.rerankerScore"),
                }
                for doc in docs[:3]
            ],
            ensure_ascii=False,
        ),
    )

    reranked = []
    for doc in docs:
        doc["_final_score"] = score_doc(clean_query, doc, query_embedding)
        reranked.append(doc)

    reranked.sort(key=lambda x: x["_final_score"], reverse=True)
    final_docs = reranked[:top_k]

    return {
        "query": clean_query,
        "count": len(final_docs),
        "value": final_docs
    }


if __name__ == "__main__":
    result = retrieve_top_k("fever cough sore throat fatigue", top_k=5)
    print(json.dumps(result, indent=4, ensure_ascii=False))
