# Chat App Architecture Overview

## 1. Frontend Pages & Routes

### Pages Structure (`frontend/src/pages/`)

| Page | Route | Purpose |
|------|-------|---------|
| **HomePage** | `/` | Landing page with product description, backend status indicator, and quick navigation buttons |
| **SignupPage** | `/signup` | User registration form (username, email, password) |
| **LoginPage** | `/login` | User authentication form (email, password) |
| **DashboardPage** | `/dashboard` | Main hub showing users list and rooms list for browsing/creating new chats |
| **MessagingPage** | `/messages` | Active chat interface with message display, composer, and room management |

### Router Implementation (`frontend/src/lib/router.js`)

- **Simple client-side router** using `window.location.pathname` and `window.history.pushState()`
- Functions: `getPathname()` to get current path, `navigateTo(path)` to change route
- No external routing library; just history API management

### Authentication Flow

1. User signs up or logs in on auth pages
2. Backend returns JWT token + user data
3. Auth data stored in `localStorage` as JSON (`chat-auth`)
4. Token automatically redirects authenticated users away from auth pages
5. Unauthenticated users redirected away from `/dashboard` and `/messages`

---

## 2. Backend API Endpoints

### Base URL Structure
- Dev: `http://localhost:8000`
- Configured via `VITE_API_BASE_URL` env variable in frontend

### Authentication Endpoints (`/api/auth`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/signup` | Create new user account |
| `POST` | `/api/auth/login` | Authenticate user and get JWT token |
| `GET` | `/api/auth/me` | Get current authenticated user profile |
| `GET` | `/api/auth/users` | List current user's friends (limited to `friend_ids`) |

**Request Bodies:**
- Signup: `{ username, email, password }`
- Login: `{ email, password }`

**Response:**
```json
{
  "access_token": "jwt_token",
  "token_type": "bearer",
  "user": {
    "id": "user_id",
    "username": "username",
    "email": "email@example.com",
    "is_online": false,
    "created_at": "ISO_TIMESTAMP"
  }
}
```

### Chat/Room Endpoints (`/api/chat`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/chat/rooms` | List all rooms user is member of (sorted by last activity) |
| `POST` | `/api/chat/rooms/direct` | Create direct message room with user ID |
| `POST` | `/api/chat/rooms/direct/by-username` | Create direct room by searching username (auto-adds friendship) |
| `POST` | `/api/chat/rooms/group` | Create group chat room |
| `DELETE` | `/api/chat/rooms/{room_id}` | Delete room (only creator for groups) |
| `GET` | `/api/chat/rooms/{room_id}/messages` | Get all messages in a room (max 500) |
| `POST` | `/api/chat/rooms/{room_id}/messages` | Send message via HTTP (alternative to WebSocket) |

**Room Creation Request Examples:**

Direct by ID:
```json
{ "recipient_id": "user_id" }
```

Direct by Username (auto-adds friend):
```json
{ "username": "target_user" }
```

Group:
```json
{ "name": "Group Name", "member_ids": ["user_id_1", "user_id_2"] }
```

---

## 3. Database Models (MongoDB)

### Collections

#### **users**
```javascript
{
  _id: ObjectId,
  username: String,              // Display name (case-sensitive)
  username_lookup: String,       // Lowercase for searching
  email: String,                 // Unique, normalized lowercase
  password: String,              // bcrypt hash
  friend_ids: [String],          // Array of user IDs that are friends
  is_online: Boolean,            // Real-time presence status
  created_at: DateTime
}

// Indexes:
- email (unique)
- username_lookup (unique)
```

#### **rooms**
```javascript
{
  _id: ObjectId,
  name: String,
  type: "direct" | "group",
  member_ids: [String],          // Array of user IDs
  created_by: String,            // User ID of creator
  created_at: DateTime,
  last_message_at: DateTime,
  last_message_preview: String,  // First 120 chars of last message
  direct_key: String             // Only for direct rooms: "id1:id2" (sorted)
}
```

#### **messages**
```javascript
{
  _id: ObjectId,
  room_id: String,               // Room ID (ObjectId as string)
  sender_id: String,             // User ID
  content: String,               // Message text (max 2000 chars)
  image_data_url: String,        // Base64 image (max 1.4MB, JPEG/PNG/GIF/WebP only)
  created_at: DateTime
}
```

### Key Constraints

- **Direct rooms** are deduplicated: users can't create multiple direct rooms with the same person
- **Images**: Base64 encoded data URLs, validated format and size
- **Username validation**: Letters, numbers, underscores only (3-30 chars)
- **Email validation**: Standard email format (5-255 chars)
- **Password**: 6-128 characters

---

## 4. WebSocket Implementation (`/ws/chat`)

### Connection Flow

1. **Establish Connection**
   - URL: `ws://localhost:8000/ws/chat?token=JWT_TOKEN` (configurable base via `VITE_WS_BASE_URL`)
   - Auto-upgrades to `wss://` on HTTPS
   - Authentication via JWT token in query parameter

2. **Connection Ready**
   ```json
   {
     "type": "connection_ready",
     "user_id": "current_user_id"
   }
   ```

### Real-time Message Flow

**Sending a Message:**
```json
{
  "type": "send_message",
  "room_id": "room_id",
  "content": "Hello world",
  "image_data_url": null  // Optional base64 image
}
```

**Broadcast to All Room Members:**
```json
{
  "type": "message_created",
  "room_id": "room_id",
  "message": {
    "id": "message_id",
    "room_id": "room_id",
    "sender": {
      "id": "sender_id",
      "username": "sender_username",
      "email": "sender@example.com",
      "is_online": true
    },
    "content": "Hello world",
    "image_data_url": null,
    "created_at": "ISO_TIMESTAMP"
  }
}
```

### Presence Updates

**Auto-sent when user connects or disconnects:**
```json
{
  "type": "presence_update",
  "user": {
    "id": "user_id",
    "username": "username",
    "email": "email@example.com",
    "is_online": true  // or false
  }
}
```

Broadcast to all users in related rooms (rooms that share a member).

### Additional Events

**Ping/Pong (keep-alive):**
```json
// Client sends:
{ "type": "ping" }

// Server responds:
{ "type": "pong" }
```

**Room Deleted:**
```json
{
  "type": "room_deleted",
  "room_id": "room_id"
}
```

**Error:**
```json
{
  "type": "error",
  "message": "Error description"
}
```

---

## 5. How Users Interact

### User Journey

```
1. Landing (HomePage)
   ↓
2. Sign Up or Log In
   ↓
3. Dashboard (browse friends/rooms)
   ↓
4. Start Chat:
      a. Search by username → auto-add friend → create direct room
      b. Select existing friend → create/open direct room
      c. Create group room with multiple friends
   ↓
5. Messaging Page
   - Display all messages in room
   - Real-time updates via WebSocket
   - Send text messages or images
   - See online status of members
   - Can delete rooms
   ↓
6. User goes back to Dashboard or opens another room
```

### Key Interactions

**Direct Messaging:**
- Click on user → backend creates room with `direct_key` deduplication
- If room already exists, opens existing room
- Friendship is auto-established when initiating first message

**Group Messaging:**
- Only can add existing friends to groups
- Creator can delete group; others can only leave via room deletion
- Group name is custom; direct rooms use other user's username as name

**Real-time Features:**
- Messages appear instantly via WebSocket for all members
- Online/offline status updates automatically broadcast
- Last message preview shown in dashboard for each room
- Rooms sorted by recent activity

**Data Integrity:**
- Users must be friends to message
- Can only message in rooms they're members of
- Direct rooms have deduplication via `direct_key`
- Images validated for format and size before storage

---

## 6. Technology Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Vite, vanilla CSS |
| **Backend** | FastAPI (Python), Async with Motor (MongoDB async driver) |
| **Real-time** | WebSocket (async, broadcast to multiple connections per user) |
| **Database** | MongoDB |
| **Auth** | JWT tokens, bcrypt password hashing |
| **Deployment** | Docker (separate Dockerfile for frontend/backend), optional Render/Vercel config |

---

## 7. Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                     │
├─────────────────────────────────────────────────────────┤
│  HomePage → SignupPage → LoginPage → DashboardPage     │
│                              ↓                          │
│                        MessagingPage                     │
│  • Uses localStorage for JWT auth                      │
│  • Client-side routing                                 │
│  • API calls via fetch                                 │
│  • WebSocket for real-time updates                     │
└──────────────┬──────────────────────────────────────────┘
               │
               │ HTTP (REST) + WebSocket
               │
┌──────────────▼──────────────────────────────────────────┐
│               BACKEND (FastAPI)                         │
├──────────────────────────────────────────────────────────┤
│  Auth Routes          Chat Routes      WebSocket       │
│  • signup             • GET /rooms     • /ws/chat      │
│  • login              • POST /rooms    • Broadcast     │
│  • me                 • DELETE /rooms  • Presence      │
│  • users              • messages       • Real-time     │
│                                        messaging       │
└──────────────┬──────────────────────────────────────────┘
               │
               │ Async Motor (Motor driver)
               │
┌──────────────▼──────────────────────────────────────────┐
│            MONGODB Collections                         │
├──────────────────────────────────────────────────────────┤
│  • users (username, email, password, friends, status)  │
│  • rooms (name, type, members, messages metadata)      │
│  • messages (content, sender, images, timestamp)       │
└──────────────────────────────────────────────────────────┘
```

---

## 8. Security Considerations

1. **JWT Authentication**: All protected endpoints require valid JWT token
2. **Password Hashing**: bcrypt used for password storage
3. **WebSocket Auth**: Token validated at connection establishment
4. **Room Membership**: Users can only access/delete rooms they're members of
5. **Friendship Requirement**: Direct messages restricted to established friends
6. **Image Validation**: Format and size checks before storing/serving
7. **SQL Injection Prevention**: Using MongoDB with parameterized queries
8. **CORS**: Currently set to allow all origins (should be restricted in production)

