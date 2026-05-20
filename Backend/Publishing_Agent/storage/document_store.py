from pathlib import Path
from datetime import datetime


class DocumentStore:
    def __init__(self, base_dir: str = "output"):
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def save_document(self, content: str, soap_record: dict) -> dict:
        record_id = soap_record.get("record_id", "SOAP-UNKNOWN")
        file_path = self.base_dir / f"{record_id}.txt"
        file_path.write_text(content, encoding="utf-8")

        return {
            "status": "success",
            "path": str(file_path),
            "filename": file_path.name,
            "timestamp": datetime.utcnow().isoformat() + "Z",
        }