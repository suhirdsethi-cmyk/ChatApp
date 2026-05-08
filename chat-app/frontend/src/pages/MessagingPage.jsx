const emojiTray = ['😀', '😂', '🔥', '❤️', '🎉', '👍', '🚀', '✨', '🙌', '🤝']

function formatTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function MessagingPage({
  activeRoom,
  activeRoomId,
  chatError,
  composer,
  currentUser,
  groupMembers,
  groupName,
  isBootstrappingChat,
  loadingRoomId,
  onBackToDashboard,
  onComposerChange,
  onCreateGroup,
  onGroupNameChange,
  onImageRemove,
  onImageSelect,
  onMessageSubmit,
  onRoomDelete,
  onRoomSelect,
  onStartDirectChat,
  onToggleEmojiTray,
  onToggleGroupMember,
  onUseEmoji,
  roomMessages,
  rooms,
  selectedImage,
  showEmojiTray,
  users,
}) {
  return (
    <main className="page-shell">
      <section className="messages-page-shell">
        <section className="messages-main-panel">
          <div className="message-page-topbar">
            <button type="button" className="ghost-button" onClick={onBackToDashboard}>
              Back To Dashboard
            </button>
          </div>

          <header className="chat-header">
            <div>
              <p className="eyebrow">{activeRoom ? activeRoom.type : 'Direct'}</p>
              <h2>{activeRoom ? activeRoom.name : 'Choose a room'}</h2>
            </div>
            <div className="member-strip">
              {activeRoom?.members.map((member) => (
                <span key={member.id} className={member.is_online ? 'member-badge online' : 'member-badge'}>
                  {member.username}
                </span>
              ))}
            </div>
          </header>

          <div className="messages-panel">
            {isBootstrappingChat ? (
              <p className="empty-state">Loading your rooms...</p>
            ) : !activeRoom ? (
              <p className="empty-state">Select a room from the right panel to begin.</p>
            ) : loadingRoomId === activeRoomId && roomMessages.length === 0 ? (
              <p className="empty-state">Loading messages...</p>
            ) : roomMessages.length === 0 ? (
              <p className="empty-state">No messages here yet. Say hello.</p>
            ) : (
              roomMessages.map((message) => {
                const isOwnMessage = message.sender.id === currentUser.id
                return (
                  <article key={message.id} className={isOwnMessage ? 'message-row own' : 'message-row'}>
                    <div className="message-bubble">
                      <div className="message-meta">
                        <strong>{message.sender.username}</strong>
                        <span>{formatTime(message.created_at)}</span>
                      </div>
                      {message.image_data_url ? (
                        <a href={message.image_data_url} target="_blank" rel="noreferrer" className="message-image-link">
                          <img src={message.image_data_url} alt="Shared attachment" className="message-image" />
                        </a>
                      ) : null}
                      {message.content ? <p>{message.content}</p> : null}
                    </div>
                  </article>
                )
              })
            )}
          </div>

          <form className="composer" onSubmit={onMessageSubmit}>
            <div className="composer-tools">
              <button type="button" className="emoji-button" onClick={onToggleEmojiTray}>
                Emoji
              </button>
              <label className={activeRoom ? 'image-upload-button' : 'image-upload-button disabled'}>
                Image
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  disabled={!activeRoom}
                  onChange={(event) => {
                    onImageSelect(event.target.files?.[0])
                    event.target.value = ''
                  }}
                />
              </label>
              {showEmojiTray ? (
                <div className="emoji-tray">
                  {emojiTray.map((emoji) => (
                    <button key={emoji} type="button" onClick={() => onUseEmoji(emoji)}>
                      {emoji}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {selectedImage ? (
              <div className="image-preview">
                <img src={selectedImage.dataUrl} alt="" />
                <div>
                  <strong>{selectedImage.name}</strong>
                  <button type="button" className="text-link" onClick={onImageRemove}>
                    Remove
                  </button>
                </div>
              </div>
            ) : null}

            <textarea
              value={composer}
              onChange={(event) => onComposerChange(event.target.value)}
              placeholder={activeRoom ? 'Write a message...' : 'Choose a room to start chatting'}
              disabled={!activeRoom}
              rows={3}
            />

            <button type="submit" className="primary-button" disabled={!activeRoom || (!composer.trim() && !selectedImage)}>
              Send Message
            </button>
          </form>
        </section>

        <aside className="sidebar directory-panel">
          <div className="panel-section">
            <div className="section-title-row">
              <h3>Rooms</h3>
              <span>{rooms.length}</span>
            </div>
            <div className="room-list">
              {rooms.map((room) => (
                <article key={room.id} className={`room-card ${room.id === activeRoomId ? 'active' : ''}`}>
                  <button type="button" className="room-open-button" onClick={() => onRoomSelect(room.id)}>
                    <div className="room-card-top">
                      <strong>{room.name}</strong>
                      <span>{formatTime(room.last_message_at)}</span>
                    </div>
                    <p>{room.last_message_preview || 'No messages yet. Start the conversation.'}</p>
                  </button>
                  <button type="button" className="danger-button" onClick={() => onRoomDelete(room)}>
                    {room.type === 'group' ? 'Delete Group' : 'Delete Chat'}
                  </button>
                </article>
              ))}
            </div>
          </div>

          <div className="panel-section">
            <div className="section-title-row">
              <h3>People</h3>
              <span>{users.length}</span>
            </div>
            <div className="user-list">
              {users.map((user) => (
                <article key={user.id} className="user-card">
                  <div>
                    <strong>{user.username}</strong>
                    <p>{user.email}</p>
                  </div>
                  <div className="user-actions">
                    <span className={user.is_online ? 'presence-tag online' : 'presence-tag'}>
                      {user.is_online ? 'Online' : 'Offline'}
                    </span>
                    <button type="button" className="ghost-button" onClick={() => onStartDirectChat(user.id)}>
                      Message
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <form className="group-form" onSubmit={onCreateGroup}>
            <div className="section-title-row">
              <h3>Create Group</h3>
              <span>{groupMembers.length} selected</span>
            </div>
            <input
              type="text"
              value={groupName}
              onChange={(event) => onGroupNameChange(event.target.value)}
              placeholder="Weekend Sprint"
            />
            <div className="group-member-grid">
              {users.map((user) => (
                <label key={user.id} className="group-check">
                  <input
                    type="checkbox"
                    checked={groupMembers.includes(user.id)}
                    onChange={() => onToggleGroupMember(user.id)}
                  />
                  <span>{user.username}</span>
                </label>
              ))}
            </div>
            <button type="submit" className="primary-button">
              Create Group
            </button>
          </form>

          {chatError ? <p className="form-error">{chatError}</p> : null}
        </aside>
      </section>
    </main>
  )
}

export default MessagingPage
