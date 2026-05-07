from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.auth.dependencies import get_current_websocket_user
from app.database.db import db
from app.models.user import UserSummary
from app.websocket.manager import manager


router = APIRouter(tags=["websocket"])


def serialize_user_summary(user: dict) -> UserSummary:
    return UserSummary(
        id=str(user["_id"]),
        username=user["username"],
        email=user["email"],
        is_online=user.get("is_online", False),
    )


async def find_related_member_ids(user_id: str) -> list[str]:
    rooms = await db.rooms.find({"member_ids": user_id}, {"member_ids": 1}).to_list(length=500)
    member_ids: set[str] = set()
    for room in rooms:
        member_ids.update(room.get("member_ids", []))
    member_ids.discard(user_id)
    return list(member_ids)


async def broadcast_presence(user: dict, is_online: bool) -> None:
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"is_online": is_online}})
    related_member_ids = await find_related_member_ids(str(user["_id"]))
    payload = {
        "type": "presence_update",
        "user": {
            **serialize_user_summary({**user, "is_online": is_online}).model_dump(),
        },
    }
    await manager.broadcast_to_users(related_member_ids, payload)


@router.websocket("/ws/chat")
async def chat_websocket(websocket: WebSocket):
    try:
        user = await get_current_websocket_user(websocket)
    except ValueError:
        await websocket.close(code=1008)
        return

    user_id = str(user["_id"])
    await manager.connect(user_id, websocket)
    await broadcast_presence(user, True)

    try:
        await websocket.send_json(
            {
                "type": "connection_ready",
                "user_id": user_id,
            }
        )

        while True:
            data = await websocket.receive_json()
            event_type = data.get("type")

            if event_type == "ping":
                await websocket.send_json({"type": "pong"})
                continue

            if event_type != "send_message":
                await websocket.send_json({"type": "error", "message": "Unsupported event"})
                continue

            room_id = data.get("room_id", "")
            content = str(data.get("content", "")).strip()
            if not ObjectId.is_valid(room_id) or not content:
                await websocket.send_json({"type": "error", "message": "Invalid message payload"})
                continue

            room = await db.rooms.find_one({"_id": ObjectId(room_id), "member_ids": user_id})
            if room is None:
                await websocket.send_json({"type": "error", "message": "Room not found"})
                continue

            now = datetime.now(timezone.utc)
            message_document = {
                "room_id": room_id,
                "sender_id": user_id,
                "content": content[:2000],
                "created_at": now,
            }
            result = await db.messages.insert_one(message_document)
            await db.rooms.update_one(
                {"_id": room["_id"]},
                {"$set": {"last_message_at": now, "last_message_preview": content[:120]}},
            )

            payload = {
                "type": "message_created",
                "room_id": room_id,
                "message": {
                    "id": str(result.inserted_id),
                    "room_id": room_id,
                    "sender": serialize_user_summary({**user, "is_online": True}).model_dump(),
                    "content": content[:2000],
                    "created_at": now.isoformat(),
                },
            }
            await manager.broadcast_to_users(room["member_ids"], payload)
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(user_id, websocket)
        await broadcast_presence(user, False)
