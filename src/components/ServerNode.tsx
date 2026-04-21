import { Handle, Position, type NodeProps } from 'reactflow'
import type { LabNodeData } from '../App'

export function ServerNode({ data }: NodeProps<LabNodeData>) {
  const nodeClassName = `lab-node server-node${data.isConnected ? ' is-connected' : ''}${data.isActiveSession ? ' is-active-session' : ''}`

  return (
    <div className={nodeClassName}>
      <Handle type="target" position={Position.Left} />
      {data.isActiveSession ? <div className="node-session-badge">YOU ARE HERE</div> : null}
      <div className="node-title">{data.label}</div>
      <div className="node-subtitle">
        {data.isActiveSession ? 'ACTIVE SESSION' : `IP address: ${data.ip}`}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
