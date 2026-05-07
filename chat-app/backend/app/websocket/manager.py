from collections import defaultdict

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: dict[str, set[WebSocket]] = defaultdict(set)

    async def connect(self, user_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections[user_id].add(websocket)

    def disconnect(self, user_id: str, websocket: WebSocket) -> None:
        connections = self.active_connections.get(user_id)
        if not connections:
            return

        connections.discard(websocket)
        if not connections:
            self.active_connections.pop(user_id, None)

    async def send_to_user(self, user_id: str, payload: dict) -> None:
        for websocket in list(self.active_connections.get(user_id, set())):
            await websocket.send_json(payload)

    async def broadcast_to_users(self, user_ids: list[str], payload: dict) -> None:
        for user_id in set(user_ids):
            await self.send_to_user(user_id, payload)


manager = ConnectionManager()
