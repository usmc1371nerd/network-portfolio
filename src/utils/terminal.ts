import type { FileSystemNode } from '../data/serverFileSystem'

export type TerminalContext = {
  connected: boolean
  connectedTo: 'server' | 'pc' | null
  connectedLabel: string | null
  connectedIp: string | null
  currentPath: string[]
}

type TerminalResult = {
  output: string[]
  context: TerminalContext
  clear?: boolean
}

type TerminalRuntime = {
  knownIps: Set<string>
  serverReachable: boolean
  pcNodes: Map<string, string> // ip → label
  serverIp: string
  serverLabel: string
}

export const initialTerminalLines = [
  "JP's Network Lab",
  '────────────────────────────────',
  '',
  'environment: simulated network lab',
  'purpose: interactive portfolio',
  '',
  'drag a PC onto the network to begin',
  '────────────────────────────────',
]

const beforeSshCommands = ['help', 'ping', 'ssh', 'whoami', 'clear']

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

  if (!context.connected && !beforeSshCommands.includes(command)) {
    return { output: invalidCommandOutput(), context }
  }

  if (command === 'clear') {
    return { output: [], context, clear: true }
  }

  if (command === 'help') {
    const serverCmds = ['help', 'ping <ip>', 'ssh <ip>', 'whoami', 'ls', 'cd <directory>', 'cat <file>', 'clear']
    const firstPcIp = runtime.pcNodes.keys().next().value as string | undefined
    const helpPcIp =
      context.connectedTo === 'pc' && context.connectedIp
        ? context.connectedIp
        : firstPcIp ?? '10.0.0.10'
    const helpServerTarget = `${runtime.serverLabel} (${runtime.serverIp})`
    const baseCmds = [
      'help',
      'ping <ip>',
      'ssh <ip>  or  ssh guest@<ip>',
      'whoami',
      'clear',
      '',
      'session flow:',
      `1) ssh guest@${helpPcIp}   # enter PC-1`,
      `2) ssh guest@${runtime.serverIp}    # access ${helpServerTarget} from PC-1`,
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
    const targetIp = args[1]
    if (!targetIp) {
      return { output: ['usage: ping <ip>'], context }
    }

    if (!runtime.knownIps.has(targetIp)) {
      return {
        output: [`Pinging ${targetIp} ...`, `${targetIp}: host unreachable`],
        context,
      }
    }

    if (targetIp === '10.0.0.1' && !runtime.serverReachable) {
      return {
        output: [`Pinging ${targetIp} ...`, `${targetIp}: host unreachable`],
        context,
      }
    }

    return {
      output: [`Pinging ${targetIp} ...`, `Reply from ${targetIp}: bytes=32 time=3ms TTL=64`],
      context,
    }
  }

  if (command === 'ssh') {
    const rawArg = args[1]
    if (!rawArg) {
      return { output: ['usage: ssh <ip>  or  ssh guest@<ip>'], context }
    }

    const targetUser = rawArg.includes('@') ? rawArg.split('@')[0] : null

    if (targetUser && targetUser !== 'guest') {
      return {
        output: [`ssh: Permission denied for user '${targetUser}'`],
        context,
      }
    }

    // Accept both "ssh 10.0.0.1" and "ssh guest@10.0.0.1"
    const targetIp = rawArg.includes('@') ? rawArg.split('@')[1] : rawArg

    if (!runtime.knownIps.has(targetIp)) {
      return {
        output: [`ssh: ${targetIp}: host unreachable`],
        context,
      }
    }

    // PC connection — passwordless guest login
    const pcLabel = runtime.pcNodes.get(targetIp)
    if (pcLabel) {
      return {
        output: [
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
        },
      }
    }

    // Server connection
    if (targetIp !== '10.0.0.1') {
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
        output: ['Access denied: connect via PC-1 first'],
        context,
      }
    }

    return {
      output: ['connected to JP-SERVER (10.0.0.1)', 'guest session loaded'],
      context: {
        connected: true,
        connectedTo: 'server',
        connectedLabel: 'JP-SERVER',
        connectedIp: '10.0.0.1',
        currentPath: [],
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
