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
  isConnected?: boolean
  isActiveSession?: boolean
  showGuideHint?: boolean
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

function getLinkEstablishedLogs(sourceLabel: string, targetLabel: string): string[] {
  return [
    `[${getTimestamp(0)}] Link request accepted for ${sourceLabel} -> ${targetLabel}`,
    `[${getTimestamp(1)}] Layer 2 link established`,
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

function longestCommonPrefix(values: string[]): string {
  if (values.length === 0) {
    return ''
  }

  let prefix = values[0]

  for (let index = 1; index < values.length; index += 1) {
    const currentValue = values[index]
    while (!currentValue.startsWith(prefix) && prefix.length > 0) {
      prefix = prefix.slice(0, -1)
    }
    if (!prefix) {
      break
    }
  }

  return prefix
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

function App() {
  const navigate = useNavigate()
  const [isMobileDevice, setIsMobileDevice] = useState(false)
  const [allowMobileLab, setAllowMobileLab] = useState(false)
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [packetLogs, setPacketLogs] = useState<string[]>([])
  const [terminalLines, setTerminalLines] = useState<string[]>(initialTerminalLines)
  const [terminalInput, setTerminalInput] = useState('')
  const [commandHistory, setCommandHistory] = useState<string[]>([])
  const [historyCursor, setHistoryCursor] = useState<number | null>(null)
  const [historyDraftInput, setHistoryDraftInput] = useState('')
  const [showCanvasGuide, setShowCanvasGuide] = useState(false)
  const [terminalContext, setTerminalContext] = useState<TerminalContext>({
    connected: false,
    connectedTo: null,
    connectedLabel: null,
    connectedIp: null,
    currentPath: [],
    onboardingStep: 'drop-pc-1',
  })
  const [nodeCount, setNodeCount] = useState(1)
  const [assignedPcIps, setAssignedPcIps] = useState<string[]>([])
  const [helpEnabled, setHelpEnabled] = useState(true)
  const [packetAnimation, setPacketAnimation] = useState<{
    fromNodeId: string
    toNodeId: string
    pulse: number
  } | null>(null)
  const packetAnimationTimeoutRef = useRef<number | null>(null)

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

  const connectedNodeIds = useMemo(() => {
    const ids = new Set<string>()
    for (const edge of edges) {
      ids.add(edge.source)
      ids.add(edge.target)
    }
    return ids
  }, [edges])

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
          showGuideHint: helpEnabled && node.id === 'pc-1' && terminalContext.onboardingStep === 'connect-pc-1',
        },
      })),
    [connectedNodeIds, helpEnabled, nodes, terminalContext.connectedLabel, terminalContext.onboardingStep],
  )

  const suggestedCommand = useMemo(() => {
    if (!helpEnabled) {
      return null
    }

    if (terminalContext.onboardingStep === 'connect-pc-1') {
      return 'connect pc-1'
    }

    if (terminalContext.onboardingStep === 'ssh-pc-1') {
      return 'ssh pc-1'
    }

    if (terminalContext.onboardingStep === 'ssh-server') {
      return 'ssh server'
    }

    if (terminalContext.onboardingStep === 'done' && terminalContext.connectedTo === 'server') {
      return 'ls'
    }

    return null
  }, [helpEnabled, terminalContext.connectedTo, terminalContext.onboardingStep])

  const connectNodesById = useCallback(
    (sourceId: string, targetId: string, shouldAnimateImmediately = true) => {
      if (sourceId === targetId) {
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

      const sourceNode = nodes.find((node) => node.id === sourceId)
      const targetNode = nodes.find((node) => node.id === targetId)
      const sourcePc = sourceNode?.type === 'pcNode' ? sourceNode.data.label ?? null : null
      const targetPc = targetNode?.type === 'pcNode' ? targetNode.data.label ?? null : null

      if (
        (sourceId === 'pc-1' && targetId === 'jp-server') ||
        (sourceId === 'jp-server' && targetId === 'pc-1')
      ) {
        triggerPacketAnimation(sourceId, targetId, false)
      } else if (shouldAnimateImmediately) {
        triggerPacketAnimation(sourceId, targetId, false)
      }

      setPacketLogs((currentLogs) => [...currentLogs, ...getConnectionLogs(sourcePc ?? targetPc)])
      return true
    },
    [edges, nodes, setEdges, triggerPacketAnimation],
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
        'next step:',
        `connect ${nextLabel.toLowerCase()}`,
      ])
      if (nextLabel === 'PC-1' && helpEnabled) {
        setTerminalContext((currentContext) => ({
          ...currentContext,
          onboardingStep: 'connect-pc-1',
        }))
      }
    },
    [assignedPcIps, helpEnabled, nodeCount, setNodes],
  )

  const executeTerminalCommand = useCallback((rawCommand: string) => {
    const command = rawCommand.trim()

    if (!command) {
      return
    }

    setCommandHistory((currentHistory) => [...currentHistory, command])
    setHistoryCursor(null)
    setHistoryDraftInput('')

    const prompt = buildPrompt(terminalContext)
    const result = processTerminalCommand(command, terminalContext, serverFileSystem, {
      knownIps: knownNodeIps,
      serverReachable: hasServerConnection,
      pcNodes,
      serverIp: serverNodeData.ip,
      serverLabel: serverNodeData.label,
      helpEnabled,
    })

    setTerminalContext(result.context)

    if (result.clear) {
      setTerminalLines([])
      setTerminalInput('')
      return
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
        const created = connectNodesById(sourceId, targetId)
        if (created) {
          setPacketLogs((currentLogs) => [
            ...currentLogs,
            ...getLinkEstablishedLogs(sourceLabel, targetLabel),
          ])
        }
      }
    }

    setTerminalLines((currentLines) => [...currentLines, `${prompt} ${command}`, ...result.output])

    setTerminalInput('')
  }, [
    connectNodesById,
    hasServerConnection,
    helpEnabled,
    ipToNodeId,
    knownNodeIps,
    labelToNodeId,
    pcNodes,
    serverNodeData,
    terminalContext,
    triggerPacketAnimation,
  ])

  const handleTerminalSubmit = useCallback(() => {
    executeTerminalCommand(terminalInput)
  }, [executeTerminalCommand, terminalInput])

  const handleSuggestedCommand = useCallback(() => {
    if (!suggestedCommand) {
      return
    }

    executeTerminalCommand(suggestedCommand)
  }, [executeTerminalCommand, suggestedCommand])

  const handleTerminalInputChange = useCallback((value: string) => {
    setTerminalInput(value)
    if (historyCursor !== null) {
      setHistoryCursor(null)
      setHistoryDraftInput('')
    }
  }, [historyCursor])

  const handleAutocomplete = useCallback(() => {
    const trimmed = terminalInput.trim()
    if (!trimmed) {
      return
    }

    const baseCommands =
      terminalContext.connectedTo === 'server'
        ? ['help', 'ping', 'ssh', 'whoami', 'ls', 'cd', 'cat', 'clear']
        : ['help', 'ping', 'ssh', 'connect', 'whoami', 'clear']
    const sectionAliases = new Map<string, string>([['certification', 'certifications']])
    const sectionKeywords = terminalContext.connectedTo === 'server' ? Object.keys(serverFileSystem) : []

    const knownIps = Array.from(knownNodeIps).sort()
    const parts = trimmed.split(/\s+/)

    if (parts.length === 1 && !terminalInput.endsWith(' ')) {
      const commandPrefix = parts[0].toLowerCase()
      const keywordCandidates = sectionKeywords
        .map((keyword) => keyword.toLowerCase())
        .concat(Array.from(sectionAliases.keys()))

      const candidates = [...baseCommands, ...keywordCandidates].filter((cmd) =>
        cmd.startsWith(commandPrefix),
      )
      if (candidates.length === 0) {
        return
      }

      const completion =
        candidates.length === 1 ? candidates[0] : longestCommonPrefix(candidates)

      if (!completion) {
        return
      }

      const requiresArg = ['ping', 'ssh', 'cd', 'cat'].includes(completion)

      if (requiresArg) {
        setTerminalInput(`${completion} `)
        return
      }

      if (!baseCommands.includes(completion) && terminalContext.connectedTo === 'server') {
        const mappedKeyword = sectionAliases.get(completion) ?? completion
        setTerminalInput(`cd ${mappedKeyword}`)
        return
      }

      setTerminalInput(completion)
      return
    }

    const command = parts[0].toLowerCase()
    const argPrefix = terminalInput.endsWith(' ') ? '' : parts[parts.length - 1]

    if (command === 'ping') {
      const candidates = ['server', ...Array.from(pcNodes.values()).map((label) => label.toLowerCase()), ...knownIps]
        .filter((target) => target.startsWith(argPrefix.toLowerCase()))
      if (candidates.length === 1) {
        setTerminalInput(`ping ${candidates[0]}`)
      } else if (candidates.length > 1) {
        const prefix = longestCommonPrefix(candidates)
        if (prefix) {
          setTerminalInput(`ping ${prefix}`)
        }
      }
      return
    }

    if (command === 'ssh') {
      const labels = ['server', ...Array.from(pcNodes.values()).map((label) => label.toLowerCase())]
      const targetCandidates = knownIps.map((ip) => `guest@${ip}`)
      const allCandidates = [...labels, ...targetCandidates, ...knownIps]
      const candidates = allCandidates.filter((candidate) => candidate.startsWith(argPrefix))

      if (candidates.length === 1) {
        setTerminalInput(`ssh ${candidates[0]}`)
      } else if (candidates.length > 1) {
        const prefix = longestCommonPrefix(candidates)
        if (prefix) {
          setTerminalInput(`ssh ${prefix}`)
        }
      }
      return
    }

    if (command === 'connect') {
      const labels = Array.from(pcNodes.values()).map((label) => label.toLowerCase())
      const connectTargets = [...labels, 'server']
      const candidates = connectTargets.filter((candidate) => candidate.startsWith(argPrefix.toLowerCase()))

      if (parts.length <= 2) {
        if (candidates.length === 1) {
          setTerminalInput(`connect ${candidates[0]}`)
        } else if (candidates.length > 1) {
          const prefix = longestCommonPrefix(candidates)
          if (prefix) {
            setTerminalInput(`connect ${prefix}`)
          }
        }
        return
      }

      const targetCandidates = ['server', ...labels].filter((candidate) =>
        candidate.startsWith(argPrefix.toLowerCase()),
      )
      if (targetCandidates.length === 1) {
        setTerminalInput(`connect ${parts[1]} ${targetCandidates[0]}`)
      } else if (targetCandidates.length > 1) {
        const prefix = longestCommonPrefix(targetCandidates)
        if (prefix) {
          setTerminalInput(`connect ${parts[1]} ${prefix}`)
        }
      }
      return
    }

    if (command === 'cd' && terminalContext.connectedTo === 'server') {
      const currentDir = getDirectoryForPath(
        serverFileSystem as Record<string, unknown>,
        terminalContext.currentPath,
      )

      if (!currentDir) {
        return
      }

      const directoryCandidates = Object.entries(currentDir)
        .filter(([, value]) => typeof value !== 'string')
        .map(([name]) => name)
      const normalizedPrefix = argPrefix.toLowerCase()
      const aliasCandidates = Array.from(sectionAliases.entries())
        .filter(([, canonical]) => directoryCandidates.includes(canonical))
        .map(([alias]) => alias)

      const candidates = [...directoryCandidates, ...aliasCandidates].filter((candidate) =>
        candidate.toLowerCase().startsWith(normalizedPrefix),
      )

      if (candidates.length === 1) {
        const resolved = sectionAliases.get(candidates[0]) ?? candidates[0]
        setTerminalInput(`cd ${resolved}`)
      } else if (candidates.length > 1) {
        const prefix = longestCommonPrefix(candidates.map((candidate) => candidate.toLowerCase()))
        if (prefix) {
          const resolved = sectionAliases.get(prefix) ?? prefix
          setTerminalInput(`cd ${resolved}`)
        }
      }
      return
    }

    if (command === 'cat' && terminalContext.connectedTo === 'server') {
      const currentDir = getDirectoryForPath(
        serverFileSystem as Record<string, unknown>,
        terminalContext.currentPath,
      )

      if (!currentDir) {
        return
      }

      const fileCandidates = Object.entries(currentDir)
        .filter(([, value]) => typeof value === 'string')
        .map(([name]) => name)
      const candidates = fileCandidates.filter((fileName) => fileName.startsWith(argPrefix))

      if (candidates.length === 1) {
        setTerminalInput(`cat ${candidates[0]}`)
      } else if (candidates.length > 1) {
        const prefix = longestCommonPrefix(candidates)
        if (prefix) {
          setTerminalInput(`cat ${prefix}`)
        }
      }
    }
  }, [knownNodeIps, pcNodes, terminalContext.connectedTo, terminalContext.currentPath, terminalInput])

  const handleTerminalKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
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
      if (packetAnimationTimeoutRef.current) {
        window.clearTimeout(packetAnimationTimeoutRef.current)
      }
    },
    [],
  )

  useEffect(() => {
    const shouldShowGuide = helpEnabled && terminalContext.onboardingStep === 'drop-pc-1' && nodeCount === 1

    if (!shouldShowGuide) {
      setShowCanvasGuide(false)
      return
    }

    setShowCanvasGuide(true)

    const timeoutId = window.setTimeout(() => {
      setShowCanvasGuide(false)
    }, 5000)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [helpEnabled, nodeCount, terminalContext.onboardingStep])

  if (isMobileDevice && !allowMobileLab) {
    return (
      <div className="lab-root lab-root--mobile">
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
      <div className="lab-root">
        <TopBar onLaunchGuiMode={handleLaunchGuiMode} helpEnabled={helpEnabled} onToggleHelp={handleToggleHelp} />
        <div className="main-layout">
          {showCanvasGuide ? <div className="canvas-guide-popup">Drag a PC into the canvas to get started.</div> : null}
          <DevicePanel />
          <NetworkCanvas
            nodes={decoratedNodes}
            edges={decoratedEdges}
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
            onInputChange={handleTerminalInputChange}
            onKeyDown={handleTerminalKeyDown}
            suggestedCommand={suggestedCommand}
            onRunSuggestedCommand={handleSuggestedCommand}
          />
          <PacketLogPanel logs={packetLogs} />
        </div>
      </div>
    </ReactFlowProvider>
  )
}

export default App
