type TopBarProps = {
  onLaunchGuiMode: () => void
}

export function TopBar({ onLaunchGuiMode }: TopBarProps) {
  return (
    <header className="top-bar">
      <h1>JP&apos;s Network Lab</h1>
      <button type="button" onClick={onLaunchGuiMode}>
        Launch GUI Mode
      </button>
    </header>
  )
}
