import { useEffect, useState } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import type { LabNodeData } from '../App'

export function PCNode({ data }: NodeProps<LabNodeData>) {
  const nodeClassName = `lab-node pc-node${data.isConnected ? ' is-connected' : ''}`
  const [hintVisible, setHintVisible] = useState(Boolean(data.showGuideHint))
  const [hintLeaving, setHintLeaving] = useState(false)

  useEffect(() => {
    let timeoutId: number | undefined

    if (data.showGuideHint) {
      setHintVisible(true)
      setHintLeaving(false)
    } else if (hintVisible) {
      setHintLeaving(true)
      timeoutId = window.setTimeout(() => {
        setHintVisible(false)
        setHintLeaving(false)
      }, 350)
    }

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [data.showGuideHint, hintVisible])

  return (
    <div className={nodeClassName}>
      <Handle type="target" position={Position.Left} />
      <div className="node-title">{data.label}</div>
      <div className="node-subtitle">{data.ip ?? 'IP pending'}</div>
      <Handle type="source" position={Position.Right} />
      {hintVisible ? (
        <div className={`node-guide-hint${hintLeaving ? ' is-leaving' : ''}`}>
          Type <strong>help</strong> in the terminal to continue.
        </div>
      ) : null}
    </div>
  )
}
