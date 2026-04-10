import { useCallback, type DragEvent } from 'react'
import {
  Background,
  Controls,
  ReactFlow,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeTypes,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeTypes,
} from 'reactflow'
import type { LabNodeData } from '../App'
import 'reactflow/dist/style.css'

type NetworkCanvasProps = {
  nodes: Node<LabNodeData>[]
  edges: Edge[]
  nodeTypes: NodeTypes
  edgeTypes: EdgeTypes
  onNodesChange: (changes: NodeChange[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect: (connection: Connection) => void
  onAddPcNode: (position: { x: number; y: number }) => void
}

export function NetworkCanvas({
  nodes,
  edges,
  nodeTypes,
  edgeTypes,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onAddPcNode,
}: NetworkCanvasProps) {
  const { screenToFlowPosition } = useReactFlow()

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault()

      const deviceType = event.dataTransfer.getData('application/reactflow')
      if (deviceType !== 'pc') {
        return
      }

      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      onAddPcNode(position)
    },
    [onAddPcNode, screenToFlowPosition],
  )

  return (
    <section className="network-canvas" onDrop={handleDrop} onDragOver={handleDragOver}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
      >
        <Background color="rgba(124, 58, 237, 0.25)" gap={24} />
        <Controls />
      </ReactFlow>
    </section>
  )
}
