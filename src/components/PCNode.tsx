import { Handle, Position, type NodeProps } from 'reactflow'
import type { LabNodeData } from '../App'

export function PCNode({ data }: NodeProps<LabNodeData>) {
  return (
    <div className="lab-node pc-node">
      <Handle type="target" position={Position.Left} />
      <div className="node-title">{data.label}</div>
      <div className="node-subtitle">{data.ip ?? 'IP pending'}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
