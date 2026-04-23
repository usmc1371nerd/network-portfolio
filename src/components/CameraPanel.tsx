import { useEffect, useMemo, useState } from 'react'

type CameraSessionState = {
  username: string
  password: string
  failedAttempts: number
  authenticated: boolean
  selectedFeedId: string
}

type CameraPanelProps = {
  label: string
  ip: string
  session: CameraSessionState
  onUsernameChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onSubmitLogin: () => void
  onSelectFeed: (feedId: string) => void
  onClose: () => void
}

const cameraFeeds = [
  { id: 'lobby', name: 'Lobby', location: 'Front entry', statuses: ['No motion', 'Door closed', 'Idle traffic'] },
  { id: 'server-room', name: 'Server Room', location: 'Rack corridor', statuses: ['Cooling stable', 'Cabinet secure', 'No motion'] },
  { id: 'loading-bay', name: 'Loading Bay', location: 'Rear dock', statuses: ['Gate closed', 'Forklift parked', 'Low movement'] },
  { id: 'parking', name: 'Parking', location: 'North lot', statuses: ['Light rain', 'Lot clear', 'One vehicle parked'] },
] as const

function getStatusForFeed(
  feedId: string,
  tick: number,
) {
  const feed = cameraFeeds.find((item) => item.id === feedId) ?? cameraFeeds[0]
  return feed.statuses[tick % feed.statuses.length]
}

export function CameraPanel({
  label,
  ip,
  session,
  onUsernameChange,
  onPasswordChange,
  onSubmitLogin,
  onSelectFeed,
  onClose,
}: CameraPanelProps) {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!session.authenticated) {
      return undefined
    }

    const intervalId = window.setInterval(() => {
      setTick((current) => current + 1)
    }, 1800)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [session.authenticated])

  const activeFeed = useMemo(
    () => cameraFeeds.find((feed) => feed.id === session.selectedFeedId) ?? cameraFeeds[0],
    [session.selectedFeedId],
  )

  return (
    <aside className="content-viewer-panel camera-panel">
      <div className="content-viewer-header">
        <div>
          <p className="content-viewer-eyebrow">Device UI</p>
          <h3>{label} Control Panel</h3>
          <p className="camera-panel-subtitle">{ip}</p>
        </div>
        <button type="button" className="content-viewer-close" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="camera-panel-body">
        {!session.authenticated ? (
          <div className="camera-login-shell">
            <div className="camera-login-card">
              <p className="camera-login-kicker">Legacy camera access</p>
              <h4>Administrator Login</h4>
              <label className="camera-field">
                <span>Username</span>
                <input
                  type="text"
                  value={session.username}
                  onChange={(event) => onUsernameChange(event.target.value)}
                  autoComplete="off"
                />
              </label>
              <label className="camera-field">
                <span>Password</span>
                <input
                  type="password"
                  value={session.password}
                  onChange={(event) => onPasswordChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      onSubmitLogin()
                    }
                  }}
                />
              </label>
              <button type="button" className="camera-login-button" onClick={onSubmitLogin}>
                Sign In
              </button>
              {session.failedAttempts > 0 ? (
                <p className="camera-login-error">
                  Invalid credentials.
                  {session.failedAttempts >= 2 ? ' Hint: some installers never change factory defaults.' : ''}
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="camera-dashboard">
            <div className="camera-banner">
              <span className="camera-banner-pill">LIVE</span>
              <span>Factory credentials detected: `admin / admin`</span>
            </div>
            <div className="camera-main-feed">
              <div className="camera-feed-head">
                <div>
                  <strong>{activeFeed.name}</strong>
                  <span>{activeFeed.location}</span>
                </div>
                <div className="camera-feed-meta">
                  <span>REC</span>
                  <span>{new Date().toLocaleTimeString('en-US', { hour12: false })}</span>
                </div>
              </div>
              <div className="camera-feed-stage">
                <div className="camera-feed-scanlines" />
                <div className="camera-feed-grid" />
                <div className="camera-feed-stamp">{activeFeed.name.toUpperCase()}</div>
                <div className="camera-feed-status">{getStatusForFeed(activeFeed.id, tick)}</div>
              </div>
            </div>
            <div className="camera-feed-picker">
              {cameraFeeds.map((feed, index) => (
                <button
                  key={feed.id}
                  type="button"
                  className={`camera-feed-tile${feed.id === activeFeed.id ? ' is-active' : ''}`}
                  onClick={() => onSelectFeed(feed.id)}
                >
                  <span className="camera-feed-tile-label">{`CH-${index + 1}`}</span>
                  <strong>{feed.name}</strong>
                  <small>{getStatusForFeed(feed.id, tick + index)}</small>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
