from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import CORS_ORIGINS
from app.database.db import close_mongo_connection, connect_to_mongo
from app.routes.auth import router as auth_router
from app.routes.chat import router as chat_router
from app.websocket.chat import router as websocket_router


@asynccontextmanager
async def lifespan(_: FastAPI):
    await connect_to_mongo()
    yield
    await close_mongo_connection()


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(chat_router)
app.include_router(websocket_router)


@app.get("/")
async def root():
    return {"message": "Chat server running"}


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "message": "Backend connected"}
