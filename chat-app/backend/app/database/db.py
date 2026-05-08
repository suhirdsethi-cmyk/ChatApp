from motor.motor_asyncio import AsyncIOMotorClient

from app.config import MONGO_URL

client = AsyncIOMotorClient(MONGO_URL)

db = client["chatapp"]


async def connect_to_mongo() -> None:
    await client.admin.command("ping")
    users_without_lookup = db.users.find({"username_lookup": {"$exists": False}}, {"username": 1})
    async for user in users_without_lookup:
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"username_lookup": user["username"].strip().lower()}},
        )
    await db.users.update_many(
        {"friend_ids": {"$exists": False}},
        {"$set": {"friend_ids": []}},
    )
    await db.users.create_index("email", unique=True)
    await db.users.create_index("username_lookup", unique=True)
    await db.users.create_index("friend_ids")
    await db.rooms.create_index("member_ids")
    await db.rooms.create_index("last_message_at")
    await db.rooms.create_index("direct_key", unique=True, sparse=True)
    await db.messages.create_index([("room_id", 1), ("created_at", -1)])
    await db.messages.create_index("sender_id")


async def close_mongo_connection() -> None:
    client.close()
