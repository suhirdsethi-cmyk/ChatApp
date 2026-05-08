import { startTransition, useCallback, useEffect, useEffectEvent, useRef, useState } from 'react'
import './App.css'
import { buildApiUrl, buildWebSocketUrl } from './lib/api.js'
import DashboardPage from './pages/DashboardPage.jsx'
import HomePage from './pages/HomePage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import MessagingPage from './pages/MessagingPage.jsx'
import SignupPage from './pages/SignupPage.jsx'
import { getPathname, navigateTo } from './lib/router.js'

const initialSignupForm = {
  username: '',
  email: '',
  password: '',
}

const initialLoginForm = {
  email: '',
  password: '',
}

function sortRoomsByActivity(roomA, roomB) {
  return new Date(roomB.last_message_at) - new Date(roomA.last_message_at)
}

function App() {
  const [pathname, setPathname] = useState(() => getPathname())
  const [backendStatus, setBackendStatus] = useState('Checking backend connection...')
  const [isConnected, setIsConnected] = useState(false)
  const [signupForm, setSignupForm] = useState(initialSignupForm)
  const [loginForm, setLoginForm] = useState(initialLoginForm)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [chatError, setChatError] = useState('')
  const [authData, setAuthData] = useState(() => {
    const savedAuth = localStorage.getItem('chat-auth')
    return savedAuth ? JSON.parse(savedAuth) : null
  })
  const [currentUser, setCurrentUser] = useState(null)
  const [users, setUsers] = useState([])
  const [rooms, setRooms] = useState([])
  const [activeRoomId, setActiveRoomId] = useState('')
  const [messagesByRoom, setMessagesByRoom] = useState({})
  const [isBootstrappingChat, setIsBootstrappingChat] = useState(false)
  const [loadingRoomId, setLoadingRoomId] = useState('')
  const [composer, setComposer] = useState('')
  const [imageDraft, setImageDraft] = useState(null)
  const [showEmojiTray, setShowEmojiTray] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [groupMembers, setGroupMembers] = useState([])
  const [usernameSearch, setUsernameSearch] = useState('')
  const [socketState, setSocketState] = useState('offline')
  const websocketRef = useRef(null)

  const token = authData?.access_token ?? ''

  function clearSession() {
    setAuthData(null)
    setCurrentUser(null)
    setUsers([])
    setRooms([])
    setMessagesByRoom({})
    setActiveRoomId('')
    setChatError('')
    setComposer('')
    setImageDraft(null)
    setGroupName('')
    setGroupMembers([])
    setUsernameSearch('')
    setShowEmojiTray(false)
    setSocketState('offline')
  }

  function goTo(nextPath) {
    navigateTo(nextPath)
    setPathname(getPathname())
  }

  const resolvedPathname =
    (pathname === '/dashboard' || pathname === '/messages') && !token
      ? '/login'
      : (pathname === '/login' || pathname === '/signup') && token
        ? '/dashboard'
        : pathname

  useEffect(() => {
    function syncPath() {
      setPathname(getPathname())
    }

    window.addEventListener('popstate', syncPath)
    return () => {
      window.removeEventListener('popstate', syncPath)
    }
  }, [])

  useEffect(() => {
    async function checkBackend() {
      try {
        const response = await fetch(buildApiUrl('/api/health'))

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const data = await response.json()
        setBackendStatus(data.message)
        setIsConnected(true)
      } catch {
        setBackendStatus('Backend is not reachable')
        setIsConnected(false)
      }
    }

    checkBackend()
  }, [])

  useEffect(() => {
    if (authData) {
      localStorage.setItem('chat-auth', JSON.stringify(authData))
      return
    }

    localStorage.removeItem('chat-auth')
  }, [authData])

  useEffect(() => {
    if (resolvedPathname !== pathname) {
      window.history.replaceState({}, '', resolvedPathname)
    }
  }, [pathname, resolvedPathname])

  const apiRequest = useCallback(async (path, options = {}) => {
    const response = await fetch(buildApiUrl(path), {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    })

    let data
    try {
      data = await response.json()
    } catch {
      data = null
    }

    if (response.status === 401) {
      clearSession()
      goTo('/login')
      throw new Error('Your session expired. Please log in again.')
    }

    if (!response.ok) {
      throw new Error(data?.detail || 'Request failed')
    }

    return data
  }, [token])

  function mergeRoom(nextRoom) {
    setRooms((currentRooms) => {
      const existingIndex = currentRooms.findIndex((room) => room.id === nextRoom.id)
      if (existingIndex === -1) {
        return [...currentRooms, nextRoom].sort(sortRoomsByActivity)
      }

      const updatedRooms = [...currentRooms]
      updatedRooms[existingIndex] = nextRoom
      return updatedRooms.sort(sortRoomsByActivity)
    })
  }

  function mergeFriendsFromRoom(nextRoom) {
    setUsers((currentUsers) => {
      const currentUserIds = new Set(currentUsers.map((user) => user.id))
      const newFriends = nextRoom.members.filter(
        (member) => member.id !== currentUser?.id && !currentUserIds.has(member.id),
      )
      if (newFriends.length === 0) {
        return currentUsers
      }

      return [...currentUsers, ...newFriends].sort((userA, userB) =>
        userA.username.localeCompare(userB.username),
      )
    })
  }

  function removeRoom(roomId) {
    setRooms((currentRooms) => {
      const nextRooms = currentRooms.filter((room) => room.id !== roomId)
      setActiveRoomId((currentActiveRoomId) =>
        currentActiveRoomId === roomId ? nextRooms[0]?.id || '' : currentActiveRoomId,
      )
      return nextRooms
    })
    setMessagesByRoom((currentMessagesByRoom) => {
      const { [roomId]: _removedMessages, ...nextMessagesByRoom } = currentMessagesByRoom
      return nextMessagesByRoom
    })
    setComposer('')
    setImageDraft(null)
    setShowEmojiTray(false)
  }

  useEffect(() => {
    if (!token) {
      return
    }

    let cancelled = false

    async function loadChatWorkspace() {
      setIsBootstrappingChat(true)
      setChatError('')

      try {
        const [me, directoryUsers, chatRooms] = await Promise.all([
          apiRequest('/api/auth/me'),
          apiRequest('/api/auth/users'),
          apiRequest('/api/chat/rooms'),
        ])

        if (cancelled) {
          return
        }

        setCurrentUser(me)
        setUsers(directoryUsers)
        setRooms(chatRooms.sort(sortRoomsByActivity))
        setActiveRoomId((currentActiveRoomId) => currentActiveRoomId || chatRooms[0]?.id || '')
      } catch (error) {
        if (!cancelled) {
          setChatError(error.message)
        }
      } finally {
        if (!cancelled) {
          setIsBootstrappingChat(false)
        }
      }
    }

    loadChatWorkspace()

    return () => {
      cancelled = true
    }
  }, [apiRequest, token])

  useEffect(() => {
    if (!token || !activeRoomId || messagesByRoom[activeRoomId]) {
      return
    }

    let cancelled = false

    async function loadMessages() {
      setLoadingRoomId(activeRoomId)
      try {
        const roomMessages = await apiRequest(`/api/chat/rooms/${activeRoomId}/messages`)
        if (!cancelled) {
          setMessagesByRoom((current) => ({ ...current, [activeRoomId]: roomMessages }))
        }
      } catch (error) {
        if (!cancelled) {
          setChatError(error.message)
        }
      } finally {
        if (!cancelled) {
          setLoadingRoomId('')
        }
      }
    }

    loadMessages()

    return () => {
      cancelled = true
    }
  }, [activeRoomId, apiRequest, messagesByRoom, token])

  const handleSocketEvent = useEffectEvent((event) => {
    const payload = JSON.parse(event.data)

    if (payload.type === 'connection_ready') {
      setSocketState('online')
      return
    }

    if (payload.type === 'presence_update') {
      startTransition(() => {
        setUsers((currentUsers) =>
          currentUsers.map((user) => (user.id === payload.user.id ? payload.user : user)),
        )
        setRooms((currentRooms) =>
          currentRooms.map((room) => ({
            ...room,
            members: room.members.map((member) =>
              member.id === payload.user.id ? payload.user : member,
            ),
          })),
        )
      })
      return
    }

    if (payload.type === 'message_created') {
      startTransition(() => {
        setMessagesByRoom((current) => {
          const existingMessages = current[payload.room_id] || []
          if (existingMessages.some((message) => message.id === payload.message.id)) {
            return current
          }

          return {
            ...current,
            [payload.room_id]: [...existingMessages, payload.message],
          }
        })

        setRooms((currentRooms) =>
          currentRooms
            .map((room) =>
              room.id === payload.room_id
                ? {
                    ...room,
                    last_message_at: payload.message.created_at,
                    last_message_preview: payload.message.content || 'Sent an image',
                  }
                : room,
            )
            .sort(sortRoomsByActivity),
        )
      })
      return
    }

    if (payload.type === 'room_deleted') {
      removeRoom(payload.room_id)
      return
    }

    if (payload.type === 'error') {
      setChatError(payload.message)
    }
  })

  useEffect(() => {
    if (!token) {
      websocketRef.current?.close()
      websocketRef.current = null
      return
    }

    const socket = new WebSocket(buildWebSocketUrl(token))

    websocketRef.current = socket
    socket.addEventListener('message', handleSocketEvent)
    socket.addEventListener('close', () => {
      setSocketState('offline')
    })
    socket.addEventListener('error', () => {
      setSocketState('offline')
      setChatError(
        'Live chat connection failed. If the backend is sleeping on Render, wait 30-60 seconds and retry.',
      )
    })

    return () => {
      socket.removeEventListener('message', handleSocketEvent)
      socket.close()
    }
  }, [token])

  function handleSignupChange(event) {
    const { name, value } = event.target
    setSignupForm((current) => ({ ...current, [name]: value }))
  }

  function handleLoginChange(event) {
    const { name, value } = event.target
    setLoginForm((current) => ({ ...current, [name]: value }))
  }

  async function handleAuthSubmit(mode, event) {
    event.preventDefault()
    setIsSubmitting(true)
    setErrorMessage('')

    const endpoint = mode === 'signup' ? '/api/auth/signup' : '/api/auth/login'
    const payload = mode === 'signup' ? signupForm : loginForm

    try {
      const response = await fetch(buildApiUrl(endpoint), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'Authentication failed')
      }

      setAuthData(data)
      setSignupForm(initialSignupForm)
      setLoginForm(initialLoginForm)
      goTo('/dashboard')
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleLogout() {
    clearSession()
    goTo('/login')
  }

  async function handleStartDirectChat(userId) {
    try {
      const room = await apiRequest('/api/chat/rooms/direct', {
        method: 'POST',
        body: JSON.stringify({ recipient_id: userId }),
      })
      mergeRoom(room)
      mergeFriendsFromRoom(room)
      setActiveRoomId(room.id)
      goTo('/messages')
    } catch (error) {
      setChatError(error.message)
    }
  }

  async function handleStartDirectChatByUsername(event) {
    event.preventDefault()
    const username = usernameSearch.trim()
    if (!username) {
      setChatError('Enter a username.')
      return
    }

    try {
      const room = await apiRequest('/api/chat/rooms/direct/by-username', {
        method: 'POST',
        body: JSON.stringify({ username }),
      })
      mergeRoom(room)
      mergeFriendsFromRoom(room)
      setActiveRoomId(room.id)
      setUsernameSearch('')
      setChatError('')
      goTo('/messages')
    } catch (error) {
      setChatError(error.message)
    }
  }

  async function handleCreateGroup(event) {
    event.preventDefault()
    if (!groupName.trim() || groupMembers.length === 0) {
      setChatError('Add a group name and choose at least one member.')
      return
    }

    try {
      const room = await apiRequest('/api/chat/rooms/group', {
        method: 'POST',
        body: JSON.stringify({
          name: groupName,
          member_ids: groupMembers,
        }),
      })
      mergeRoom(room)
      setActiveRoomId(room.id)
      setGroupName('')
      setGroupMembers([])
      setChatError('')
      goTo('/messages')
    } catch (error) {
      setChatError(error.message)
    }
  }

  async function handleDeleteRoom(room) {
    const roomTypeLabel = room.type === 'group' ? 'group' : 'chat'
    const confirmed = window.confirm(`Delete ${roomTypeLabel} "${room.name}"? This removes all messages.`)
    if (!confirmed) {
      return
    }

    try {
      await apiRequest(`/api/chat/rooms/${room.id}`, {
        method: 'DELETE',
      })
      removeRoom(room.id)
      setChatError('')
    } catch (error) {
      setChatError(error.message)
    }
  }

  function handleOpenMessages(roomId) {
    setActiveRoomId(roomId)
    goTo('/messages')
  }

  function toggleGroupMember(userId) {
    setGroupMembers((currentMembers) =>
      currentMembers.includes(userId)
        ? currentMembers.filter((memberId) => memberId !== userId)
        : [...currentMembers, userId],
    )
  }

  async function sendMessage(event) {
    event.preventDefault()
    const content = composer.trim()
    if ((!content && !imageDraft) || !activeRoomId) {
      return
    }

    setComposer('')
    setImageDraft(null)
    setShowEmojiTray(false)

    if (websocketRef.current?.readyState === WebSocket.OPEN) {
      websocketRef.current.send(
        JSON.stringify({
          type: 'send_message',
          room_id: activeRoomId,
          content,
          image_data_url: imageDraft?.dataUrl || null,
        }),
      )
      return
    }

    try {
      const createdMessage = await apiRequest(`/api/chat/rooms/${activeRoomId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content, image_data_url: imageDraft?.dataUrl || null }),
      })

      setMessagesByRoom((current) => ({
        ...current,
        [activeRoomId]: [...(current[activeRoomId] || []), createdMessage],
      }))

      setRooms((currentRooms) =>
        currentRooms
          .map((room) =>
            room.id === activeRoomId
              ? {
                  ...room,
                  last_message_at: createdMessage.created_at,
                  last_message_preview: createdMessage.content || 'Sent an image',
                }
              : room,
          )
          .sort(sortRoomsByActivity),
      )
    } catch (error) {
      setChatError(error.message)
    }
  }

  function handleImageSelect(file) {
    if (!file) {
      return
    }

    if (!file.type.startsWith('image/')) {
      setChatError('Choose an image file.')
      return
    }

    if (file.size > 1_000_000) {
      setChatError('Images must be under 1 MB.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setImageDraft({
        dataUrl: reader.result,
        name: file.name,
      })
      setChatError('')
    }
    reader.onerror = () => {
      setChatError('Could not read that image. Try another file.')
    }
    reader.readAsDataURL(file)
  }

  const activeRoom = rooms.find((room) => room.id === activeRoomId) ?? null
  const roomMessages = activeRoomId ? messagesByRoom[activeRoomId] || [] : []

  if (resolvedPathname === '/signup') {
    return (
      <SignupPage
        backendStatus={backendStatus}
        errorMessage={errorMessage}
        form={signupForm}
        isConnected={isConnected}
        isSubmitting={isSubmitting}
        onChange={handleSignupChange}
        onNavigate={goTo}
        onSubmit={(event) => handleAuthSubmit('signup', event)}
      />
    )
  }

  if (resolvedPathname === '/login') {
    return (
      <LoginPage
        backendStatus={backendStatus}
        errorMessage={errorMessage}
        form={loginForm}
        isConnected={isConnected}
        isSubmitting={isSubmitting}
        onChange={handleLoginChange}
        onNavigate={goTo}
        onSubmit={(event) => handleAuthSubmit('login', event)}
      />
    )
  }

  if (resolvedPathname === '/dashboard' && currentUser) {
    return (
      <DashboardPage
        backendStatus={backendStatus}
        chatError={chatError}
        currentUser={currentUser}
        groupMembers={groupMembers}
        groupName={groupName}
        isBootstrappingChat={isBootstrappingChat}
        isConnected={isConnected}
        onCreateGroup={handleCreateGroup}
        onGroupNameChange={setGroupName}
        onLogout={handleLogout}
        onOpenMessages={handleOpenMessages}
        onStartDirectChat={handleStartDirectChat}
        onStartDirectChatByUsername={handleStartDirectChatByUsername}
        onToggleGroupMember={toggleGroupMember}
        onUsernameSearchChange={setUsernameSearch}
        rooms={rooms}
        socketState={socketState}
        usernameSearch={usernameSearch}
        users={users}
      />
    )
  }

  if (resolvedPathname === '/messages' && currentUser) {
    return (
      <MessagingPage
        activeRoom={activeRoom}
        activeRoomId={activeRoomId}
        chatError={chatError}
        composer={composer}
        currentUser={currentUser}
        groupMembers={groupMembers}
        groupName={groupName}
        isBootstrappingChat={isBootstrappingChat}
        loadingRoomId={loadingRoomId}
        onBackToDashboard={() => goTo('/dashboard')}
        onComposerChange={setComposer}
        onCreateGroup={handleCreateGroup}
        onGroupNameChange={setGroupName}
        onImageRemove={() => setImageDraft(null)}
        onImageSelect={handleImageSelect}
        onMessageSubmit={sendMessage}
        onRoomDelete={handleDeleteRoom}
        onRoomSelect={setActiveRoomId}
        onStartDirectChat={handleStartDirectChat}
        onStartDirectChatByUsername={handleStartDirectChatByUsername}
        onToggleEmojiTray={() => setShowEmojiTray((current) => !current)}
        onToggleGroupMember={toggleGroupMember}
        onUseEmoji={(emoji) => setComposer((current) => `${current}${emoji}`)}
        roomMessages={roomMessages}
        rooms={rooms}
        selectedImage={imageDraft}
        showEmojiTray={showEmojiTray}
        usernameSearch={usernameSearch}
        users={users}
        onUsernameSearchChange={setUsernameSearch}
      />
    )
  }

  return (
    <HomePage
      backendStatus={backendStatus}
      isAuthenticated={Boolean(token)}
      isConnected={isConnected}
      onNavigate={goTo}
    />
  )
}

export default App
