type PacketLogPanelProps = {
  logs: string[]
}

export function PacketLogPanel({ logs }: PacketLogPanelProps) {
  return (
    <section className="panel packet-log-panel">
      <h3>Network Log</h3>
      <div className="panel-body">
        {logs.length === 0 ? <p className="muted">No network activity yet.</p> : null}
        {logs.map((log, index) => (
          <div key={`${log}-${index}`} className="log-line">
            {log}
          </div>
        ))}
      </div>
    </section>
  )
}
