import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
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
import { CameraPanel } from './components/CameraPanel'
import { serverFileSystem } from './data/serverFileSystem'
import { PCNode } from './components/PCNode'
import { ServerNode } from './components/ServerNode'
import { ConnectionLine } from './components/ConnectionLine'
import { RESUME_DOWNLOAD_NAME, RESUME_URL } from './constants/resume'
import {
  buildPrompt,
  initialTerminalLines,
  processTerminalCommand,
  shadowFileSystem,
  reconcileTerminalContext,
  completeTerminalInput,
  type TerminalContext,
  type TerminalRuntime,
} from './utils/terminal'

export type LabNodeData = {
  label: string
  ip?: string
  deviceKind?: 'pc' | 'laptop' | 'nas' | 'camera' | 'server'
  deviceTitle?: string
  deviceIcon?: string
  isConnected?: boolean
  isActiveSession?: boolean
  showGuideHint?: boolean
  isRemovable?: boolean
  onRemove?: () => void
  showCameraShortcut?: boolean
  onOpenCameraPanel?: () => void
}

type FilePanelState = {
  type: 'file'
  path: string
  content: string
}

type CameraPanelSession = {
  username: string
  password: string
  failedAttempts: number
  authenticated: boolean
  selectedFeedId: string
}

type ActivePanelState =
  | FilePanelState
  | {
      type: 'camera'
      nodeId: string
    }

const initialNodes: Node<LabNodeData>[] = [
  {
    id: 'jp-server',
    type: 'serverNode',
    position: { x: 420, y: 180 },
    data: {
      label: 'JP-SERVER',
      ip: '10.0.0.1',
      deviceKind: 'server',
      deviceTitle: 'CORE SERVER',
      deviceIcon: 'SV',
    },
  },
]

const deviceCatalog: Record<string, { labelPrefix: string; title: string; icon: string }> = {
  pc: { labelPrefix: 'PC', title: 'WORKSTATION', icon: 'PC' },
  laptop: { labelPrefix: 'LAPTOP', title: 'FIELD CLIENT', icon: 'LT' },
  nas: { labelPrefix: 'NAS', title: 'BACKUP NODE', icon: 'NS' },
  camera: { labelPrefix: 'CAM', title: 'IOT SENSOR', icon: 'IO' },
}

function getTimestamp(): string {
  const date = new Date()
  return date.toLocaleTimeString('en-US', { hour12: false })
}

function getConnectionLogs(deviceLabel: string | null, assignedIp: string | undefined): string[] {
  const label = deviceLabel ?? 'CLIENT'
  return [
    `[${getTimestamp()}] Ethernet carrier up: ${label} ↔ JP-SERVER`,
    `[${getTimestamp()}] DHCP DISCOVER from ${label}`,
    `[${getTimestamp()}] DHCP OFFER ${assignedIp} from 10.0.0.1`,
    `[${getTimestamp()}] DHCP REQUEST ${assignedIp} from ${label}`,
    `[${getTimestamp()}] DHCP ACK ${assignedIp}/24; gateway/DNS 10.0.0.1`,
  ]
}

function isServerOnlyLink(sourceId: string, targetId: string): boolean {
  return sourceId === 'jp-server' || targetId === 'jp-server'
}

function getProvisioningLogs(deviceLabel: string, assignedIp: string, deviceTitle: string): string[] {
  return [
    `[${getTimestamp()}] ${deviceTitle} ${deviceLabel} added; interface has no carrier`,
    `[${getTimestamp()}] Lab DHCP pool reserved ${assignedIp}; lease pending cable connection`,
  ]
}

function getCommandAuditLogs(options: {
  command: string
  prompt: string
  previousContext: TerminalContext
  nextContext: TerminalContext
  output: string[]
  triggeredSecurityGlitch?: boolean
  openedFilePath?: string
}): string[] {
  const {
    command,
    prompt,
    previousContext,
    nextContext,
    output,
    triggeredSecurityGlitch,
    openedFilePath,
  } = options
  const logs = [`[${getTimestamp()}] cmd: ${prompt} ${command}`]

  if (previousContext.connectedTo !== nextContext.connectedTo) {
    logs.push(
      `[${getTimestamp()}] session: ${previousContext.connectedTo ?? 'visitor'} -> ${nextContext.connectedTo ?? 'visitor'}`,
    )
  }

  if (!previousContext.shadowDiscovered && nextContext.shadowDiscovered) {
    logs.push(`[${getTimestamp()}] recon: hidden host signature detected (10.0.13.37)`)
  }

  if (
    previousContext.connectedTo !== 'shadow' &&
    nextContext.connectedTo === 'shadow'
  ) {
    logs.push(`[${getTimestamp()}] access: hidden network access granted (${nextContext.connectedIp ?? '10.0.13.37'})`)
  }

  if (
    previousContext.connectedTo === 'shadow' &&
    nextContext.connectedTo !== 'shadow'
  ) {
    logs.push(`[${getTimestamp()}] access: exited hidden network and returned to lab`)
  }

  if (openedFilePath) {
    logs.push(`[${getTimestamp()}] file: viewed ${openedFilePath}`)
  }

  if (triggeredSecurityGlitch) {
    logs.push(`[${getTimestamp()}] sec: suspicious command trapped and replaced with 404 decoy`)
  }

  if (output.some((line) => line.toLowerCase().includes('permission denied') || line.toLowerCase().includes('access denied'))) {
    logs.push(`[${getTimestamp()}] auth: access denied`)
  }

  return logs
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

function getDirectoryForPath(
  root: Record<string, unknown>,
  path: string[],
): Record<string, unknown> | null {
  let cursor: Record<string, unknown> = root

  for (const segment of path) {
    const nextNode = cursor[segment]
    if (!nextNode || typeof nextNode === 'string') {
      return null
    }

    cursor = nextNode as Record<string, unknown>
  }

  return cursor
}

function renderViewerContent(content: string): Array<string | { text: string; href: string }> {
  const urlPattern = /(https?:\/\/[^\s]+)/g
  const segments: Array<string | { text: string; href: string }> = []
  let lastIndex = 0
  let match = urlPattern.exec(content)

  while (match) {
    const matchStart = match.index
    const matchValue = match[0]

    if (matchStart > lastIndex) {
      segments.push(content.slice(lastIndex, matchStart))
    }

    segments.push({ text: matchValue, href: matchValue })
    lastIndex = matchStart + matchValue.length
    match = urlPattern.exec(content)
  }

  if (lastIndex < content.length) {
    segments.push(content.slice(lastIndex))
  }

  return segments
}

function getAlwaysOnSuggestedCommands(options: {
  helpEnabled: boolean
  context: TerminalContext
  runtime: TerminalRuntime
}): string[] {
  const { helpEnabled, context, runtime } = options
  if (!helpEnabled) return []
  if (context.pendingSSH) return context.pendingSSH.phase === 'host-key' ? ['yes', 'no'] : []
  if (!context.connectedTo) {
    const workstation = Array.from(runtime.pcNodes).find(([ip]) => ['pc', 'laptop'].includes(runtime.deviceKinds.get(ip) ?? 'pc'))
    return workstation ? [`console ${workstation[1].toLowerCase()}`, 'help'] : ['help', 'resume']
  }
  if (context.connectedTo === 'pc') {
    if (!runtime.linkedIps.has(context.connectedIp ?? '')) return ['ip addr', 'ip route', 'help']
    return ['ip addr', 'ip route', 'ping -c 4 server', 'nmap -sn 10.0.0.0/24', 'ssh guest@server', 'help']
  }
  const root = context.connectedTo === 'shadow' ? shadowFileSystem : serverFileSystem
  const directory = getDirectoryForPath(root as Record<string, unknown>, context.currentPath)
  return ['pwd', 'ls', 'ip route', 'exit', ...(context.currentPath.length ? ['cd ..'] : []), ...Object.entries(directory ?? {}).filter(([name]) => !name.startsWith('.')).map(([name, value]) => `${typeof value === 'string' ? 'cat' : 'cd'} ${name}`)]
}

function App() {
  const navigate = useNavigate()
  const [isMobileDevice, setIsMobileDevice] = useState(false)
  const [allowMobileLab, setAllowMobileLab] = useState(false)
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [packetLogs, setPacketLogs] = useState<string[]>([])
  const [activePanel, setActivePanel] = useState<ActivePanelState | null>(null)
  const [cameraSessions, setCameraSessions] = useState<Record<string, CameraPanelSession>>({})
  const [terminalLines, setTerminalLines] = useState<string[]>(initialTerminalLines)
  const [terminalInput, setTerminalInput] = useState('')
  const [terminalRunning, setTerminalRunning] = useState(false)
  const terminalTimersRef = useRef<number[]>([])
  const terminalRunningRef = useRef(false)
  const pingProgressRef = useRef<{ target: string; received: number } | null>(null)

  const [commandHistory, setCommandHistory] = useState<string[]>([])
  const [historyCursor, setHistoryCursor] = useState<number | null>(null)
  const [historyDraftInput, setHistoryDraftInput] = useState('')
  const [terminalContext, setTerminalContext] = useState<TerminalContext>({
    connected: false,
    connectedTo: null,
    connectedLabel: null,
    connectedIp: null,
    lastPcLabel: null,
    lastPcIp: null,
    currentPath: [],
    onboardingStep: 'drop-pc-1',
    shadowDiscovered: false,
  })
  const cancelTerminalCommand = useCallback(() => {
    terminalTimersRef.current.forEach(window.clearTimeout)
    terminalTimersRef.current = []
    terminalRunningRef.current = false
    setTerminalRunning(false)
    setTerminalInput('')
    setHistoryCursor(null)
    setHistoryDraftInput('')
    setTerminalContext(current => ({ ...current, pendingSSH: undefined }))
    const ping = pingProgressRef.current
    pingProgressRef.current = null
    setTerminalLines(current => [...current, '^C', ...(ping ? [
      `--- ${ping.target} ping statistics ---`,
      `${ping.received} packets transmitted, ${ping.received} received, 0% packet loss (interrupted)`,
    ] : [])])
    setPacketLogs(current => [...current, `[${getTimestamp()}] terminal: command/login canceled by user`])
  }, [])
  const [nodeCount, setNodeCount] = useState(1)
  const [assignedPcIps, setAssignedPcIps] = useState<string[]>([])
  const [helpEnabled, setHelpEnabled] = useState(true)
  const [terminalGlitchActive, setTerminalGlitchActive] = useState(false)
  const [packetAnimation, setPacketAnimation] = useState<{
    fromNodeId: string
    toNodeId: string
    pulse: number
  } | null>(null)
  const packetAnimationTimeoutRef = useRef<number | null>(null)
  const glitchTimeoutRef = useRef<number | null>(null)

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

  const activeCameraNode = useMemo(() => {
    if (!activePanel || activePanel.type !== 'camera') {
      return null
    }

    return nodes.find((node) => node.id === activePanel.nodeId && node.type === 'pcNode') ?? null
  }, [activePanel, nodes])

  const activeCameraSession = useMemo(() => {
    if (!activeCameraNode) {
      return null
    }

    return (
      cameraSessions[activeCameraNode.id] ?? {
        username: '',
        password: '',
        failedAttempts: 0,
        authenticated: false,
        selectedFeedId: 'lobby',
      }
    )
  }, [activeCameraNode, cameraSessions])

  const hasServerConnection = useMemo(
    () =>
      edges.some(
        (edge) =>
          (edge.source === 'jp-server' && edge.target.startsWith('pc-')) ||
          (edge.target === 'jp-server' && edge.source.startsWith('pc-')),
      ),
    [edges],
  )

  const connectedNodeIds = useMemo(() => {
    const ids = new Set<string>()
    for (const edge of edges) {
      ids.add(edge.source)
      ids.add(edge.target)
    }
    return ids
  }, [edges])

  const terminalRuntime = useMemo<TerminalRuntime>(() => ({
    knownIps: knownNodeIps,
    serverReachable: hasServerConnection,
    pcNodes,
    linkedIps: new Set(nodes.filter(node => node.data.ip && edges.some(edge =>
      (edge.source === node.id && edge.target === 'jp-server') ||
      (edge.target === node.id && edge.source === 'jp-server'),
    )).map(node => node.data.ip!)),
    deviceKinds: new Map(nodes.filter(node => node.data.ip).map(node => [node.data.ip!, node.data.deviceKind ?? 'pc'])),
    serverIp: serverNodeData.ip,
    serverLabel: serverNodeData.label,
    helpEnabled,
  }), [edges, nodes, knownNodeIps, hasServerConnection, pcNodes, serverNodeData, helpEnabled])

  const labelToNodeId = useMemo(() => {
    const map = new Map<string, string>()

    for (const node of nodes) {
      if (node.data.label) {
        map.set(node.data.label.toLowerCase(), node.id)
      }
    }

    return map
  }, [nodes])

  const ipToNodeId = useMemo(() => {
    const map = new Map<string, string>()
    map.set(serverNodeData.ip, 'jp-server')

    for (const node of nodes) {
      if (node.type === 'pcNode' && node.data.ip) {
        map.set(node.data.ip, node.id)
      }
    }

    return map
  }, [nodes, serverNodeData.ip])

  const triggerPacketAnimation = useCallback(
    (fromNodeId: string, toNodeId: string, requireExistingEdge = true) => {
      const hasMatchingEdge = edges.some(
        (edge) =>
          (edge.source === fromNodeId && edge.target === toNodeId) ||
          (edge.source === toNodeId && edge.target === fromNodeId),
      )

      if (requireExistingEdge && !hasMatchingEdge) {
        return
      }

      setPacketAnimation((currentPacket) => ({
        fromNodeId,
        toNodeId,
        pulse: (currentPacket?.pulse ?? 0) + 1,
      }))

      if (packetAnimationTimeoutRef.current) {
        window.clearTimeout(packetAnimationTimeoutRef.current)
      }

      packetAnimationTimeoutRef.current = window.setTimeout(() => {
        setPacketAnimation(null)
        packetAnimationTimeoutRef.current = null
      }, 1125)
    },
    [edges],
  )

  const openCameraPanel = useCallback((nodeId: string) => {
    setCameraSessions((currentSessions) => ({
      ...currentSessions,
      [nodeId]: currentSessions[nodeId] ?? {
        username: '',
        password: '',
        failedAttempts: 0,
        authenticated: false,
        selectedFeedId: 'lobby',
      },
    }))
    setActivePanel({ type: 'camera', nodeId })
  }, [])

  const updateCameraSession = useCallback(
    (nodeId: string, updater: (session: CameraPanelSession) => CameraPanelSession) => {
      setCameraSessions((currentSessions) => {
        const currentSession =
          currentSessions[nodeId] ?? {
            username: '',
            password: '',
            failedAttempts: 0,
            authenticated: false,
            selectedFeedId: 'lobby',
          }

        return {
          ...currentSessions,
          [nodeId]: updater(currentSession),
        }
      })
    },
    [],
  )

  const handleRemoveDeviceNode = useCallback((nodeId: string) => {
    if (terminalRunningRef.current) cancelTerminalCommand()
    const nodeToRemove = nodes.find((node) => node.id === nodeId)

    if (!nodeToRemove || nodeToRemove.type !== 'pcNode') {
      return
    }

    const removedLabel = nodeToRemove.data.label
    const removedIp = nodeToRemove.data.ip ?? null
    const remainingClientCount = nodes.filter(
      (node) => node.type === 'pcNode' && node.id !== nodeId,
    ).length
    const shouldDisconnectSession =
      (terminalContext.connectedLabel !== null &&
        terminalContext.connectedLabel.toLowerCase() === removedLabel.toLowerCase()) ||
      (terminalContext.lastPcLabel !== null &&
        terminalContext.lastPcLabel.toLowerCase() === removedLabel.toLowerCase())

    setNodes((currentNodes) => currentNodes.filter((node) => node.id !== nodeId))
    setEdges((currentEdges) =>
      currentEdges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
    )

    if (removedIp) {
      setAssignedPcIps((currentIps) => currentIps.filter((ip) => ip !== removedIp))
    }

    setCameraSessions((currentSessions) => {
      if (!(nodeId in currentSessions)) {
        return currentSessions
      }

      const nextSessions = { ...currentSessions }
      delete nextSessions[nodeId]
      return nextSessions
    })

    setActivePanel((currentPanel) =>
      currentPanel?.type === 'camera' && currentPanel.nodeId === nodeId ? null : currentPanel,
    )

    if (
      packetAnimation &&
      (packetAnimation.fromNodeId === nodeId || packetAnimation.toNodeId === nodeId)
    ) {
      setPacketAnimation(null)
    }

    setPacketLogs((currentLogs) => [
      ...currentLogs,
      `[${getTimestamp()}] device removed: ${removedLabel}${removedIp ? ` (${removedIp})` : ''}`,
      `[${getTimestamp()}] routes pruned for ${removedLabel}`,
    ])

    setTerminalLines((currentLines) => {
      const nextLines = [
        ...currentLines,
        `system: ${removedLabel} removed from the network map`,
      ]

      if (shouldDisconnectSession) {
        nextLines.push('session lost: active route disappeared')
      }

      return nextLines
    })

    if (shouldDisconnectSession) {
      setActivePanel(null)
      return
    }

    if (remainingClientCount === 0) {
      setTerminalContext((currentContext) => ({
        ...currentContext,
        onboardingStep: 'drop-pc-1',
      }))
    }
  }, [cancelTerminalCommand, nodes, packetAnimation, setEdges, setNodes, terminalContext.connectedLabel, terminalContext.lastPcLabel])

  const decoratedNodes = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          isConnected: connectedNodeIds.has(node.id),
          isActiveSession:
            terminalContext.connectedLabel !== null &&
            node.data.label.toLowerCase() === terminalContext.connectedLabel.toLowerCase(),
          showGuideHint: helpEnabled && node.data.label === terminalContext.connectedLabel && terminalContext.connectedTo === 'pc' && !connectedNodeIds.has(node.id),
          isRemovable: node.type === 'pcNode',
          onRemove: node.type === 'pcNode' ? () => handleRemoveDeviceNode(node.id) : undefined,
          showCameraShortcut:
            node.type === 'pcNode' &&
            node.data.deviceKind === 'camera' &&
            connectedNodeIds.has(node.id) &&
            !(activePanel?.type === 'camera' && activePanel.nodeId === node.id),
          onOpenCameraPanel:
            node.type === 'pcNode' && node.data.deviceKind === 'camera'
              ? () => openCameraPanel(node.id)
              : undefined,
        },
      })),
    [activePanel, connectedNodeIds, handleRemoveDeviceNode, helpEnabled, nodes, openCameraPanel, terminalContext.connectedLabel, terminalContext.connectedTo],
  )

  const suggestedCommands = useMemo(
    () => terminalRunning ? [] : getAlwaysOnSuggestedCommands({ helpEnabled, context: terminalContext, runtime: terminalRuntime }),
    [terminalRunning, helpEnabled, terminalContext, terminalRuntime],
  )

  const canvasGuideMessage = useMemo(() => {
    if (!helpEnabled) {
      return null
    }

    if (nodeCount === 1 && terminalContext.onboardingStep === 'drop-pc-1') {
      return 'Drag a PC or laptop onto the canvas to open its local console.'
    }

    if (terminalContext.pendingSSH) return 'Complete SSH login in the terminal; Ctrl+C cancels.'
    if (terminalRunning) return 'Command running. Ctrl+C cancels.'
    if (terminalContext.connectedTo === 'pc' && !terminalRuntime.linkedIps.has(terminalContext.connectedIp ?? '')) return 'Draw a cable from this workstation to JP-SERVER, then inspect ip addr and ip route.'
    return `Try: ${suggestedCommands[0] ?? 'help'}. See terminal for suggested commands.`
  }, [helpEnabled, nodeCount, suggestedCommands, terminalContext, terminalRunning, terminalRuntime])

  const connectNodesById = useCallback(
    (sourceId: string, targetId: string, shouldAnimateImmediately = true) => {
      if (sourceId === targetId) {
        return false
      }

      const sourceNode = nodes.find((node) => node.id === sourceId)
      const targetNode = nodes.find((node) => node.id === targetId)
      const sourceIsCamera = sourceNode?.data.deviceKind === 'camera'
      const targetIsCamera = targetNode?.data.deviceKind === 'camera'

      if (!isServerOnlyLink(sourceId, targetId)) {
        setPacketLogs((currentLogs) => [
          ...currentLogs,
          `[${getTimestamp()}] policy deny: device-to-device links are disabled; route through JP-SERVER`,
        ])
        setTerminalLines((currentLines) => [
          ...currentLines,
          'policy: devices can only connect to JP-SERVER',
        ])
        return false
      }

      const hasMatchingEdge = edges.some(
        (edge) =>
          (edge.source === sourceId && edge.target === targetId) ||
          (edge.source === targetId && edge.target === sourceId),
      )

      if (hasMatchingEdge) {
        return false
      }

      const newEdgeId = `${sourceId}-${targetId}-${Date.now()}`
      setEdges((currentEdges) =>
        addEdge({ id: newEdgeId, source: sourceId, target: targetId, type: 'connectionLine', animated: true }, currentEdges),
      )

      const sourcePc = sourceNode?.type === 'pcNode' ? sourceNode.data.label ?? null : null
      const targetPc = targetNode?.type === 'pcNode' ? targetNode.data.label ?? null : null
      const cameraNodeId =
        sourceIsCamera && targetId === 'jp-server'
          ? sourceId
          : targetIsCamera && sourceId === 'jp-server'
            ? targetId
            : null

      if (
        (sourceId === 'pc-1' && targetId === 'jp-server') ||
        (sourceId === 'jp-server' && targetId === 'pc-1')
      ) {
        triggerPacketAnimation(sourceId, targetId, false)
      } else if (shouldAnimateImmediately) {
        triggerPacketAnimation(sourceId, targetId, false)
      }

      setPacketLogs((currentLogs) => [...currentLogs, ...getConnectionLogs(sourcePc ?? targetPc, sourceNode?.type === 'pcNode' ? sourceNode.data.ip : targetNode?.data.ip)])

      if (cameraNodeId) {
        openCameraPanel(cameraNodeId)
      }

      return true
    },
    [edges, nodes, openCameraPanel, setEdges, triggerPacketAnimation],
  )

  const decoratedEdges = useMemo(
    () =>
      edges.map((edge) => ({
        ...edge,
        data: {
          ...edge.data,
          showPacket:
            Boolean(packetAnimation) &&
            ((edge.source === packetAnimation?.fromNodeId &&
              edge.target === packetAnimation?.toNodeId) ||
              (edge.source === packetAnimation?.toNodeId &&
                edge.target === packetAnimation?.fromNodeId)),
          packetDirection:
            packetAnimation &&
            edge.source === packetAnimation.fromNodeId &&
            edge.target === packetAnimation.toNodeId
              ? 'forward'
              : 'reverse',
          packetKey:
            packetAnimation &&
            ((edge.source === packetAnimation.fromNodeId &&
              edge.target === packetAnimation.toNodeId) ||
              (edge.source === packetAnimation.toNodeId &&
                edge.target === packetAnimation.fromNodeId))
              ? packetAnimation.pulse
              : 0,
        },
      })),
    [edges, packetAnimation],
  )

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) {
        return
      }

      connectNodesById(connection.source, connection.target)
    },
    [connectNodesById],
  )

  const handleAddDeviceNode = useCallback(
    (deviceType: string, position: { x: number; y: number }) => {
      const deviceProfile = deviceCatalog[deviceType] ?? deviceCatalog.pc
      const nextId = `pc-${nodeCount}`
      const nextLabel = `${deviceProfile.labelPrefix}-${nodeCount}`
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
            deviceKind: (deviceType in deviceCatalog ? deviceType : 'pc') as LabNodeData['deviceKind'],
            deviceTitle: deviceProfile.title,
            deviceIcon: deviceProfile.icon,
          },
        },
      ])
      setPacketLogs((currentLogs) => [
        ...currentLogs,
        ...getProvisioningLogs(nextLabel, assignedIp, deviceProfile.title),
      ])
      setTerminalLines((currentLines) => [
        ...currentLines,
        'device detected:',
        `${nextLabel}: interface DOWN; address ${assignedIp} reserved until cabled`,
        `${deviceProfile.title} ready for uplink`,
        '',
        'next step:',
        `draw a cable from ${nextLabel} to JP-SERVER (or lab control: connect ${nextLabel.toLowerCase()})`,
      ])
      if (['pc', 'laptop'].includes(deviceType)) {
        setTerminalContext(current => current.connectedTo ? current : {
          ...current, connected: true, connectedTo: 'pc', connectedLabel: nextLabel,
          connectedIp: assignedIp, lastPcLabel: nextLabel, lastPcIp: assignedIp,
          user: 'guest', currentPath: [], sessions: [], onboardingStep: 'connect-pc-1',
        })
      }
    },
    [assignedPcIps, nodeCount, setNodes],
  )

  const executeTerminalCommand = useCallback((rawCommand: string) => {
    if (terminalRunningRef.current) return
    const isPassword = terminalContext.pendingSSH?.phase === 'password'
    const command = isPassword ? rawCommand : rawCommand.trim()

    if (!command && !terminalContext.pendingSSH) {
      return
    }

    if (!terminalContext.pendingSSH) setCommandHistory((currentHistory) => [...currentHistory, command])
    setHistoryCursor(null)
    setHistoryDraftInput('')
    setTerminalGlitchActive(false)

    if (glitchTimeoutRef.current) {
      window.clearTimeout(glitchTimeoutRef.current)
      glitchTimeoutRef.current = null
    }

    const previousContext = terminalContext
    const prompt = buildPrompt(previousContext)
    const result = processTerminalCommand(command, previousContext, serverFileSystem, terminalRuntime)

    setTerminalContext(result.context)

    const auditLogs = getCommandAuditLogs({
      command: isPassword ? '[password redacted]' : command,
      prompt,
      previousContext,
      nextContext: result.context,
      output: result.output,
      triggeredSecurityGlitch: result.triggeredSecurityGlitch,
      openedFilePath: result.openedFile?.path,
    })
    setPacketLogs((currentLogs) => [...currentLogs, ...auditLogs, ...(result.networkLogs ?? []).map(line => `[${getTimestamp()}] ${line}`)])

    if (result.triggeredSecurityGlitch) {
      setTerminalGlitchActive(true)
      glitchTimeoutRef.current = window.setTimeout(() => {
        setTerminalGlitchActive(false)
        glitchTimeoutRef.current = null
      }, 1400)
    }

    if (result.clear) {
      setTerminalLines([])
      setTerminalInput('')
      return
    }

    if (result.openedFile) {
      setActivePanel({
        type: 'file',
        path: result.openedFile.path,
        content: result.openedFile.content,
      })
    }

    if (result.packetEvent) {
      const fromNodeId = ipToNodeId.get(result.packetEvent.fromIp)
      const toNodeId = ipToNodeId.get(result.packetEvent.toIp)

      if (fromNodeId && toNodeId) {
        triggerPacketAnimation(fromNodeId, toNodeId)
      }
    }

    if (result.connectionEvent) {
      const { sourceLabel, targetLabel } = result.connectionEvent
      const sourceId = labelToNodeId.get(sourceLabel.toLowerCase())
      const targetId = labelToNodeId.get(targetLabel.toLowerCase())

      if (sourceId && targetId) {
        connectNodesById(sourceId, targetId)
      }
    }

    const echo = `${prompt}${isPassword ? '' : ` ${command}`}`
    if (result.streamed && result.output.length > 0) {
      terminalRunningRef.current = true
      pingProgressRef.current = result.output[0].startsWith('PING ') && result.packetEvent
        ? { target: result.packetEvent.toIp, received: 0 } : null
      setTerminalRunning(true)
      setTerminalLines(current => [...current, echo])
      result.output.forEach((line, index) => {
        const timer = window.setTimeout(() => {
          setTerminalLines(current => [...current, line])
          if (line.includes('icmp_seq=') && pingProgressRef.current) {
            pingProgressRef.current.received++
            const target = pingProgressRef.current.target
            setPacketLogs(current => [...current, `[${getTimestamp()}] ICMP echo reply from ${target}`])
          }
          if (index === result.output.length - 1) {
            terminalRunningRef.current = false
            pingProgressRef.current = null
            terminalTimersRef.current = []
            setTerminalRunning(false)
          }
        }, 250 * (index + 1))
        terminalTimersRef.current.push(timer)
      })
    } else {
      setTerminalLines(current => [...current, echo, ...result.output])
    }

    setTerminalInput('')
  }, [
    connectNodesById,
    ipToNodeId,
    labelToNodeId,
    terminalContext,
    terminalRuntime,
    triggerPacketAnimation,
  ])

  const handleTerminalSubmit = useCallback(() => {
    executeTerminalCommand(terminalInput)
  }, [executeTerminalCommand, terminalInput])

  const handleRunSuggestedCommand = useCallback((command: string) => {
    if (!command) {
      return
    }

    executeTerminalCommand(command)
  }, [executeTerminalCommand])

  const handleTerminalInputChange = useCallback((value: string) => {
    setTerminalInput(value)
    if (historyCursor !== null) {
      setHistoryCursor(null)
      setHistoryDraftInput('')
    }
  }, [historyCursor])

  const handleAutocomplete = useCallback(() => {
    if (terminalRunningRef.current || terminalContext.pendingSSH) return
    setTerminalInput(completeTerminalInput(terminalInput, terminalContext, terminalRuntime, serverFileSystem))
  }, [terminalContext, terminalInput, terminalRuntime])

  const handleTerminalKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (event.ctrlKey && event.key.toLowerCase() === 'c') {
        event.preventDefault()
        cancelTerminalCommand()
        return
      }
      if (terminalRunningRef.current) {
        event.preventDefault()
        return
      }
      if (terminalContext.pendingSSH && event.key !== 'Enter') {
        if (['Tab', 'ArrowUp', 'ArrowDown'].includes(event.key)) event.preventDefault()
        return
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        handleTerminalSubmit()
        return
      }

      if (event.key === 'Tab') {
        event.preventDefault()
        handleAutocomplete()
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()

        if (commandHistory.length === 0) {
          return
        }

        if (historyCursor === null) {
          setHistoryDraftInput(terminalInput)
          const nextIndex = commandHistory.length - 1
          setHistoryCursor(nextIndex)
          setTerminalInput(commandHistory[nextIndex])
          return
        }

        const nextIndex = Math.max(0, historyCursor - 1)
        setHistoryCursor(nextIndex)
        setTerminalInput(commandHistory[nextIndex])
        return
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()

        if (historyCursor === null) {
          return
        }

        if (historyCursor >= commandHistory.length - 1) {
          setHistoryCursor(null)
          setTerminalInput(historyDraftInput)
          return
        }

        const nextIndex = historyCursor + 1
        setHistoryCursor(nextIndex)
        setTerminalInput(commandHistory[nextIndex])
      }
    },
    [
      cancelTerminalCommand,
      terminalContext.pendingSSH,
      commandHistory,
      handleAutocomplete,
      handleTerminalSubmit,
      historyCursor,
      historyDraftInput,
      terminalInput,
    ],
  )

  const handleLaunchGuiMode = useCallback(() => {
    navigate('/gui')
  }, [navigate])

  const handleToggleHelp = useCallback(() => {
    setHelpEnabled((current) => !current)
  }, [])

  const handleCloseViewer = useCallback(() => {
    setActivePanel(null)
  }, [])

  const handleCameraUsernameChange = useCallback((nodeId: string, value: string) => {
    updateCameraSession(nodeId, (session) => ({
      ...session,
      username: value,
    }))
  }, [updateCameraSession])

  const handleCameraPasswordChange = useCallback((nodeId: string, value: string) => {
    updateCameraSession(nodeId, (session) => ({
      ...session,
      password: value,
    }))
  }, [updateCameraSession])

  const handleCameraLogin = useCallback((nodeId: string) => {
    const currentSession = cameraSessions[nodeId] ?? {
      username: '',
      password: '',
      failedAttempts: 0,
      authenticated: false,
      selectedFeedId: 'lobby',
    }
    const isValidLogin =
      currentSession.username.trim().toLowerCase() === 'admin' && currentSession.password === 'admin'

    updateCameraSession(nodeId, (session) => {
      return isValidLogin
        ? {
            ...session,
            authenticated: true,
            failedAttempts: 0,
            password: '',
          }
        : {
            ...session,
            authenticated: false,
            failedAttempts: session.failedAttempts + 1,
          }
    })

    if (isValidLogin) {
      const cameraNode = nodes.find((node) => node.id === nodeId)
      setPacketLogs((currentLogs) => [
        ...currentLogs,
        `[${getTimestamp()}] auth: factory default credentials accepted on ${cameraNode?.data.label ?? nodeId}`,
        `[${getTimestamp()}] warn: insecure device configuration detected (${cameraNode?.data.ip ?? 'ip unknown'})`,
      ])
    }
  }, [cameraSessions, nodes, updateCameraSession])

  const handleCameraFeedSelect = useCallback((nodeId: string, feedId: string) => {
    updateCameraSession(nodeId, (session) => ({
      ...session,
      selectedFeedId: feedId,
    }))
  }, [updateCameraSession])

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

  useEffect(
    () => () => {
      terminalTimersRef.current.forEach(window.clearTimeout)
      if (packetAnimationTimeoutRef.current) {
        window.clearTimeout(packetAnimationTimeoutRef.current)
      }
      if (glitchTimeoutRef.current) {
        window.clearTimeout(glitchTimeoutRef.current)
      }
    },
    [],
  )

  const reconciledContext = reconcileTerminalContext(terminalContext, terminalRuntime)
  if (reconciledContext !== terminalContext) {
    setTerminalContext(reconciledContext)
    setTerminalInput('')
    setTerminalLines(current => [...current, 'Connection lost: host or route disappeared. Returned to an available local/parent shell.'])
  }

  if (
    activePanel?.type === 'camera' &&
    !edges.some(
      (edge) =>
        (edge.source === activePanel.nodeId && edge.target === 'jp-server') ||
        (edge.target === activePanel.nodeId && edge.source === 'jp-server'),
    )
  ) {
    setActivePanel(null)
  }

  if (isMobileDevice && !allowMobileLab) {
    return (
      <div className={`lab-root lab-root--mobile${terminalContext.connectedTo === 'shadow' ? ' lab-root--shadow' : ''}`}>
        <TopBar onLaunchGuiMode={handleLaunchGuiMode} helpEnabled={helpEnabled} onToggleHelp={handleToggleHelp} />
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
              <button type="button" className="primary-dark-button" onClick={handleLaunchGuiMode}>
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
      <div
        className={`lab-root${terminalContext.connectedTo === 'shadow' ? ' lab-root--shadow' : ''}${terminalGlitchActive ? ' lab-root--breach' : ''}`}
      >
        {terminalGlitchActive ? (
          <div className="system-failure-overlay" aria-hidden="true">
            <div className="system-failure-code">404</div>
            <div className="system-failure-copy">NETWORK INTEGRITY FAILURE</div>
          </div>
        ) : null}
        <TopBar onLaunchGuiMode={handleLaunchGuiMode} helpEnabled={helpEnabled} onToggleHelp={handleToggleHelp} />
        <div className="main-layout">
          {canvasGuideMessage ? <div className="canvas-guide-popup">{canvasGuideMessage}</div> : null}
          {activePanel?.type === 'file' ? (
            <aside className="content-viewer-panel">
              <div className="content-viewer-header">
                <div>
                  <p className="content-viewer-eyebrow">Read Only</p>
                  <h3>{activePanel.path}</h3>
                </div>
                <button type="button" className="content-viewer-close" onClick={handleCloseViewer}>
                  Close
                </button>
              </div>
              <div className="content-viewer-body">
                <pre>
                  {renderViewerContent(activePanel.content).map((segment, index) =>
                    typeof segment === 'string' ? (
                      <span key={`viewer-text-${index}`}>{segment}</span>
                    ) : (
                      <a
                        key={`viewer-link-${index}`}
                        href={segment.href}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {segment.text}
                      </a>
                    ),
                  )}
                </pre>
              </div>
            </aside>
          ) : null}
          {activePanel?.type === 'camera' && activeCameraNode && activeCameraSession ? (
            <CameraPanel
              label={activeCameraNode.data.label}
              ip={activeCameraNode.data.ip ?? 'IP pending'}
              session={activeCameraSession}
              onUsernameChange={(value) => handleCameraUsernameChange(activeCameraNode.id, value)}
              onPasswordChange={(value) => handleCameraPasswordChange(activeCameraNode.id, value)}
              onSubmitLogin={() => handleCameraLogin(activeCameraNode.id)}
              onSelectFeed={(feedId) => handleCameraFeedSelect(activeCameraNode.id, feedId)}
              onClose={handleCloseViewer}
            />
          ) : null}
          <DevicePanel />
          <NetworkCanvas
            nodes={decoratedNodes}
            edges={decoratedEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={changes => {
              if (terminalRunningRef.current) cancelTerminalCommand()
              onEdgesChange(changes)
            }}
            onConnect={handleConnect}
            onAddDeviceNode={handleAddDeviceNode}
          />
        </div>
        <div className="bottom-panel">
          <TerminalPanel
            lines={terminalLines}
            inputValue={terminalInput}
            prompt={buildPrompt(terminalContext)}
            isGlitching={terminalGlitchActive}
            isRunning={terminalRunning}
            isPassword={terminalContext.pendingSSH?.phase === 'password'}
            onCancel={cancelTerminalCommand}
            resumeUrl={RESUME_URL}
            resumeDownloadName={RESUME_DOWNLOAD_NAME}
            onInputChange={handleTerminalInputChange}
            onKeyDown={handleTerminalKeyDown}
            suggestedCommands={suggestedCommands}
            onRunSuggestedCommand={handleRunSuggestedCommand}
          />
          <PacketLogPanel logs={packetLogs} />
        </div>
      </div>
    </ReactFlowProvider>
  )
}

export default App
