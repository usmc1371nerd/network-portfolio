import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { bootstrapAdmin, getSetupStatus, type SetupStatus } from '../services/api'

export function Setup() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [setupSecret, setSetupSecret] = useState('')
  const [status, setStatus] = useState<SetupStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [statusLoading, setStatusLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const token = localStorage.getItem('jp_admin_token')

    if (token) {
      navigate('/admin/dashboard', { replace: true })
      return
    }

    const loadStatus = async () => {
      try {
        const nextStatus = await getSetupStatus()
        setStatus(nextStatus)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load setup state')
      } finally {
        setStatusLoading(false)
      }
    }

    void loadStatus()
  }, [navigate])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await bootstrapAdmin(email, password, setupSecret)
      localStorage.setItem('jp_admin_token', result.token)
      navigate('/admin/dashboard', { replace: true })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Setup failed')
    } finally {
      setLoading(false)
    }
  }

  if (statusLoading) {
    return (
      <div className="admin-login">
        <h1>Admin Setup</h1>
        <p>Loading setup state…</p>
      </div>
    )
  }

  if (status?.adminExists) {
    return (
      <div className="admin-login">
        <h1>Admin Setup</h1>
        <div className="admin-panel-card">
          <p className="admin-panel-meta">An admin account already exists.</p>
          <p>Use the normal sign-in page instead.</p>
          <Link to="/admin">Go to login</Link>
        </div>
      </div>
    )
  }

  if (!status?.setupEnabled) {
    return (
      <div className="admin-login">
        <h1>Admin Setup</h1>
        <div className="admin-panel-card">
          <p className="admin-panel-meta">Bootstrap setup is disabled.</p>
          <p>Add `SETUP_SECRET` on the server and keep `SETUP_ENABLED=true` to enable it.</p>
          <Link to="/admin">Back to login</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-login">
      <h1>First Admin Setup</h1>
      <div className="admin-panel-card">
        <p className="admin-panel-meta">One-time bootstrap flow</p>
        <p>
          This form only works before any admin exists. It also requires the server-side setup
          secret.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="simple-form">
        <label>
          Admin Email
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={12}
            required
          />
        </label>
        <label>
          Confirm Password
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            minLength={12}
            required
          />
        </label>
        <label>
          Setup Secret
          <input
            type="password"
            value={setupSecret}
            onChange={(event) => setSetupSecret(event.target.value)}
            minLength={12}
            required
          />
        </label>
        {error ? <p className="error-text">{error}</p> : null}
        <button type="submit" disabled={loading}>
          {loading ? 'Creating admin…' : 'Create admin account'}
        </button>
      </form>
    </div>
  )
}