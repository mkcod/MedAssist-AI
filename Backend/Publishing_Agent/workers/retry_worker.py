import time
from storage.ehr_store import EHRStore


def run():
    store = EHRStore()

    while True:
        items = store.dead.find({"retryCount": {"$lt": 3}})

        for item in items:
            try:
                store.records.insert_one(item["record"])
                store.documents.insert_one({
                    "recordId": item["record"]["recordId"],
                    "document": item["document"]
                })

                store.dead.delete_one({"_id": item["_id"]})

            except:
                store.dead.update_one(
                    {"_id": item["_id"]},
                    {"$inc": {"retryCount": 1}}
                )

        time.sleep(10)