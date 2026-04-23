import { TypewriterLoop } from './home/TypewriterLoop'
import { RESUME_URL } from '../constants/resume'

type TopBarProps = {
  onLaunchGuiMode: () => void
  helpEnabled: boolean
  onToggleHelp: () => void
}

export function TopBar({ onLaunchGuiMode, helpEnabled, onToggleHelp }: TopBarProps) {
  return (
    <header className="top-bar">
      <div className="top-bar-brand">
        <h1>JP&apos;s Network Lab</h1>
      </div>
      <div className="top-bar-center" aria-label="Identity">
        <TypewriterLoop className="terminal-topbar-typewriter" />
      </div>
      <div className="top-bar-actions">
        <a
          className="top-bar-link-button top-bar-link-button--resume"
          href={RESUME_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          Grab Resume
        </a>
        <button
          type="button"
          className={`help-toggle-button${helpEnabled ? ' help-toggle-on' : ' help-toggle-off'}`}
          onClick={onToggleHelp}
          title={helpEnabled ? 'Guided help is ON — click to disable' : 'Guided help is OFF — click to enable'}
        >
          Help {helpEnabled ? 'ON' : 'OFF'}
        </button>
        <button type="button" onClick={onLaunchGuiMode}>
          Launch GUI Mode
        </button>
      </div>
    </header>
  )
}
