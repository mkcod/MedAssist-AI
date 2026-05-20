import json
import os
from pathlib import Path
from openai import AzureOpenAI
from dotenv import load_dotenv

load_dotenv()

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"

INPUT_FILE = DATA_DIR / "clinical_dataset.json"
OUTPUT_FILE = DATA_DIR / "clinical_dataset_with_embeddings.json"

client = AzureOpenAI(
    api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    api_version=os.getenv("AZURE_OPENAI_API_VERSION"),
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
)

EMBEDDING_DEPLOYMENT = os.getenv("AZURE_OPENAI_EMBEDDING_DEPLOYMENT")


def main():
    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        records = json.load(f)

    if not records:
        print("❌ No records found in clinical_dataset.json")
        return

    # for fast completion, first test with small subset
    sample_size = min(200, len(records))
    records = records[:sample_size]

    for i, record in enumerate(records, start=1):
        text = record.get("content", "").strip()
        if not text:
            record["embedding"] = []
            continue

        response = client.embeddings.create(
            model=EMBEDDING_DEPLOYMENT,
            input=text
        )
        record["embedding"] = response.data[0].embedding

        if i % 20 == 0:
            print(f"Processed {i}/{len(records)}")

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(records, f)

    print(f"✅ Embeddings saved to: {OUTPUT_FILE}")
    print(f"✅ Total records embedded: {len(records)}")
    print(f"✅ Vector dimension: {len(records[0]['embedding']) if records and records[0].get('embedding') else 0}")


if __name__ == "__main__":
    main()
    
raise SystemExit(
    "generate_embeddings.py is a legacy local embedding script. The Azure-only workflow should query an existing Azure AI Search index instead of generating clinical_dataset_with_embeddings.json locally."
)
