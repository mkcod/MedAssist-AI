import pandas as pd
import json

# read the excel medical dataset
df = pd.read_excel("sample_codes_medical.xlsx")

records = []

for _, row in df.iterrows():

    record = {
        "code": str(row["ICD-10 Code"]),
        "disease": str(row["Short Description"]),
        "chapter": str(row["Chapter"]),
        "description": str(row["Description"])
    }

    records.append(record)

# save knowledge base
with open("data/medical_kb.json", "w", encoding="utf-8") as f:
    json.dump(records, f, indent=4)

print("Medical knowledge base generated successfully")