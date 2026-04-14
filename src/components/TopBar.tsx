type TopBarProps = {
  onLaunchGuiMode: () => void
  helpEnabled: boolean
  onToggleHelp: () => void
}

export function TopBar({ onLaunchGuiMode, helpEnabled, onToggleHelp }: TopBarProps) {
  return (
    <header className="top-bar">
      <h1>JP&apos;s Network Lab</h1>
      <div className="top-bar-actions">
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
