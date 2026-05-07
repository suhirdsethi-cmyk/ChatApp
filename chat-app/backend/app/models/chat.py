from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.models.user import UserSummary


class DirectRoomCreate(BaseModel):
    recipient_id: str


class GroupRoomCreate(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    member_ids: list[str] = Field(default_factory=list)


class MessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=2000)


class ChatMessagePublic(BaseModel):
    id: str
    room_id: str
    sender: UserSummary
    content: str
    created_at: datetime


class ChatRoomPublic(BaseModel):
    id: str
    name: str
    type: Literal["direct", "group"]
    members: list[UserSummary]
    created_by: str
    created_at: datetime
    last_message_at: datetime
    last_message_preview: str | None = None
