import json
import os
from datetime import datetime

def save_local_input(file_name, transcript):
    os.makedirs("db_fallback", exist_ok=True)
    path = os.path.join("db_fallback", f"input_{file_name}")
    with open(path, "w", encoding="utf-8") as f:
        f.write(transcript)
    return path

def save_local_output(file_name, output):
    os.makedirs("db_fallback", exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    path = os.path.join("db_fallback", f"output_{file_name}_{ts}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=4, ensure_ascii=False)
    return path