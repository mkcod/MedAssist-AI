import os
import requests
from dotenv import load_dotenv

load_dotenv()

SEARCH_ENDPOINT = os.getenv("AZURE_SEARCH_ENDPOINT")
SEARCH_ADMIN_KEY = os.getenv("AZURE_SEARCH_ADMIN_KEY")
INDEX_NAME = os.getenv("AZURE_SEARCH_INDEX")

VECTOR_DIMENSIONS = 1536  # if your embedding script prints different, update this

url = f"{SEARCH_ENDPOINT}/indexes/{INDEX_NAME}?api-version=2024-07-01"

headers = {
    "Content-Type": "application/json",
    "api-key": SEARCH_ADMIN_KEY
}

payload = {
    "name": INDEX_NAME,
    "fields": [
        {"name": "id", "type": "Edm.String", "key": True, "filterable": True},
        {"name": "source", "type": "Edm.String", "searchable": True, "filterable": True},
        {"name": "symptom", "type": "Edm.String", "searchable": True},
        {"name": "condition", "type": "Edm.String", "searchable": True},
        {"name": "icd_code", "type": "Edm.String", "searchable": True, "filterable": True},
        {"name": "description", "type": "Edm.String", "searchable": True},
        {"name": "content", "type": "Edm.String", "searchable": True},
        {
            "name": "embedding",
            "type": "Collection(Edm.Single)",
            "searchable": True,
            "dimensions": VECTOR_DIMENSIONS,
            "vectorSearchProfile": "clinical-vector-profile"
        }
    ],
    "vectorSearch": {
        "algorithms": [
            {
                "name": "clinical-hnsw",
                "kind": "hnsw"
            }
        ],
        "profiles": [
            {
                "name": "clinical-vector-profile",
                "algorithm": "clinical-hnsw"
            }
        ]
    }
}

response = requests.put(url, headers=headers, json=payload)
print(response.status_code)
print(response.text)