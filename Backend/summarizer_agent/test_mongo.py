from mongo_store import _get_db

db = _get_db()
print("Connected successfully")
print("Database:", db.name)
print("Collections:", db.list_collection_names())