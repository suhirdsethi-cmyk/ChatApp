from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.models.user import UserSummary


class DirectRoomCreate(BaseModel):
    recipient_id: str


class DirectRoomByUsernameCreate(BaseModel):
    username: str = Field(min_length=3, max_length=30)


class GroupRoomCreate(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    member_ids: list[str] = Field(default_factory=list)


class MessageCreate(BaseModel):
    content: str = Field(default="", max_length=2000)
    image_data_url: str | None = Field(default=None, max_length=1_400_000)

    @model_validator(mode="after")
    def require_content_or_image(self):
        if not self.content.strip() and not self.image_data_url:
            raise ValueError("Message cannot be empty")
        return self


class ChatMessagePublic(BaseModel):
    id: str
    room_id: str
    sender: UserSummary
    content: str
    image_data_url: str | None = None
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
