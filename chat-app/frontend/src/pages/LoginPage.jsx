function LoginPage({
  backendStatus,
  errorMessage,
  form,
  isConnected,
  isSubmitting,
  onChange,
  onNavigate,
  onSubmit,
}) {
  return (
    <main className="page-shell">
      <section className="auth-page-layout login-theme">
        <div className="marketing-panel">
          <p className="eyebrow">Welcome Back</p>
          <h1>Log in from a dedicated page.</h1>
          <p className="description">
            Sign in here, restore your JWT session, and move into the separate chat
            workspace once authentication succeeds.
          </p>

          <blockquote className="page-quote dark-quote">
            “Pick up the conversation exactly where you left it.”
          </blockquote>

          <div className={isConnected ? 'status success' : 'status error'}>
            <span className="status-dot" />
            <span>{backendStatus}</span>
          </div>
        </div>

        <div className="form-panel">
          <div className="auth-card">
            <div className="auth-card-header">
              <p className="eyebrow">Login</p>
              <h2>Log in to continue</h2>
            </div>

            <form className="auth-form" onSubmit={onSubmit}>
              <label>
                <span>Email</span>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={onChange}
                  placeholder="john@example.com"
                  required
                />
              </label>
              <label>
                <span>Password</span>
                <input
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={onChange}
                  placeholder="Your password"
                  required
                />
              </label>

              {errorMessage ? <p className="form-error">{errorMessage}</p> : null}

              <button type="submit" className="primary-button" disabled={isSubmitting}>
                {isSubmitting ? 'Please wait...' : 'Log In'}
              </button>
            </form>

            <p className="page-switch-copy">
              Need an account?
              <button type="button" className="text-link" onClick={() => onNavigate('/signup')}>
                Sign up
              </button>
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}

export default LoginPage
