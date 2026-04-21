import type { FileSystemNode } from '../data/serverFileSystem'

export type TerminalContext = {
  connected: boolean
  connectedTo: 'server' | 'pc' | 'shadow' | null
  connectedLabel: string | null
  connectedIp: string | null
  lastPcLabel: string | null
  lastPcIp: string | null
  currentPath: string[]
  onboardingStep: 'drop-pc-1' | 'connect-pc-1' | 'ssh-pc-1' | 'ssh-server' | 'done'
  shadowDiscovered: boolean
}

type TerminalResult = {
  output: string[]
  context: TerminalContext
  clear?: boolean
  openedFile?: {
    path: string
    content: string
  }
  packetEvent?: {
    fromIp: string
    toIp: string
  }
  connectionEvent?: {
    sourceLabel: string
    targetLabel: string
  }
}

type TerminalRuntime = {
  knownIps: Set<string>
  serverReachable: boolean
  pcNodes: Map<string, string>
  serverIp: string
  serverLabel: string
  helpEnabled: boolean
}

type ResolvedTarget = {
  ip: string
  label: string
  kind: 'pc' | 'server' | 'shadow'
}

const SHADOW_IP = '10.0.13.37'
const SHADOW_LABEL = 'SHADOW-GATEWAY'

export const shadowFileSystem: Record<string, FileSystemNode> = {
  shadow: {
    'beacon.txt': 'Beacon synchronized. You crossed the edge network.',
    'notice.txt': 'This is a contained simulation lane for advanced terminal users.',
  },
  ops: {
    'routes.txt': 'Ingress route: 10.0.13.37 -> segmented relay -> dark vlan',
    'status.txt': 'Monitors are stale. Packet signatures are delayed.',
  },
  archive: {
    'incident-77.txt': 'Red team exercise artifact. Containment remained intact.',
  },
}

export const initialTerminalLines = [
  "JP's Network Lab",
  '--------------------------------',
  '',
  'environment: simulated network lab',
  'purpose: interactive portfolio',
  '',
  'drag a PC onto the network to begin',
  '--------------------------------',
]

const beforeSessionCommands = ['help', 'ping', 'ssh', 'connect', 'nmap', 'whoami', 'clear']

function invalidCommandOutput(): string[] {
  return [
    'command not recognized',
    '',
    'HACKER HACKER!!',
    'just kidding... you are denied :)',
    '',
    'no zero cool allowed here',
  ]
}

function getNodeAtPath(
  root: Record<string, FileSystemNode>,
  path: string[],
): Record<string, FileSystemNode> | null {
  let cursor: FileSystemNode = root

  for (const segment of path) {
    if (typeof cursor === 'string') {
      return null
    }

    cursor = cursor[segment]
    if (!cursor) {
      return null
    }
  }

  return typeof cursor === 'string' ? null : cursor
}

function printDirectory(
  node: Record<string, FileSystemNode>,
  options?: { showHidden?: boolean; longFormat?: boolean },
): string[] {
  const showHidden = Boolean(options?.showHidden)
  const longFormat = Boolean(options?.longFormat)

  const entries = Object.entries(node).filter(([name]) => showHidden || !name.startsWith('.'))
  const sortedEntries = entries.sort(([a], [b]) => a.localeCompare(b))

  if (!longFormat) {
    return sortedEntries.map(([name, value]) => (typeof value === 'string' ? name : `${name}/`))
  }

  return sortedEntries.map(([name, value]) => {
    const isDirectory = typeof value !== 'string'
    const size = isDirectory ? 4096 : Math.max(48, String(value).length)
    const perms = isDirectory ? 'drwxr-xr-x' : '-rw-r--r--'
    return `${perms} 1 guest guest ${String(size).padStart(4, ' ')} Jan 13 03:37 ${name}${isDirectory ? '/' : ''}`
  })
}

function normalizeTarget(value: string): string {
  return value.trim().toLowerCase()
}

function resolveTarget(rawTarget: string, runtime: TerminalRuntime): ResolvedTarget | null {
  const target = normalizeTarget(rawTarget)

  if (!target) {
    return null
  }

  if (
    target === 'server' ||
    target === runtime.serverLabel.toLowerCase() ||
    target === runtime.serverIp
  ) {
    return {
      ip: runtime.serverIp,
      label: runtime.serverLabel,
      kind: 'server',
    }
  }

  if (target === SHADOW_IP || target === 'shadow-gateway' || target === SHADOW_LABEL.toLowerCase()) {
    return {
      ip: SHADOW_IP,
      label: SHADOW_LABEL,
      kind: 'shadow',
    }
  }

  for (const [ip, label] of runtime.pcNodes.entries()) {
    if (target === ip || target === label.toLowerCase()) {
      return {
        ip,
        label,
        kind: 'pc',
      }
    }
  }

  return null
}

function handleNmap(rawTarget: string | undefined, context: TerminalContext): TerminalResult {
  if (!rawTarget) {
    return { output: ['usage: nmap <target>'], context }
  }

  if (rawTarget === '10.0.0.0/24') {
    return {
      output: [
        'Starting Nmap 7.94 ( simulated scan )',
        'Nmap scan report for 10.0.0.1',
        'Host is up (0.0021s latency).',
        '22/tcp open ssh',
        '',
        'Nmap scan report for 10.0.0.10',
        'Host is up (0.0034s latency).',
        '22/tcp open ssh',
        '',
        'Nmap scan report for 10.0.13.37',
        'Host appears filtered (ttl anomaly detected).',
        'rDNS hint: shadow-gateway.auth.shadow',
      ],
      context: {
        ...context,
        shadowDiscovered: true,
      },
    }
  }

  if (rawTarget === SHADOW_IP || rawTarget.toLowerCase() === 'shadow-gateway') {
    return {
      output: [
        `Nmap scan report for ${SHADOW_IP}`,
        'Host is up (0.0053s latency).',
        '22/tcp open ssh',
        '443/tcp filtered https',
        `service banner: ${SHADOW_LABEL} (restricted)`,
        'auth realm: shadow',
      ],
      context: {
        ...context,
        shadowDiscovered: true,
      },
    }
  }

  return {
    output: [`Nmap scan report for ${rawTarget}`, 'Host seems down or blocked in this simulation.'],
    context,
  }
}

export function buildPrompt(context: TerminalContext): string {
  if (!context.connected || context.connectedTo === null) {
    return 'visitor@lab:$'
  }

  if (context.connectedTo === 'pc') {
    return `guest@${context.connectedIp ?? '10.0.0.10'}:$`
  }

  if (context.connectedTo === 'shadow') {
    const suffix = context.currentPath.length > 0 ? `/${context.currentPath.join('/')}` : ''
    return `intruder@10.0.13.37:${suffix}$`
  }

  const suffix = context.currentPath.length > 0 ? `/${context.currentPath.join('/')}` : ''
  return `guest@10.0.0.1:${suffix}$`
}

export function processTerminalCommand(
  input: string,
  context: TerminalContext,
  fsRoot: Record<string, FileSystemNode>,
  runtime: TerminalRuntime,
): TerminalResult {
  const args = input.split(/\s+/)
  const command = args[0].toLowerCase()

  if (!context.connected && !beforeSessionCommands.includes(command)) {
    return { output: invalidCommandOutput(), context }
  }

  if (command === 'clear') {
    return { output: [], context, clear: true }
  }

  if (command === 'help') {
    if (context.connectedTo === 'shadow') {
      return {
        output: [
          'help',
          'ls',
          'cd <directory>',
          'cd ..',
          'cat <file>',
          'ping server',
          'exit',
          'clear',
        ],
        context,
      }
    }

    const serverCmds = [
      'help',
      'ping <target>',
      'whoami',
      'ls',
      'cd <directory>',
      'cd ..',
      'cat <file>',
      'clear',
    ]
    const baseCmds = [
      'help',
      'connect pc-1',
      'ssh pc-1',
      'ping server',
      'whoami',
      'clear',
      '',
      'guided flow:',
      '1) drag a PC into the canvas',
      '2) connect pc-1',
      '3) ssh pc-1',
      '4) ssh server',
    ]

    return {
      output: context.connectedTo === 'server' ? serverCmds : baseCmds,
      context,
    }
  }

  if (command === 'whoami') {
    let identity = 'visitor@lab'
    if (context.connectedTo === 'server') identity = 'guest@10.0.0.1'
    if (context.connectedTo === 'pc') {
      identity = `guest@${context.connectedIp ?? '10.0.0.10'}`
    }
    if (context.connectedTo === 'shadow') {
      identity = 'intruder@10.0.13.37'
    }
    return { output: [identity], context }
  }

  if (command === 'nmap') {
    return handleNmap(args[1], context)
  }

  if (command === 'ping') {
    const rawTarget = args[1]
    if (!rawTarget) {
      return { output: ['usage: ping <target>'], context }
    }

    const target = resolveTarget(rawTarget, runtime)
    const targetIp = target?.ip ?? rawTarget

    if (targetIp === SHADOW_IP && !context.shadowDiscovered) {
      return {
        output: [`Pinging ${targetIp} ...`, `${targetIp}: host unreachable`],
        context,
      }
    }

    if (!runtime.knownIps.has(targetIp) && targetIp !== SHADOW_IP) {
      return {
        output: [`Pinging ${targetIp} ...`, `${targetIp}: host unreachable`],
        context,
      }
    }

    if (targetIp === runtime.serverIp && !runtime.serverReachable) {
      return {
        output: [`Pinging ${targetIp} ...`, `${targetIp}: host unreachable`],
        context,
      }
    }

    const sourceIp =
      context.connectedTo === 'server'
        ? runtime.serverIp
        : context.connectedTo === 'pc' && context.connectedIp
          ? context.connectedIp
          : context.connectedTo === 'shadow'
            ? SHADOW_IP
            : null

    return {
      output: [`Pinging ${targetIp} ...`, `Reply from ${targetIp}: bytes=32 time=3ms TTL=64`],
      context,
      packetEvent: sourceIp
        ? {
            fromIp: sourceIp,
            toIp: targetIp,
          }
        : undefined,
    }
  }

  if (command === 'connect') {
    const sourceArg = args[1]
    const targetArg = args[2] ?? 'server'

    if (!sourceArg) {
      return { output: ['usage: connect pc-1  or  connect shadow-gateway'], context }
    }

    if (sourceArg.toLowerCase() === 'shadow-gateway') {
      if (!context.shadowDiscovered) {
        return { output: ['connect: unknown device \'shadow-gateway\''], context }
      }
      if (context.connectedTo !== 'pc') {
        return { output: ['connect: access denied (pivot through PC first)'], context }
      }
      return {
        output: [
          `connecting to ${SHADOW_LABEL}...`,
          `linked to ${SHADOW_LABEL} (${SHADOW_IP})`,
          'warning: segmented network boundary crossed',
        ],
        context: {
          ...context,
          connected: true,
          connectedTo: 'shadow',
          connectedLabel: SHADOW_LABEL,
          connectedIp: SHADOW_IP,
          currentPath: [],
        },
      }
    }

    const source = resolveTarget(sourceArg, runtime)
    if (!source || source.kind !== 'pc') {
      return { output: [`connect: unknown device '${sourceArg}'`], context }
    }

    const target = resolveTarget(targetArg, runtime)
    if (!target) {
      return { output: [`connect: unknown device '${targetArg}'`], context }
    }

    if (target.kind === 'shadow' && !context.shadowDiscovered) {
      return { output: [`connect: unknown device '${targetArg}'`], context }
    }

    if (source.ip === target.ip) {
      return { output: ['connect: source and target must be different devices'], context }
    }

    if (target.kind === 'shadow') {
      return {
        output: [
          `connecting ${source.label} to ${target.label}...`,
          `link established: ${source.label} <-> ${target.label}`,
          'warning: segmented network boundary crossed',
        ],
        context: {
          ...context,
          connected: true,
          connectedTo: 'shadow',
          connectedLabel: SHADOW_LABEL,
          connectedIp: SHADOW_IP,
          currentPath: [],
        },
      }
    }

    return {
      output: [
        `connecting ${source.label} to ${target.label}...`,
        `link established: ${source.label} <-> ${target.label}`,
        `route available: ${source.label} -> ${target.ip}`,
        `next step: ssh ${source.label.toLowerCase()}`,
      ],
      context: {
        ...context,
        onboardingStep:
          source.label === 'PC-1' && target.kind === 'server'
            ? 'ssh-pc-1'
            : context.onboardingStep,
      },
      connectionEvent: {
        sourceLabel: source.label,
        targetLabel: target.label,
      },
    }
  }

  if (command === 'ssh') {
    const rawArg = args[1]
    if (!rawArg) {
      return { output: ['usage: ssh <target>'], context }
    }

    const targetUser = rawArg.includes('@') ? rawArg.split('@')[0].toLowerCase() : null
    const rawTarget = rawArg.includes('@') ? rawArg.split('@')[1] : rawArg
    const resolvedTarget = resolveTarget(rawTarget, runtime)
    const targetIp = resolvedTarget?.ip ?? rawTarget

    if (targetIp === SHADOW_IP) {
      if (!context.shadowDiscovered) {
        return { output: [`ssh: ${targetIp}: host unreachable`], context }
      }
      if (targetUser && targetUser !== 'shadow') {
        return {
          output: [
            `ssh: Permission denied for user '${targetUser}'`,
            'accepted users: shadow',
          ],
          context,
        }
      }
      if (!targetUser) {
        return {
          output: [
            `ssh: ${targetIp}: account required for restricted host`,
            'hint: use ssh shadow@10.0.13.37',
          ],
          context,
        }
      }
      if (context.connectedTo !== 'pc') {
        return { output: ['Access denied: pivot through PC-1 first'], context }
      }
      return {
        output: [
          `connecting to ${SHADOW_IP}...`,
          `connected to ${SHADOW_LABEL} (${SHADOW_IP})`,
          'restricted shell loaded',
        ],
        context: {
          ...context,
          connected: true,
          connectedTo: 'shadow',
          connectedLabel: SHADOW_LABEL,
          connectedIp: SHADOW_IP,
          currentPath: [],
        },
      }
    }

    if (targetUser && targetUser !== 'guest') {
      return {
        output: [`ssh: Permission denied for user '${targetUser}'`],
        context,
      }
    }

    if (!runtime.knownIps.has(targetIp)) {
      return {
        output: [`ssh: ${targetIp}: host unreachable`],
        context,
      }
    }

    const pcLabel = runtime.pcNodes.get(targetIp)
    if (pcLabel) {
      const isGuidedPc1Login = pcLabel === 'PC-1' && context.onboardingStep === 'ssh-pc-1'

      return {
        output: isGuidedPc1Login
          ? [
              `connecting to ${targetIp}...`,
              `connected to ${pcLabel} (${targetIp})`,
              'guest session loaded',
              'next step: ssh server',
            ]
          : [
              `connecting to ${targetIp}...`,
              `connected to ${pcLabel} (${targetIp})`,
              'guest session loaded',
            ],
        context: {
          connected: true,
          connectedTo: 'pc',
          connectedLabel: pcLabel,
          connectedIp: targetIp,
          lastPcLabel: pcLabel,
          lastPcIp: targetIp,
          currentPath: [],
          onboardingStep: isGuidedPc1Login ? 'ssh-server' : context.onboardingStep,
          shadowDiscovered: context.shadowDiscovered,
        },
      }
    }

    if (targetIp !== runtime.serverIp) {
      return {
        output: [`ssh: connect to host ${targetIp} port 22: Connection refused`],
        context,
      }
    }

    if (!runtime.serverReachable) {
      return {
        output: [`ssh: connect to host ${targetIp} port 22: No route to host`],
        context,
      }
    }

    if (context.connectedTo !== 'pc') {
      return {
        output: ['Access denied: connect to PC-1 first'],
        context,
      }
    }

    return {
      output: ['connected to JP-SERVER (10.0.0.1)', 'guest session loaded', 'try: ls'],
      context: {
        connected: true,
        connectedTo: 'server',
        connectedLabel: runtime.serverLabel,
        connectedIp: runtime.serverIp,
        lastPcLabel: context.connectedLabel,
        lastPcIp: context.connectedIp,
        currentPath: [],
        onboardingStep: 'done',
        shadowDiscovered: context.shadowDiscovered,
      },
    }
  }

  if (command === 'exit' && context.connectedTo === 'shadow') {
    return {
      output: ['disconnecting from shadow-gateway...', 'returned to lab network'],
      context: {
        ...context,
        connected: true,
        connectedTo: 'pc',
        connectedLabel: context.lastPcLabel ?? 'PC-1',
        connectedIp: context.lastPcIp ?? '10.0.0.10',
        currentPath: [],
      },
    }
  }

  const activeFs = context.connectedTo === 'shadow' ? shadowFileSystem : fsRoot

  if (command === 'ls') {
    if (context.connectedTo !== 'server' && context.connectedTo !== 'shadow') {
      return { output: invalidCommandOutput(), context }
    }

    const node = getNodeAtPath(activeFs, context.currentPath)
    if (!node) {
      return { output: ['directory unavailable'], context }
    }

    const flags = args.slice(1).join('')
    const showHidden = flags.includes('a')
    const longFormat = flags.includes('l')

    return {
      output: printDirectory(node, { showHidden, longFormat }),
      context,
    }
  }

  if (command === 'cd') {
    if (context.connectedTo !== 'server' && context.connectedTo !== 'shadow') {
      return { output: invalidCommandOutput(), context }
    }

    const target = args[1]
    if (!target) {
      return { output: ['usage: cd <directory>'], context }
    }

    if (target === '/') {
      return {
        output: [],
        context: {
          ...context,
          currentPath: [],
        },
      }
    }

    if (target === '..') {
      return {
        output: [],
        context: {
          ...context,
          currentPath: context.currentPath.slice(0, -1),
        },
      }
    }

    const node = getNodeAtPath(activeFs, context.currentPath)
    if (!node) {
      return { output: ['directory unavailable'], context }
    }

    const destination = node[target]
    if (!destination) {
      return { output: [`cd: no such directory: ${target}`], context }
    }

    if (typeof destination === 'string') {
      return { output: [`cd: not a directory: ${target}`], context }
    }

    return {
      output: [],
      context: {
        ...context,
        currentPath: [...context.currentPath, target],
      },
    }
  }

  if (command === 'cat') {
    if (context.connectedTo !== 'server' && context.connectedTo !== 'shadow') {
      return { output: invalidCommandOutput(), context }
    }

    const fileName = args[1]
    if (!fileName) {
      return { output: ['usage: cat <file>'], context }
    }

    const node = getNodeAtPath(activeFs, context.currentPath)
    if (!node) {
      return { output: ['directory unavailable'], context }
    }

    const file = node[fileName]
    if (!file || typeof file !== 'string') {
      return { output: [`cat: file not found: ${fileName}`], context }
    }

    return {
      output: [file],
      context,
      openedFile: {
        path: [...context.currentPath, fileName].join('/'),
        content: file,
      },
    }
  }

  return { output: invalidCommandOutput(), context }
}
