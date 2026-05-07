function formatTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function DashboardPage({
  backendStatus,
  currentUser,
  isBootstrappingChat,
  isConnected,
  onLogout,
  onOpenMessages,
  rooms,
  socketState,
}) {
  return (
    <main className="page-shell">
      <section className="chat-page-shell">
        <aside className="chat-brand-panel">
          <p className="eyebrow">Realtime Chat</p>
          <h1>Chat gets its own page now.</h1>
          <p className="description">
            Your first screen is now a dashboard. Review room activity here, then jump
            into the separate messaging page when you want to chat.
          </p>

          <div className={isConnected ? 'status success' : 'status error'}>
            <span className="status-dot" />
            <span>{backendStatus}</span>
          </div>
        </aside>

        <section className="dashboard-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Signed In</p>
              <h2>{currentUser.username}</h2>
            </div>
            <button type="button" className="ghost-button" onClick={onLogout}>
              Log Out
            </button>
          </div>

          <div className="socket-pill">
            <span className={`socket-dot ${socketState}`} />
            <span>
              {socketState === 'online'
                ? 'Realtime connected'
                : socketState === 'connecting'
                  ? 'Connecting live chat...'
                  : 'Realtime offline'}
            </span>
          </div>

          <div className="panel-section">
            <div className="section-title-row">
              <h3>Rooms</h3>
              <span>{rooms.length}</span>
            </div>

            <div className="room-list">
              {rooms.map((room) => (
                <article key={room.id} className="room-card dashboard-room-card">
                  <div className="room-card-top">
                    <strong>{room.name}</strong>
                    <span>{formatTime(room.last_message_at)}</span>
                  </div>
                  <p>{room.last_message_preview || 'No messages yet. Start the conversation.'}</p>
                  <button
                    type="button"
                    className="primary-button room-message-button"
                    onClick={() => onOpenMessages(room.id)}
                  >
                    Message
                  </button>
                </article>
              ))}

              {rooms.length === 0 && !isBootstrappingChat ? (
                <p className="empty-state">No rooms yet. Start a direct chat from the messaging page.</p>
              ) : null}
            </div>
          </div>
        </section>
      </section>
    </main>
  )
}

export default DashboardPage
