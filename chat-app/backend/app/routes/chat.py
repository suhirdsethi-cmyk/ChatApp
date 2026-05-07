from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.auth.dependencies import get_current_user
from app.database.db import db
from app.models.chat import (
    ChatMessagePublic,
    ChatRoomPublic,
    DirectRoomCreate,
    GroupRoomCreate,
    MessageCreate,
)
from app.models.user import UserSummary


router = APIRouter(prefix="/api/chat", tags=["chat"])


def serialize_user_summary(user: dict) -> UserSummary:
    return UserSummary(
        id=str(user["_id"]),
        username=user["username"],
        email=user["email"],
        is_online=user.get("is_online", False),
    )


def build_direct_key(member_ids: list[str]) -> str:
    return ":".join(sorted(member_ids))


async def fetch_users_by_ids(member_ids: list[str]) -> list[dict]:
    if any(not ObjectId.is_valid(member_id) for member_id in member_ids):
        return []

    object_ids = [ObjectId(member_id) for member_id in member_ids]
    users = await db.users.find({"_id": {"$in": object_ids}}).to_list(length=len(object_ids))
    user_map = {str(user["_id"]): user for user in users}
    return [user_map[member_id] for member_id in member_ids if member_id in user_map]


async def serialize_room(room: dict, current_user_id: str) -> ChatRoomPublic:
    users = await fetch_users_by_ids(room["member_ids"])
    member_summaries = [serialize_user_summary(user) for user in users]

    room_name = room.get("name", "Untitled room")
    if room["type"] == "direct":
        other_member = next(
            (member for member in member_summaries if member.id != current_user_id),
            None,
        )
        if other_member:
            room_name = other_member.username

    return ChatRoomPublic(
        id=str(room["_id"]),
        name=room_name,
        type=room["type"],
        members=member_summaries,
        created_by=room["created_by"],
        created_at=room["created_at"],
        last_message_at=room.get("last_message_at", room["created_at"]),
        last_message_preview=room.get("last_message_preview"),
    )


async def serialize_message(message: dict) -> ChatMessagePublic:
    sender = await db.users.find_one({"_id": ObjectId(message["sender_id"])})
    if sender is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sender not found")
    return ChatMessagePublic(
        id=str(message["_id"]),
        room_id=message["room_id"],
        sender=serialize_user_summary(sender),
        content=message["content"],
        created_at=message["created_at"],
    )


async def require_room_membership(room_id: str, user_id: str) -> dict:
    if not ObjectId.is_valid(room_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")

    room = await db.rooms.find_one({"_id": ObjectId(room_id), "member_ids": user_id})
    if room is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")
    return room


@router.get("/rooms", response_model=list[ChatRoomPublic])
async def list_rooms(current_user: dict = Depends(get_current_user)):
    current_user_id = str(current_user["_id"])
    rooms = await db.rooms.find(
        {"member_ids": current_user_id},
        sort=[("last_message_at", -1), ("created_at", -1)],
    ).to_list(length=200)
    return [await serialize_room(room, current_user_id) for room in rooms]


@router.post("/rooms/direct", response_model=ChatRoomPublic, status_code=status.HTTP_201_CREATED)
async def create_direct_room(
    payload: DirectRoomCreate,
    current_user: dict = Depends(get_current_user),
):
    current_user_id = str(current_user["_id"])
    if payload.recipient_id == current_user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Choose another user")
    if not ObjectId.is_valid(payload.recipient_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipient not found")

    recipient = await db.users.find_one({"_id": ObjectId(payload.recipient_id)})
    if recipient is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipient not found")

    member_ids = [current_user_id, payload.recipient_id]
    direct_key = build_direct_key(member_ids)

    existing_room = await db.rooms.find_one({"direct_key": direct_key})
    if existing_room:
        return await serialize_room(existing_room, current_user_id)

    now = datetime.now(timezone.utc)
    room_document = {
        "name": recipient["username"],
        "type": "direct",
        "member_ids": member_ids,
        "created_by": current_user_id,
        "created_at": now,
        "last_message_at": now,
        "last_message_preview": None,
        "direct_key": direct_key,
    }

    result = await db.rooms.insert_one(room_document)
    created_room = await db.rooms.find_one({"_id": result.inserted_id})
    return await serialize_room(created_room, current_user_id)


@router.post("/rooms/group", response_model=ChatRoomPublic, status_code=status.HTTP_201_CREATED)
async def create_group_room(
    payload: GroupRoomCreate,
    current_user: dict = Depends(get_current_user),
):
    current_user_id = str(current_user["_id"])
    unique_member_ids = list(dict.fromkeys([current_user_id, *payload.member_ids]))

    if len(unique_member_ids) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Add at least one other member",
        )

    members = await fetch_users_by_ids(unique_member_ids)
    if len(members) != len(unique_member_ids):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Some users were not found")

    now = datetime.now(timezone.utc)
    room_document = {
        "name": payload.name.strip(),
        "type": "group",
        "member_ids": unique_member_ids,
        "created_by": current_user_id,
        "created_at": now,
        "last_message_at": now,
        "last_message_preview": None,
    }

    result = await db.rooms.insert_one(room_document)
    created_room = await db.rooms.find_one({"_id": result.inserted_id})
    return await serialize_room(created_room, current_user_id)


@router.get("/rooms/{room_id}/messages", response_model=list[ChatMessagePublic])
async def list_room_messages(room_id: str, current_user: dict = Depends(get_current_user)):
    await require_room_membership(room_id, str(current_user["_id"]))
    messages = await db.messages.find(
        {"room_id": room_id},
        sort=[("created_at", 1)],
    ).to_list(length=500)
    return [await serialize_message(message) for message in messages]


@router.post("/rooms/{room_id}/messages", response_model=ChatMessagePublic, status_code=status.HTTP_201_CREATED)
async def create_room_message(
    room_id: str,
    payload: MessageCreate,
    current_user: dict = Depends(get_current_user),
):
    room = await require_room_membership(room_id, str(current_user["_id"]))
    content = payload.content.strip()
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Message cannot be empty")

    now = datetime.now(timezone.utc)
    message_document = {
        "room_id": room_id,
        "sender_id": str(current_user["_id"]),
        "content": content,
        "created_at": now,
    }

    result = await db.messages.insert_one(message_document)
    await db.rooms.update_one(
        {"_id": room["_id"]},
        {"$set": {"last_message_at": now, "last_message_preview": content[:120]}},
    )

    created_message = await db.messages.find_one({"_id": result.inserted_id})
    return await serialize_message(created_message)
