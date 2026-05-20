import json
import logging
import os
import sys
from pathlib import Path

# Ensure this file's own directory is on sys.path so sibling modules
# (rag_pipeline, mongo_store) resolve correctly regardless of cwd.
_here = Path(__file__).resolve().parent
if str(_here) not in sys.path:
    sys.path.insert(0, str(_here))

from mongo_store import save_input_document, save_output_document
from rag_pipeline import run_rag_pipeline


logging.basicConfig(
    level=logging.INFO,
    format="[%(levelname)s] %(name)s: %(message)s",
)


def resolve_input_file(project_root: str) -> str:
    file_name = None

    if len(sys.argv) > 1:
        file_name = sys.argv[1].strip()
    elif os.getenv("SAMPLE_FILE"):
        file_name = os.getenv("SAMPLE_FILE").strip()

    if not file_name:
        raise ValueError(
            "No input file provided. Pass a sample file name as argument, for example: python main.py json_case_2.txt"
        )

    file_path = os.path.join(project_root, "samples", file_name)

    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Input file not found: {file_name}")

    return file_path


def main():
    project_root = os.path.dirname(os.path.abspath(__file__))

    try:
        file_path = resolve_input_file(project_root)
    except Exception as e:
        print(json.dumps({"error": str(e)}, indent=4))
        return

    file_name = os.path.basename(file_path)

    print("Starting RAG pipeline...")
    print("Input file:", file_name)

    with open(file_path, "r", encoding="utf-8") as f:
        transcript = f.read()

    if not transcript.strip():
        print(json.dumps({"error": "Input transcript is empty"}, indent=4))
        return

    # 1) First run pipeline no matter what
    try:
        output = run_rag_pipeline(transcript)
    except Exception as e:
        print(json.dumps({"error": f"Pipeline failed: {str(e)}"}, indent=4))
        return

    # 2) Then try DB save separately
    input_id = None
    output_id = None
    db_warning = None

    try:
        input_id = save_input_document(file_name, transcript)
        output_id = save_output_document(
            file_name=file_name,
            output_data=output,
            input_ref_id=input_id
        )
    except Exception as e:
        db_warning = f"DB save failed: {str(e)}"

    if input_id:
        output["db_input_id"] = input_id
    if output_id:
        output["db_output_id"] = output_id
    if db_warning:
        output["db_warning"] = db_warning

    print(json.dumps(output, indent=4, ensure_ascii=False))


if __name__ == "__main__":
    main()