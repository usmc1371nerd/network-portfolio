import type { DragEvent } from 'react'

export function DevicePanel() {
  const handleDragStart = (event: DragEvent<HTMLDivElement>) => {
    event.dataTransfer.setData('application/reactflow', 'pc')
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <aside className="device-panel">
      <h2>Devices</h2>
      <div className="device-icon" draggable onDragStart={handleDragStart}>
        <span className="device-symbol">🖥</span>
        <span>PC (draggable)</span>
      </div>
    </aside>
  )
}
