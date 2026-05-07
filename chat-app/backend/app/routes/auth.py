from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.errors import DuplicateKeyError

from app.auth.dependencies import get_current_user
from app.auth.jwt_handler import create_access_token
from app.auth.password import hash_password, verify_password
from app.database.db import db
from app.models.user import AuthResponse, UserCreate, UserLogin, UserPublic, UserSummary


router = APIRouter(prefix="/api/auth", tags=["auth"])


def serialize_user(user: dict) -> UserPublic:
    return UserPublic(
        id=str(user["_id"]),
        username=user["username"],
        email=user["email"],
        is_online=user.get("is_online", False),
        created_at=user["created_at"],
    )


def serialize_user_summary(user: dict) -> UserSummary:
    return UserSummary(
        id=str(user["_id"]),
        username=user["username"],
        email=user["email"],
        is_online=user.get("is_online", False),
    )


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def signup(user: UserCreate):
    normalized_email = user.email.strip().lower()
    normalized_username = user.username.strip()

    existing_user = await db.users.find_one(
        {"$or": [{"email": normalized_email}, {"username": normalized_username}]}
    )
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email or username already exists",
        )

    user_document = {
        "username": normalized_username,
        "email": normalized_email,
        "password": hash_password(user.password),
        "is_online": False,
        "created_at": datetime.now(timezone.utc),
    }

    try:
        result = await db.users.insert_one(user_document)
    except DuplicateKeyError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email or username already exists",
        ) from exc

    created_user = await db.users.find_one({"_id": ObjectId(result.inserted_id)})
    access_token = create_access_token(str(result.inserted_id))

    return AuthResponse(access_token=access_token, user=serialize_user(created_user))


@router.post("/login", response_model=AuthResponse)
async def login(credentials: UserLogin):
    normalized_email = credentials.email.strip().lower()
    user = await db.users.find_one({"email": normalized_email})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    access_token = create_access_token(str(user["_id"]))
    return AuthResponse(access_token=access_token, user=serialize_user(user))


@router.get("/me", response_model=UserPublic)
async def get_me(current_user: dict = Depends(get_current_user)):
    return serialize_user(current_user)


@router.get("/users", response_model=list[UserSummary])
async def list_users(current_user: dict = Depends(get_current_user)):
    cursor = db.users.find(
        {"_id": {"$ne": current_user["_id"]}},
        sort=[("is_online", -1), ("username", 1)],
    )
    users = await cursor.to_list(length=500)
    return [serialize_user_summary(user) for user in users]
