import type { DragEvent } from 'react'

const deviceOptions = [
  { type: 'pc', symbol: 'PC', label: 'PC', hint: 'general workstation' },
  { type: 'laptop', symbol: 'LT', label: 'Laptop', hint: 'portable client' },
  { type: 'nas', symbol: 'NS', label: 'Backup Node', hint: 'shared storage' },
  { type: 'camera', symbol: 'IO', label: 'IoT Camera', hint: 'edge monitor' },
]

export function DevicePanel() {
  const handleDragStart = (event: DragEvent<HTMLDivElement>, deviceType: string) => {
    event.dataTransfer.setData('application/reactflow', deviceType)
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <aside className="device-panel">
      <h2>Devices</h2>
      <div className="device-list">
        {deviceOptions.map((device) => (
          <div
            key={device.type}
            className="device-icon"
            draggable
            onDragStart={(event) => handleDragStart(event, device.type)}
          >
            <span className="device-symbol">{device.symbol}</span>
            <span className="device-copy">
              <strong>{device.label}</strong>
              <small>{device.hint}</small>
            </span>
          </div>
        ))}
      </div>
    </aside>
  )
}
