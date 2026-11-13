import { useEffect, useState } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import type { LabNodeData } from '../App'

export function PCNode({ data }: NodeProps<LabNodeData>) {
  const nodeClassName = `lab-node pc-node${data.deviceKind ? ` pc-node--${data.deviceKind}` : ''}${data.isConnected ? ' is-connected' : ''}${data.isActiveSession ? ' is-active-session' : ''}`
  const [hintVisible, setHintVisible] = useState(Boolean(data.showGuideHint))

  if (data.showGuideHint && !hintVisible) {
    setHintVisible(true)
  }

  useEffect(() => {
    if (data.showGuideHint) {
      return
    }

    const timeoutId = window.setTimeout(() => setHintVisible(false), 350)
    return () => window.clearTimeout(timeoutId)
  }, [data.showGuideHint])

  return (
    <div className={nodeClassName}>
      <Handle type="target" position={Position.Left} />
      {data.isActiveSession ? <div className="node-session-badge">YOU ARE HERE</div> : null}
      {data.isRemovable && data.onRemove ? (
        <button
          type="button"
          className="node-remove-button"
          aria-label={`Remove ${data.label}`}
          onClick={(event) => {
            event.stopPropagation()
            data.onRemove?.()
          }}
        >
          x
        </button>
      ) : null}
      <div className="node-title">{data.deviceIcon ? `${data.deviceIcon} ${data.label}` : data.label}</div>
      <div className="node-subtitle">
        {data.isActiveSession ? 'ACTIVE SESSION' : `${data.deviceTitle ?? 'CLIENT'}${data.ip ? ` - ${data.ip}` : ' - IP pending'}`}
      </div>
      {data.showCameraShortcut && data.onOpenCameraPanel ? (
        <button
          type="button"
          className="node-camera-shortcut"
          onClick={(event) => {
            event.stopPropagation()
            data.onOpenCameraPanel?.()
          }}
        >
          localhost://8080
        </button>
      ) : null}
      <Handle type="source" position={Position.Right} />
      {hintVisible ? (
        <div className={`node-guide-hint${!data.showGuideHint ? ' is-leaving' : ''}`}>
          Type <strong>{`connect ${data.label.toLowerCase()}`}</strong> in the terminal to continue.
        </div>
      ) : null}
    </div>
  )
}
