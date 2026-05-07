from bson import ObjectId
from fastapi import Depends, HTTPException, WebSocket, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth.jwt_handler import decode_access_token
from app.database.db import db


bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    try:
        payload = decode_access_token(credentials.credentials)
        user_id = payload.get("sub")
        if not user_id or not ObjectId.is_valid(user_id):
            raise ValueError("Missing subject")
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from exc

    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    return user


async def get_current_websocket_user(websocket: WebSocket) -> dict:
    token = websocket.query_params.get("token")
    if not token:
        raise ValueError("Missing websocket token")

    payload = decode_access_token(token)
    user_id = payload.get("sub")
    if not user_id or not ObjectId.is_valid(user_id):
        raise ValueError("Missing subject")

    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if user is None:
        raise ValueError("User not found")

    return user
