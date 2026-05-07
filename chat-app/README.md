# Chat App

Full-stack chat app with FastAPI, MongoDB, JWT authentication, and a React frontend.

## Features

- Signup and login APIs
- JWT-protected backend routes
- React auth flow with local session persistence
- Direct messaging
- Group chat rooms
- WebSocket-powered live message delivery
- Online presence updates
- Emoji-ready message composer

## Backend

Start the API from `backend`:

```powershell
.\venv\Scripts\uvicorn.exe app.main:app --reload
```

Required environment variables in `backend\.env`:

```env
MONGO_URL=mongodb://localhost:27017
JWT_SECRET_KEY=replace-with-a-secure-secret
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=60
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,https://your-frontend.vercel.app
```

## Frontend

Start the Vite app from `frontend`:

```powershell
npm install
npm run dev
```

The dev server proxies:

- `/api` to `http://127.0.0.1:8000`
- `/ws` to `ws://127.0.0.1:8000`

For deployed frontend builds, set:

```env
VITE_API_BASE_URL=https://your-backend.onrender.com
VITE_WS_BASE_URL=wss://your-backend.onrender.com
```

Notes:

- If `VITE_WS_BASE_URL` is omitted, the frontend derives it from `VITE_API_BASE_URL`.
- Render free backends can sleep after inactivity, so the first websocket connect may fail until the service wakes up.

## Deployment

Frontend production build:

```powershell
npm run build
```

Backend production start:

```powershell
.\venv\Scripts\uvicorn.exe app.main:app --host 0.0.0.0 --port 8000
```

Deploy with a MongoDB instance available to the backend and set the same environment variables in production.
