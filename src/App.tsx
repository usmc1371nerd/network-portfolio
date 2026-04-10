import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Node,
} from 'reactflow'
import './App.css'
import { DevicePanel } from './components/DevicePanel'
import { NetworkCanvas } from './components/NetworkCanvas'
import { PacketLogPanel } from './components/PacketLogPanel'
import { TerminalPanel } from './components/TerminalPanel'
import { TopBar } from './components/TopBar'
import { serverFileSystem } from './data/serverFileSystem'
import { PCNode } from './components/PCNode'
import { ServerNode } from './components/ServerNode'
import { ConnectionLine } from './components/ConnectionLine'
import {
  buildPrompt,
  initialTerminalLines,
  processTerminalCommand,
  type TerminalContext,
} from './utils/terminal'

export type LabNodeData = {
  label: string
  ip?: string
}

const initialNodes: Node<LabNodeData>[] = [
  {
    id: 'jp-server',
    type: 'serverNode',
    position: { x: 420, y: 180 },
    data: {
      label: 'JP-SERVER',
      ip: '10.0.0.1',
    },
  },
]

function getTimestamp(offsetSeconds = 0): string {
  const date = new Date(Date.now() + offsetSeconds * 1000)
  return date.toLocaleTimeString('en-US', { hour12: false })
}

function getConnectionLogs(pcLabel: string | null): string[] {
  const sourceLabel = pcLabel ?? 'PC-1'
  return [
    `[${getTimestamp(0)}] ARP request broadcast`,
    `[${getTimestamp(0)}] ARP reply from JP-SERVER`,
    `[${getTimestamp(1)}] TCP handshake established`,
    `[${getTimestamp(2)}] ${sourceLabel} joined JP-SERVER LAN (10.0.0.0/24); SSH route to 10.0.0.1 available`,
  ]
}

function allocateNextDhcpIp(assignedIps: string[]): string | null {
  for (let host = 10; host <= 50; host += 1) {
    const ip = `10.0.0.${host}`
    if (!assignedIps.includes(ip)) {
      return ip
    }
  }

  return null
}

function App() {
  const navigate = useNavigate()
  const [isMobileDevice, setIsMobileDevice] = useState(false)
  const [allowMobileLab, setAllowMobileLab] = useState(false)
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [packetLogs, setPacketLogs] = useState<string[]>([])
  const [terminalLines, setTerminalLines] = useState<string[]>(initialTerminalLines)
  const [terminalInput, setTerminalInput] = useState('')
  const [terminalContext, setTerminalContext] = useState<TerminalContext>({
    connected: false,
    connectedTo: null,
    connectedLabel: null,
    connectedIp: null,
    currentPath: [],
  })
  const [nodeCount, setNodeCount] = useState(1)
  const [assignedPcIps, setAssignedPcIps] = useState<string[]>([])

  const nodeTypes = useMemo(
    () => ({
      serverNode: ServerNode,
      pcNode: PCNode,
    }),
    [],
  )

  const edgeTypes = useMemo(
    () => ({
      connectionLine: ConnectionLine,
    }),
    [],
  )

  const knownNodeIps = useMemo(
    () => new Set(['10.0.0.1', ...assignedPcIps]),
    [assignedPcIps],
  )

  const pcNodes = useMemo(() => {
    const map = new Map<string, string>()
    for (const node of nodes) {
      if (node.type === 'pcNode' && node.data.ip && node.data.label) {
        map.set(node.data.ip, node.data.label)
      }
    }
    return map
  }, [nodes])

  const serverNodeData = useMemo(() => {
    const serverNode = nodes.find((node) => node.id === 'jp-server')
    return {
      ip: serverNode?.data.ip ?? '10.0.0.1',
      label: serverNode?.data.label ?? 'JP-SERVER',
    }
  }, [nodes])

  const hasServerConnection = useMemo(
    () =>
      edges.some(
        (edge) =>
          (edge.source === 'jp-server' && edge.target.startsWith('pc-')) ||
          (edge.target === 'jp-server' && edge.source.startsWith('pc-')),
      ),
    [edges],
  )

  const handleConnect = useCallback(
    (connection: Connection) => {
      setEdges((currentEdges) =>
        addEdge({ ...connection, type: 'connectionLine', animated: true }, currentEdges),
      )

      const sourceNode = nodes.find((node) => node.id === connection.source)
      const targetNode = nodes.find((node) => node.id === connection.target)
      const sourcePc = sourceNode?.type === 'pcNode' ? sourceNode.data.label ?? null : null
      const targetPc = targetNode?.type === 'pcNode' ? targetNode.data.label ?? null : null

      setPacketLogs((currentLogs) => [...currentLogs, ...getConnectionLogs(sourcePc ?? targetPc)])
    },
    [nodes, setEdges],
  )

  const handleAddPcNode = useCallback(
    (position: { x: number; y: number }) => {
      const nextId = `pc-${nodeCount}`
      const nextLabel = `PC-${nodeCount}`
      const assignedIp = allocateNextDhcpIp(assignedPcIps)

      if (!assignedIp) {
        setPacketLogs((currentLogs) => [
          ...currentLogs,
          `[${getTimestamp()}] DHCP request from ${nextLabel}`,
          `[${getTimestamp()}] DHCP pool exhausted`,
        ])
        return
      }

      setNodeCount((value) => value + 1)
      setAssignedPcIps((currentIps) => [...currentIps, assignedIp])
      setNodes((currentNodes) => [
        ...currentNodes,
        {
          id: nextId,
          type: 'pcNode',
          position,
          data: {
            label: nextLabel,
            ip: assignedIp,
          },
        },
      ])
      setPacketLogs((currentLogs) => [
        ...currentLogs,
        `[${getTimestamp()}] DHCP request from ${nextLabel}`,
        `[${getTimestamp()}] DHCP assigned ${assignedIp}`,
      ])
      setTerminalLines((currentLines) => [
        ...currentLines,
        'device detected:',
        `${nextLabel} assigned ${assignedIp}`,
        '',
        'credentials:',
        'guest (passwordless)',
        '',
        'connect:',
        `ssh guest@${assignedIp}`,
      ])
    },
    [assignedPcIps, nodeCount, setNodes],
  )

  const handleTerminalSubmit = useCallback(() => {
    const command = terminalInput.trim()

    if (!command) {
      return
    }

    const prompt = buildPrompt(terminalContext)
    const result = processTerminalCommand(command, terminalContext, serverFileSystem, {
      knownIps: knownNodeIps,
      serverReachable: hasServerConnection,
      pcNodes,
      serverIp: serverNodeData.ip,
      serverLabel: serverNodeData.label,
    })

    setTerminalContext(result.context)

    if (result.clear) {
      setTerminalLines([])
      setTerminalInput('')
      return
    }

    setTerminalLines((currentLines) => [...currentLines, `${prompt} ${command}`, ...result.output])

    setTerminalInput('')
  }, [hasServerConnection, knownNodeIps, pcNodes, serverNodeData, terminalContext, terminalInput])

  const handleLaunchGuiMode = useCallback(() => {
    navigate('/gui')
  }, [navigate])

  useEffect(() => {
    const updateViewportMode = () => {
      const coarsePointer = window.matchMedia('(pointer: coarse)').matches
      const narrowViewport = window.innerWidth <= 900
      setIsMobileDevice(coarsePointer || narrowViewport)
    }

    updateViewportMode()
    window.addEventListener('resize', updateViewportMode)
    window.addEventListener('orientationchange', updateViewportMode)

    return () => {
      window.removeEventListener('resize', updateViewportMode)
      window.removeEventListener('orientationchange', updateViewportMode)
    }
  }, [])

  if (isMobileDevice && !allowMobileLab) {
    return (
      <div className="lab-root lab-root--mobile">
        <TopBar onLaunchGuiMode={handleLaunchGuiMode} />
        <main className="mobile-lab-notice">
          <div className="mobile-lab-card">
            <p className="mobile-lab-eyebrow">Mobile device detected</p>
            <h2>JP&apos;s terminal lab works best on a computer.</h2>
            <p>
              The interactive network canvas and terminal are optimized for desktop screens.
              On phones, the layout can feel cramped and unreliable even in landscape mode.
            </p>
            <p>
              For the best experience, open this page on a laptop or desktop. You can still use
              the GUI portfolio right now.
            </p>
            <div className="mobile-lab-actions">
              <button type="button" onClick={handleLaunchGuiMode}>
                Open GUI Portfolio
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setAllowMobileLab(true)}
              >
                Try Terminal Anyway
              </button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <ReactFlowProvider>
      <div className="lab-root">
        <TopBar onLaunchGuiMode={handleLaunchGuiMode} />
        <div className="main-layout">
          <DevicePanel />
          <NetworkCanvas
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={handleConnect}
            onAddPcNode={handleAddPcNode}
          />
        </div>
        <div className="bottom-panel">
          <TerminalPanel
            lines={terminalLines}
            inputValue={terminalInput}
            prompt={buildPrompt(terminalContext)}
            onInputChange={setTerminalInput}
            onSubmit={handleTerminalSubmit}
          />
          <PacketLogPanel logs={packetLogs} />
        </div>
      </div>
    </ReactFlowProvider>
  )
}

export default App
