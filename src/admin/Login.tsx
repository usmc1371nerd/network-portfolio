import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getSetupStatus, login, type SetupStatus } from '../services/api'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<SetupStatus | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const token = localStorage.getItem('jp_admin_token')

    if (token) {
      navigate('/admin/dashboard', { replace: true })
      return
    }

    const loadSetupStatus = async () => {
      try {
        const nextStatus = await getSetupStatus()
        setStatus(nextStatus)

        if (!nextStatus.adminExists && nextStatus.setupEnabled) {
          navigate('/admin/setup', { replace: true })
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load setup state')
      } finally {
        setStatusLoading(false)
      }
    }

    void loadSetupStatus()
  }, [navigate])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const result = await login(email, password)
      localStorage.setItem('jp_admin_token', result.token)
      navigate('/admin/dashboard')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  if (statusLoading) {
    return (
      <div className="admin-login">
        <h1>Admin Login</h1>
        <p>Loading admin access…</p>
      </div>
    )
  }

  return (
    <div className="admin-login">
      <h1>Admin Login</h1>
      {status && !status.adminExists ? (
        <div className="admin-panel-card">
          <p className="admin-panel-meta">No admin account exists yet.</p>
          <p>
            {status.setupEnabled ? (
              <>
                Complete the first-run setup from <Link to="/admin/setup">the setup page</Link>.
              </>
            ) : (
              'Bootstrap setup is disabled on the server. Add a setup secret to enable it.'
            )}
          </p>
        </div>
      ) : null}
      <form onSubmit={handleSubmit} className="simple-form">
        <label>
          Email
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        {error ? <p className="error-text">{error}</p> : null}
        <button type="submit" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
