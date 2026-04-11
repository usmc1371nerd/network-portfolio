import { useState } from 'react'
import { changePassword } from '../services/api'

export function Account() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const token = localStorage.getItem('jp_admin_token') ?? ''

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match')
      setSuccess(null)
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      await changePassword(token, currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setSuccess('Password updated successfully')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Password update failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section>
      <h2>Account Security</h2>
      <div className="admin-panel-card">
        <p className="admin-panel-meta">Password rotation</p>
        <p>Use a long unique password and store it in your password manager.</p>
      </div>
      <form onSubmit={handleSubmit} className="simple-form">
        <label>
          Current Password
          <input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
          />
        </label>
        <label>
          New Password
          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            minLength={12}
            required
          />
        </label>
        <label>
          Confirm New Password
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            minLength={12}
            required
          />
        </label>
        {error ? <p className="error-text">{error}</p> : null}
        {success ? <p className="success-text">{success}</p> : null}
        <button type="submit" disabled={loading}>
          {loading ? 'Updating password…' : 'Change password'}
        </button>
      </form>
    </section>
  )
}