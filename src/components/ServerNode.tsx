import { Handle, Position, type NodeProps } from 'reactflow'
import type { LabNodeData } from '../App'

export function ServerNode({ data }: NodeProps<LabNodeData>) {
  const nodeClassName = `lab-node server-node${data.isConnected ? ' is-connected' : ''}`

  return (
    <div className={nodeClassName}>
      <Handle type="target" position={Position.Left} />
      <div className="node-title">{data.label}</div>
      <div className="node-subtitle">IP address: {data.ip}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
