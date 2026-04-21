import type { FileSystemNode } from '../data/serverFileSystem'

export type TerminalContext = {
  connected: boolean
  connectedTo: 'server' | 'pc' | null
  connectedLabel: string | null
  connectedIp: string | null
  currentPath: string[]
  onboardingStep: 'drop-pc-1' | 'connect-pc-1' | 'ssh-pc-1' | 'ssh-server' | 'done'
}

type TerminalResult = {
  output: string[]
  context: TerminalContext
  clear?: boolean
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
  kind: 'pc' | 'server'
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

const beforeSessionCommands = ['help', 'ping', 'ssh', 'connect', 'whoami', 'clear']

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

function printDirectory(node: Record<string, FileSystemNode>): string[] {
  return Object.entries(node).map(([name, value]) =>
    typeof value === 'string' ? name : `${name}/`,
  )
}

function normalizeTarget(value: string): string {
  return value.trim().toLowerCase()
}

function resolveTarget(
  rawTarget: string,
  runtime: TerminalRuntime,
): ResolvedTarget | null {
  const target = normalizeTarget(rawTarget)

  if (!target) {
    return null
  }

  if (target === 'server' || target === runtime.serverLabel.toLowerCase() || target === runtime.serverIp) {
    return {
      ip: runtime.serverIp,
      label: runtime.serverLabel,
      kind: 'server',
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

export function buildPrompt(context: TerminalContext): string {
  if (!context.connected || context.connectedTo === null) {
    return 'visitor@lab:$'
  }

  if (context.connectedTo === 'pc') {
    return `guest@${context.connectedIp ?? '10.0.0.10'}:$`
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
    const serverCmds = [
      'help',
      'ping server',
      'ssh server',
      'whoami',
      'ls',
      'cd <directory>',
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
    return { output: [identity], context }
  }

  if (command === 'ping') {
    const rawTarget = args[1]
    if (!rawTarget) {
      return { output: ['usage: ping <target>'], context }
    }

    const target = resolveTarget(rawTarget, runtime)
    const targetIp = target?.ip ?? rawTarget

    if (!runtime.knownIps.has(targetIp)) {
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
      return { output: ['usage: connect pc-1  or  connect pc-1 server'], context }
    }

    const source = resolveTarget(sourceArg, runtime)
    if (!source || source.kind !== 'pc') {
      return { output: [`connect: unknown device '${sourceArg}'`], context }
    }

    const target = resolveTarget(targetArg, runtime)
    if (!target) {
      return { output: [`connect: unknown device '${targetArg}'`], context }
    }

    if (source.ip === target.ip) {
      return { output: ['connect: source and target must be different devices'], context }
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

    if (targetUser && targetUser !== 'guest') {
      return {
        output: [`ssh: Permission denied for user '${targetUser}'`],
        context,
      }
    }

    const rawTarget = rawArg.includes('@') ? rawArg.split('@')[1] : rawArg
    const resolvedTarget = resolveTarget(rawTarget, runtime)
    const targetIp = resolvedTarget?.ip ?? rawTarget

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
          currentPath: [],
          onboardingStep: isGuidedPc1Login ? 'ssh-server' : context.onboardingStep,
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
        currentPath: [],
        onboardingStep: 'done',
      },
    }
  }

  if (command === 'ls') {
    if (context.connectedTo !== 'server') {
      return { output: invalidCommandOutput(), context }
    }

    const node = getNodeAtPath(fsRoot, context.currentPath)
    if (!node) {
      return { output: ['directory unavailable'], context }
    }

    return { output: printDirectory(node), context }
  }

  if (command === 'cd') {
    if (context.connectedTo !== 'server') {
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

    const node = getNodeAtPath(fsRoot, context.currentPath)
    if (!node) {
      return { output: ['directory unavailable'], context }
    }

    const destination = node[target]
    if (!destination || typeof destination === 'string') {
      return { output: [`cd: no such directory: ${target}`], context }
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
    if (context.connectedTo !== 'server') {
      return { output: invalidCommandOutput(), context }
    }

    const fileName = args[1]
    if (!fileName) {
      return { output: ['usage: cat <file>'], context }
    }

    const node = getNodeAtPath(fsRoot, context.currentPath)
    if (!node) {
      return { output: ['directory unavailable'], context }
    }

    const file = node[fileName]
    if (!file || typeof file !== 'string') {
      return { output: [`cat: file not found: ${fileName}`], context }
    }

    return { output: [file], context }
  }

  return { output: invalidCommandOutput(), context }
}
