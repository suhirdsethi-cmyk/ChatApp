function HomePage({ backendStatus, isAuthenticated, isConnected, onNavigate }) {
  return (
    <main className="page-shell">
      <section className="home-layout">
        <div className="hero-panel">
          <p className="eyebrow">Realtime Chat</p>
          <h1>Different pages, one smooth conversation flow.</h1>
          <p className="description">
            Start from a strong landing page, step into focused auth screens, and enter
            a messaging workspace that feels separate, clean, and intentional.
          </p>

          <blockquote className="page-quote light-quote">
            “Good conversations start before the first message is sent.”
          </blockquote>

          <div className={isConnected ? 'status success' : 'status error'}>
            <span className="status-dot" />
            <span>{backendStatus}</span>
          </div>

          <div className="hero-actions">
            <button type="button" className="primary-button" onClick={() => onNavigate('/signup')}>
              Create Account
            </button>
            <button type="button" className="ghost-button" onClick={() => onNavigate('/login')}>
              Log In
            </button>
            {isAuthenticated ? (
              <button type="button" className="ghost-button" onClick={() => onNavigate('/chat')}>
                Open Chat
              </button>
            ) : null}
          </div>
        </div>

        <div className="home-showcase">
          <div className="showcase-window">
            <div className="showcase-header">
              <span className="showcase-pill">Flow Preview</span>
              <span className="showcase-kicker">Landing to live chat</span>
            </div>

            <div className="showcase-orbit">
              <article className="showcase-node">
                <span>01</span>
                <strong>Landing</strong>
                <p>Product story, quick actions, first impression.</p>
              </article>
              <article className="showcase-node">
                <span>02</span>
                <strong>Signup</strong>
                <p>Create identity and enter the app with intent.</p>
              </article>
              <article className="showcase-node">
                <span>03</span>
                <strong>Login</strong>
                <p>Return fast, restore session, continue smoothly.</p>
              </article>
              <article className="showcase-node accent">
                <span>04</span>
                <strong>Message</strong>
                <p>Open a room and move straight into conversation.</p>
              </article>
            </div>

            <div className="showcase-footer">
              <div>
                <span className="mini-label">Designed for</span>
                <strong>clarity, momentum, and chat-first flow</strong>
              </div>
              {isAuthenticated ? (
                <button type="button" className="ghost-button" onClick={() => onNavigate('/dashboard')}>
                  Continue
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

export default HomePage
