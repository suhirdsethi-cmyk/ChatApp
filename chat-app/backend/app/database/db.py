from motor.motor_asyncio import AsyncIOMotorClient

from app.config import MONGO_URL

client = AsyncIOMotorClient(MONGO_URL)

db = client["chatapp"]


async def connect_to_mongo() -> None:
    await client.admin.command("ping")
    await db.users.create_index("email", unique=True)
    await db.users.create_index("username", unique=True)
    await db.rooms.create_index("member_ids")
    await db.rooms.create_index("last_message_at")
    await db.rooms.create_index("direct_key", unique=True, sparse=True)
    await db.messages.create_index([("room_id", 1), ("created_at", -1)])
    await db.messages.create_index("sender_id")


async def close_mongo_connection() -> None:
    client.close()
