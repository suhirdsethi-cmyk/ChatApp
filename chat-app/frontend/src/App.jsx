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
  const [showEmojiTray, setShowEmojiTray] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [groupMembers, setGroupMembers] = useState([])
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
    setGroupName('')
    setGroupMembers([])
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
                    last_message_preview: payload.message.content,
                  }
                : room,
            )
            .sort(sortRoomsByActivity),
        )
      })
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
      setActiveRoomId(room.id)
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
    if (!content || !activeRoomId) {
      return
    }

    setComposer('')
    setShowEmojiTray(false)

    if (websocketRef.current?.readyState === WebSocket.OPEN) {
      websocketRef.current.send(
        JSON.stringify({
          type: 'send_message',
          room_id: activeRoomId,
          content,
        }),
      )
      return
    }

    try {
      const createdMessage = await apiRequest(`/api/chat/rooms/${activeRoomId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content }),
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
                  last_message_preview: createdMessage.content,
                }
              : room,
          )
          .sort(sortRoomsByActivity),
      )
    } catch (error) {
      setChatError(error.message)
    }
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
        currentUser={currentUser}
        isBootstrappingChat={isBootstrappingChat}
        isConnected={isConnected}
        onLogout={handleLogout}
        onOpenMessages={handleOpenMessages}
        rooms={rooms}
        socketState={socketState}
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
        onMessageSubmit={sendMessage}
        onRoomSelect={setActiveRoomId}
        onStartDirectChat={handleStartDirectChat}
        onToggleEmojiTray={() => setShowEmojiTray((current) => !current)}
        onToggleGroupMember={toggleGroupMember}
        onUseEmoji={(emoji) => setComposer((current) => `${current}${emoji}`)}
        roomMessages={roomMessages}
        rooms={rooms}
        showEmojiTray={showEmojiTray}
        users={users}
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
