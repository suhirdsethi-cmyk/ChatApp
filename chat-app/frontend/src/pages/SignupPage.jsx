function SignupPage({
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
      <section className="auth-page-layout signup-theme">
        <div className="marketing-panel">
          <p className="eyebrow">New Account</p>
          <h1>Start with a clean signup page.</h1>
          <p className="description">
            Create a username, email, and password here. After signup, the app takes you
            straight into the dedicated chat page.
          </p>

          <blockquote className="page-quote dark-quote">
            “Every great chat space begins with one new name joining the room.”
          </blockquote>

          <div className={isConnected ? 'status success' : 'status error'}>
            <span className="status-dot" />
            <span>{backendStatus}</span>
          </div>
        </div>

        <div className="form-panel">
          <div className="auth-card">
            <div className="auth-card-header">
              <p className="eyebrow">Signup</p>
              <h2>Create your account</h2>
            </div>

            <form className="auth-form" onSubmit={onSubmit}>
              <label>
                <span>Username</span>
                <input
                  type="text"
                  name="username"
                  value={form.username}
                  onChange={onChange}
                  placeholder="john_doe"
                  required
                />
              </label>
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
                  placeholder="Minimum 6 characters"
                  required
                />
              </label>

              {errorMessage ? <p className="form-error">{errorMessage}</p> : null}

              <button type="submit" className="primary-button" disabled={isSubmitting}>
                {isSubmitting ? 'Please wait...' : 'Create Account'}
              </button>
            </form>

            <p className="page-switch-copy">
              Already have an account?
              <button type="button" className="text-link" onClick={() => onNavigate('/login')}>
                Log in
              </button>
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}

export default SignupPage
