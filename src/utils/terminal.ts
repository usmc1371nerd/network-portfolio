import type { FileSystemNode } from '../data/serverFileSystem'
import { RESUME_URL } from '../constants/resume'
import { inspectSystem, listeningSockets, recordJournal, type JournalEntry } from './linuxSystem'

export type TerminalSession = {
  connectedTo: 'server' | 'pc' | 'shadow' | null
  connectedLabel: string | null
  connectedIp: string | null
  currentPath: string[]
  user?: string
}

type PendingSSH = {
  target: ResolvedTarget
  user: string
  phase: 'host-key' | 'password'
  attempts: number
}

export type TerminalContext = TerminalSession & {
  connected: boolean
  lastPcLabel: string | null
  lastPcIp: string | null
  onboardingStep: 'drop-pc-1' | 'connect-pc-1' | 'ssh-pc-1' | 'ssh-server' | 'done'
  shadowDiscovered: boolean
  sessions?: TerminalSession[]
  knownHosts?: string[]
  pendingSSH?: PendingSSH
  journal?: JournalEntry[]
}

export type TerminalResult = {
  output: string[]
  context: TerminalContext
  clear?: boolean
  triggeredSecurityGlitch?: boolean
  openedFile?: { path: string; content: string }
  packetEvent?: { fromIp: string; toIp: string }
  connectionEvent?: { sourceLabel: string; targetLabel: string }
  networkLogs?: string[]
  streamed?: boolean
  exitCode?: number
}

export type TerminalRuntime = {
  knownIps: Set<string>
  serverReachable: boolean
  pcNodes: Map<string, string>
  linkedIps: Set<string>
  deviceKinds: Map<string, string>
  serverIp: string
  serverLabel: string
  helpEnabled: boolean
}

type ResolvedTarget = { ip: string; label: string; kind: 'pc' | 'server' | 'shadow' }
const SHADOW_IP = '10.0.13.37'

export const shadowFileSystem: Record<string, FileSystemNode> = {
  shadow: {
    'beacon.txt': 'Beacon synchronized. You crossed the edge network.',
    'notice.txt': 'This is a contained simulation lane for advanced terminal users.',
  },
  ops: {
    'routes.txt': 'Ingress route: 10.0.13.37 -> segmented relay -> dark vlan',
    'status.txt': 'Monitors are stale. Packet signatures are delayed.',
  },
  archive: { 'incident-77.txt': 'Red team exercise artifact. Containment remained intact.' },
}
export const localFileSystem: Record<string, FileSystemNode> = {
  'README.txt': 'Local workstation console. Connect its cable on the canvas, then inspect ip addr and ip route.\nTry ping -c 4 server, nmap -sn 10.0.0.0/24, then ssh guest@server.\nSimulation credentials: guest / portfolio.\nUse exit to return from a remote session; Ctrl+C cancels a running command or login.',
}
export const initialTerminalLines = [
  "JP's Network Lab — simulated Linux terminals",
  'Drag a PC or laptop onto the canvas to open its local console.',
  'Connect its cable to JP-SERVER, then inspect: ip addr → ip route → ping -c 4 server → ssh guest@server',
  'Demo SSH credentials: guest / portfolio. No commands contact real hosts.',
  'Type help for shell commands and separate lab controls.',
]

function resolveTarget(value: string, runtime: TerminalRuntime): ResolvedTarget | null {
  const target = value.toLowerCase()
  if (['server', runtime.serverLabel.toLowerCase(), runtime.serverIp].includes(target)) {
    return { ip: runtime.serverIp, label: runtime.serverLabel, kind: 'server' }
  }
  if ([SHADOW_IP, 'shadow-gateway'].includes(target)) {
    return { ip: SHADOW_IP, label: 'SHADOW-GATEWAY', kind: 'shadow' }
  }
  for (const [ip, label] of runtime.pcNodes) {
    if (target === ip || target === label.toLowerCase()) return { ip, label, kind: 'pc' }
  }
  return null
}

function isIPv4(value: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(value) && value.split('.').every(part => Number(part) <= 255)
}

function hasNetwork(context: TerminalContext, runtime: TerminalRuntime): boolean {
  if (context.connectedTo === 'server' || context.connectedTo === 'shadow') return true
  return context.connectedTo === 'pc' && runtime.linkedIps.has(context.connectedIp ?? '')
}

function reachable(target: ResolvedTarget, context: TerminalContext, runtime: TerminalRuntime): boolean {
  if (target.ip === context.connectedIp) return true
  if (!hasNetwork(context, runtime)) return false
  if (target.kind === 'shadow') return context.shadowDiscovered
  return target.kind === 'server' || runtime.linkedIps.has(target.ip)
}

function sshAllowed(target: ResolvedTarget, context: TerminalContext): boolean {
  return target.kind !== 'shadow' || context.connectedTo === 'pc'
}

function hasSSH(target: ResolvedTarget, runtime: TerminalRuntime): boolean {
  return listeningSockets(target.ip, runtime).some(socket => socket.protocol === 'tcp' && socket.port === 22)
}

function failure(targetText: string, context: TerminalContext, runtime: TerminalRuntime): string | null {
  const target = resolveTarget(targetText, runtime)
  if (!target && !isIPv4(targetText)) return `Could not resolve hostname ${targetText}: Name or service not known`
  if (target?.ip === context.connectedIp) return null
  if (!hasNetwork(context, runtime)) return 'Network is unreachable'
  if (!target || !reachable(target, context, runtime)) return 'No route to host'
  return null
}

function snapshot(context: TerminalContext): TerminalSession {
  return {
    connectedTo: context.connectedTo, connectedLabel: context.connectedLabel,
    connectedIp: context.connectedIp, currentPath: [...context.currentPath], user: context.user ?? 'guest',
  }
}

export function buildPrompt(context: TerminalContext): string {
  if (context.pendingSSH?.phase === 'host-key') return 'Are you sure you want to continue connecting (yes/no)?'
  if (context.pendingSSH?.phase === 'password') return `${context.pendingSSH.user}@${context.pendingSSH.target.label.toLowerCase()}'s password:`
  if (!context.connectedTo) return 'visitor@lab:~$'
  const path = context.currentPath.length ? `/${context.currentPath.join('/')}` : '/'
  return `${context.user ?? 'guest'}@${context.connectedLabel?.toLowerCase() ?? 'lab'}:${path}$`
}

function continueSSH(input: string, context: TerminalContext, runtime: TerminalRuntime): TerminalResult {
  const pending = context.pendingSSH!
  const { target, user } = pending
  const error = failure(target.ip, context, runtime)
  if (error || !sshAllowed(target, context) || !hasSSH(target, runtime)) {
    return { output: [`ssh: connect to host ${target.ip} port 22: ${error ?? 'Connection refused'}`], context: { ...context, pendingSSH: undefined } }
  }
  if (pending.phase === 'host-key') {
    if (input.toLowerCase() === 'no') return { output: ['Host key verification failed.'], context: { ...context, pendingSSH: undefined } }
    if (input.toLowerCase() !== 'yes') return { output: ['Please type yes or no.'], context }
    return {
      output: [`Warning: Permanently added '${target.label.toLowerCase()}' (ED25519) to the list of known hosts.`],
      context: { ...context, knownHosts: [...(context.knownHosts ?? []), target.ip], pendingSSH: { ...pending, phase: 'password' } },
    }
  }
  const expectedUser = target.kind === 'shadow' ? 'shadow' : 'guest'
  if (user !== expectedUser || input !== (target.kind === 'shadow' ? 'shadow' : 'portfolio')) {
    const attempts = pending.attempts + 1
    return {
      output: [attempts >= 3 ? `${user}@${target.label.toLowerCase()}: Permission denied (password).` : 'Permission denied, please try again.'],
      context: { ...recordJournal(context, target.ip, 'ssh', `Failed password for ${user} from ${context.connectedIp} port 52000 ssh2`), pendingSSH: attempts >= 3 ? undefined : { ...pending, attempts } },
      networkLogs: ['SSH authentication failed'],
    }
  }
  return {
    output: [`Authenticated to ${target.label.toLowerCase()} (${target.ip}) using password.`, 'Welcome to the simulated lab. Type ls to explore; exit returns to your previous shell.'],
    context: {
      ...recordJournal(context, target.ip, 'ssh', `Accepted password for ${user} from ${context.connectedIp} port 52000 ssh2`), connected: true, connectedTo: target.kind, connectedLabel: target.label,
      connectedIp: target.ip, user, currentPath: [], pendingSSH: undefined,
      sessions: [...(context.sessions ?? []), snapshot(context)],
      lastPcIp: context.connectedTo === 'pc' ? context.connectedIp : context.lastPcIp,
      lastPcLabel: context.connectedTo === 'pc' ? context.connectedLabel : context.lastPcLabel,
      onboardingStep: 'done',
    },
    networkLogs: [`SSH authentication accepted for ${user}@${target.ip}`],
  }
}

function normalizePath(raw: string, current: string[]): string[] {
  const parts = raw.startsWith('/') || raw.startsWith('~') ? [] : [...current]
  for (const part of raw.replace(/^~(?=\/|$)/, '').split('/')) {
    if (!part || part === '.') continue
    if (part === '..') parts.pop()
    else parts.push(part)
  }
  return parts
}

function getAtPath(root: Record<string, FileSystemNode>, path: string[]): FileSystemNode | undefined {
  let node: FileSystemNode = root
  for (const part of path) {
    if (typeof node === 'string' || !Object.hasOwn(node, part)) return undefined
    node = node[part]
  }
  return node
}

function listDirectory(node: Record<string, FileSystemNode>, hidden: boolean, long: boolean): string[] {
  return Object.entries(node).filter(([name]) => hidden || !name.startsWith('.')).sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) => {
    const dir = typeof value !== 'string'
    const label = `${name}${dir ? '/' : ''}`
    return long ? `${dir ? 'drwxr-xr-x' : '-rw-r--r--'} 1 guest guest ${String(dir ? 4096 : new TextEncoder().encode(value).length).padStart(4)} Jan 13 03:37 ${label}` : label
  })
}

function scan(args: string[], context: TerminalContext, runtime: TerminalRuntime): TerminalResult {
  const discovery = args.includes('-sn')
  if (args.some(arg => arg.startsWith('-') && arg !== '-sn') || args.filter(arg => !arg.startsWith('-')).length !== 1) {
    return { output: ['usage: nmap [-sn] <host|IPv4/24 subnet>', '-sn discovers hosts without scanning ports.'], context }
  }
  const query = args.find(arg => !arg.startsWith('-'))!
  let candidates: ResolvedTarget[]
  if (query.includes('/')) {
    const [address, prefix] = query.split('/')
    if (!isIPv4(address) || prefix !== '24' || query.split('/').length !== 2) return { output: ['nmap: this lab supports valid IPv4 /24 subnet scans only.'], context }
    const subnet = address.split('.').slice(0, 3).join('.') + '.'
    candidates = [resolveTarget(runtime.serverIp, runtime)!, ...Array.from(runtime.pcNodes.keys(), ip => resolveTarget(ip, runtime)!), resolveTarget(SHADOW_IP, runtime)!].filter(target => target.ip.startsWith(subnet))
  } else {
    const error = failure(query, context, runtime)
    if (error) return { output: [`nmap: ${error}`], context, streamed: true }
    const target = resolveTarget(query, runtime)
    candidates = target ? [target] : []
  }
  if (!hasNetwork(context, runtime)) return { output: ['nmap: Network is unreachable'], context, streamed: true }
  const hosts = candidates.filter(target => reachable(target, context, runtime))
  const output = ['Starting Nmap 7.94 (simulated lab scan)']
  for (const host of hosts) {
    output.push(`Nmap scan report for ${host.label.toLowerCase()} (${host.ip})`, 'Host is up (0.0030s latency).')
    if (!discovery) {
      output.push('PORT     STATE    SERVICE')
      for (const socket of listeningSockets(host.ip, runtime)) {
        const serviceNames: Record<number, string> = { 22: 'ssh', 80: 'http', 443: 'https', 445: 'microsoft-ds' }
        const state = socket.port === 22 && !sshAllowed(host, context) ? 'filtered' : 'open'
        output.push(`${`${socket.port}/${socket.protocol}`.padEnd(8)} ${state.padEnd(8)} ${serviceNames[socket.port] ?? socket.service.name}`)
      }
    }
  }
  output.push(`Nmap done: ${hosts.length} host${hosts.length === 1 ? '' : 's'} up.`)
  return { output, context, streamed: true, networkLogs: [discovery ? 'ICMP/ARP host discovery on reachable lab segment' : 'TCP service probes on reachable lab hosts'] }
}

export function processTerminalCommand(input: string, context: TerminalContext, fsRoot: Record<string, FileSystemNode>, runtime: TerminalRuntime): TerminalResult {
  if (context.pendingSSH) return continueSSH(input, context, runtime)
  const args = input.trim().match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)?.map(arg => arg.replace(/^(["'])(.*)\1$/, '$2')) ?? []
  const command = args.shift() ?? ''
  if (!command) return { output: [], context }
  if (command === 'clear') return { output: [], context, clear: true }
  if (command === 'resume') return { output: ['Resume download:', RESUME_URL, 'Use Grab Resume to download.'], context }
  if (command === 'help') return {
    output: [
      'Simulated Linux shell (no real commands or network traffic):',
      'ip addr | ip route | hostname | whoami | pwd',
      'uname [-a] | uptime | hostnamectl | id | groups',
      'ps aux | pgrep [-f] <name> | top -b -n 1 | ss -tuln',
      'systemctl status <unit> | systemctl --failed | journalctl -u <unit> [-n count]',
      'ping [-c 1..10] <host> | nmap [-sn] <host|IPv4/24 subnet>',
      'ssh [user@]host | exit | logout',
      'ls [-a|-l|-la] [path] | cd [path] | cat <path> | clear | resume',
      'Ctrl+C cancels commands or SSH login; Tab completes commands and paths; ↑/↓ recalls history.',
      'SSH demo account: guest / portfolio.',
      '', 'Lab controls (not Linux commands):',
      'console <PC or laptop> — switch local console when not in an SSH session',
      'connect <device> [server] — cable shortcut; you can also draw the cable on the canvas',
      '', 'Workflow: add workstation → cable → ip addr → ip route → ping -c 4 server → nmap -sn 10.0.0.0/24 → ssh guest@server',
    ], context,
  }
  if (command === 'connect') {
    const source = resolveTarget(args[0] ?? '', runtime)
    const target = resolveTarget(args[1] ?? 'server', runtime)
    if (args.length < 1 || args.length > 2) return { output: ['lab control usage: connect <device> [server]'], context }
    if (!source || source.kind !== 'pc' || target?.kind !== 'server') return { output: ['lab connect: choose a canvas device and server; this control changes cabling, never shell sessions.'], context }
    if (runtime.linkedIps.has(source.ip)) return { output: [`lab connect: ${source.label} is already cabled to ${target.label}.`], context }
    return { output: [`lab control: cable ${source.label} ↔ ${target.label}; DHCP lease activates when link comes up.`, 'Inspect ip addr and ip route from the local workstation console.'], context: { ...context, onboardingStep: 'ssh-server' }, connectionEvent: { sourceLabel: source.label, targetLabel: target.label } }
  }
  if (command === 'console') {
    if (context.sessions?.length) return { output: ['lab console: exit remote SSH sessions before switching workstations.'], context }
    const target = resolveTarget(args[0] ?? '', runtime)
    if (args.length !== 1 || !target || target.kind !== 'pc' || !['pc', 'laptop'].includes(runtime.deviceKinds.get(target.ip) ?? 'pc')) return { output: ['lab control usage: console <PC or laptop on canvas>'], context }
    return { output: [`Local console opened on ${target.label}; network access depends on its cable.`], context: { ...context, connected: true, connectedTo: 'pc', connectedIp: target.ip, connectedLabel: target.label, lastPcIp: target.ip, lastPcLabel: target.label, user: 'guest', currentPath: [], sessions: [], onboardingStep: 'connect-pc-1' } }
  }
  if (!context.connectedTo) return { output: ['No local console. Add a PC/laptop, or use console <workstation>.'], context }
  const inspection = inspectSystem(command, args, context, runtime)
  if (inspection) return { ...inspection, context }
  if (command === 'whoami') return { output: [context.user ?? 'guest'], context }
  if (command === 'hostname') return { output: [context.connectedLabel!.toLowerCase()], context }
  if (command === 'pwd') return { output: [`/${context.currentPath.join('/')}`], context }
  if (command === 'exit' || command === 'logout') {
    const sessions = [...(context.sessions ?? [])]
    const previous = sessions.pop()
    if (!previous) return { output: ['Local console remains open. Use console <workstation> to switch devices.'], context }
    return { output: [`Connection to ${context.connectedLabel?.toLowerCase()} closed.`], context: { ...context, ...previous, sessions, pendingSSH: undefined }, networkLogs: ['SSH session closed; returned to previous shell'] }
  }
  if (command === 'ip') {
    if (args.length !== 1 || !['addr', 'route'].includes(args[0])) return { output: ['usage: ip addr | ip route'], context }
    const online = hasNetwork(context, runtime)
    if (args[0] === 'addr') return {
      output: ['1: lo: <LOOPBACK,UP> mtu 65536', '    inet 127.0.0.1/8 scope host lo', `2: eth0: <${online ? 'BROADCAST,MULTICAST,UP,LOWER_UP' : 'NO-CARRIER,BROADCAST,MULTICAST,UP'}> mtu 1500 state ${online ? 'UP' : 'DOWN'}`, ...(online ? [`    inet ${context.connectedIp}/24 scope global eth0`] : ['    No DHCP lease: connect this workstation to JP-SERVER.'])], context,
    }
    if (!online) return { output: [], context }
    const routes = context.connectedTo === 'server'
      ? ['10.0.0.0/24 dev eth0 proto kernel scope link src 10.0.0.1', '10.0.13.0/24 dev vlan13 proto kernel scope link src 10.0.13.1']
      : context.connectedTo === 'shadow'
        ? ['default via 10.0.13.1 dev eth0', '10.0.13.0/24 dev eth0 proto kernel scope link src 10.0.13.37']
        : [`default via ${runtime.serverIp} dev eth0 proto dhcp`, `10.0.0.0/24 dev eth0 proto kernel scope link src ${context.connectedIp}`]
    return { output: routes, context: { ...context, shadowDiscovered: context.shadowDiscovered || context.connectedTo === 'server' } }
  }
  if (command === 'nmap') return scan(args, context, runtime)
  if (command === 'ping') {
    let count = 4
    let targetText: string
    if (args[0] === '-c' && args.length === 3 && /^\d+$/.test(args[1]) && Number(args[1]) >= 1 && Number(args[1]) <= 10) {
      count = Number(args[1]); targetText = args[2]
    } else if (args.length === 1 && !args[0].startsWith('-')) targetText = args[0]
    else return { output: ['usage: ping [-c 1..10] <host> (lab default: 4 packets)'], context }
    const target = resolveTarget(targetText, runtime)
    const error = failure(targetText, context, runtime)
    if (error) return { output: [`ping: ${targetText}: ${error}`, ...(error === 'No route to host' ? [`--- ${targetText} ping statistics ---`, `${count} packets transmitted, 0 received, 100% packet loss`] : [])], context, streamed: true }
    const ip = target!.ip
    return {
      output: [`PING ${targetText} (${ip}) 56(84) bytes of data.`, ...Array.from({ length: count }, (_, i) => `64 bytes from ${ip}: icmp_seq=${i + 1} ttl=64 time=${(2.1 + i * 0.2).toFixed(2)} ms`), `--- ${targetText} ping statistics ---`, `${count} packets transmitted, ${count} received, 0% packet loss`, `rtt min/avg/max = 2.100/${(2.1 + (count - 1) * 0.1).toFixed(3)}/${(2.1 + (count - 1) * 0.2).toFixed(3)} ms`],
      context, streamed: true, packetEvent: { fromIp: context.connectedIp!, toIp: ip },
      networkLogs: [`ARP resolution for next hop toward ${ip}`, `ICMP echo probe started: ${context.connectedIp} → ${ip}`],
    }
  }
  if (command === 'ssh') {
    if (args.length !== 1 || !/^(?:[a-zA-Z0-9_-]+@)?[a-zA-Z0-9.-]+$/.test(args[0])) return { output: ['usage: ssh [user@]host'], context }
    const [user, targetText] = args[0].includes('@') ? args[0].split('@') : ['guest', args[0]]
    const error = failure(targetText, context, runtime)
    const target = resolveTarget(targetText, runtime)
    if (error || !target) return { output: [`ssh: ${targetText}: ${error ?? 'No route to host'}`], context, streamed: true }
    if (!sshAllowed(target, context)) return { output: [`ssh: connect to host ${target.ip} port 22: Connection timed out`, 'Lab firewall: restricted SSH accepts workstation sources only.'], context, streamed: true, networkLogs: [`Firewall dropped TCP/22 from ${context.connectedIp} to ${target.ip}`] }
    if (!hasSSH(target, runtime)) return { output: [`ssh: connect to host ${target.ip} port 22: Connection refused`], context, streamed: true, networkLogs: [`TCP/22 RST from ${target.ip}; SSH service not listening`] }
    const known = context.knownHosts?.includes(target.ip)
    return {
      output: known ? ['SSH password authentication required.'] : [`The authenticity of host '${target.label.toLowerCase()} (${target.ip})' can't be established.`, 'ED25519 host key fingerprint: SIMULATED-LAB-KEY (not a real cryptographic key).'],
      context: { ...context, pendingSSH: { target, user, phase: known ? 'password' : 'host-key', attempts: 0 } },
      streamed: true, packetEvent: { fromIp: context.connectedIp!, toIp: target.ip },
      networkLogs: [`ARP resolution for next hop toward ${target.ip}`, `TCP SYN → SYN-ACK → ACK: ${context.connectedIp} → ${target.ip}:22`, 'SSH protocol negotiation; awaiting authentication'],
    }
  }
  const root = context.connectedTo === 'shadow' ? shadowFileSystem : context.connectedTo === 'server' ? fsRoot : localFileSystem
  if (command === 'cd' || command === 'ls' || command === 'cat') {
    const flags = command === 'ls' ? args.filter(arg => arg.startsWith('-')) : []
    if (flags.some(flag => !/^-[al]+$/.test(flag))) return { output: ['ls: supported options are -a, -l, -la'], context }
    const paths = command === 'ls' ? args.filter(arg => !arg.startsWith('-')) : args
    if (paths.length > 1 || (command === 'cat' && paths.length !== 1)) return { output: [`usage: ${command} ${command === 'cat' ? '<path>' : '[path]'}`], context }
    const raw = paths[0] ?? (command === 'cd' ? '/' : '.')
    const path = normalizePath(raw, context.currentPath)
    const node = getAtPath(root, path)
    if (node === undefined) return { output: [`${command}: ${raw}: No such file or directory`], context }
    if (command === 'cd') {
      if (typeof node === 'string') return { output: [`cd: ${raw}: Not a directory`], context }
      return { output: [], context: { ...context, currentPath: path } }
    }
    if (command === 'ls') return { output: typeof node === 'string' ? [raw] : listDirectory(node, flags.join('').includes('a'), flags.join('').includes('l')), context }
    if (typeof node !== 'string') return { output: [`cat: ${raw}: Is a directory`], context }
    return { output: node.split('\n'), context: { ...context, shadowDiscovered: context.shadowDiscovered || (context.connectedTo === 'server' && path.join('/') === '.secretfile') }, openedFile: { path: path.join('/'), content: node } }
  }
  if (['sudo', 'rm', 'reboot', 'shutdown', 'passwd', 'curl', 'wget', 'nc'].includes(command)) return { output: [`${command}: unavailable in this read-only simulated shell`], context }
  return { output: `bash: ${command}: command not found`.split('\n'), context }
}

// Revalidate the entire SSH chain when devices or cables change, including parent shells.
export function reconcileTerminalContext(context: TerminalContext, runtime: TerminalRuntime): TerminalContext {
  if (!context.connectedTo) return context
  const chain = [...(context.sessions ?? []), snapshot(context)]
  const root = chain[0]
  const rootTarget = resolveTarget(root.connectedIp ?? '', runtime)
  let validCount = rootTarget?.kind === 'pc' && ['pc', 'laptop'].includes(runtime.deviceKinds.get(rootTarget.ip) ?? '') ? 1 : 0
  if (validCount) {
    for (let index = 1; index < chain.length; index++) {
      const source = { ...context, ...chain[index - 1] }
      const target = resolveTarget(chain[index].connectedIp ?? '', runtime)
      if (!target || !reachable(target, source, runtime) || !sshAllowed(target, source) || !hasSSH(target, runtime)) break
      validCount++
    }
  }
  if (validCount === chain.length) {
    const pending = context.pendingSSH
    if (pending && (!reachable(pending.target, context, runtime) || !hasSSH(pending.target, runtime) || !sshAllowed(pending.target, context))) return { ...context, pendingSSH: undefined }
    return context
  }
  if (validCount) {
    const previous = chain[validCount - 1]
    return { ...context, ...previous, sessions: chain.slice(0, validCount - 1), pendingSSH: undefined }
  }
  const fallback = Array.from(runtime.pcNodes).find(([ip]) => ['pc', 'laptop'].includes(runtime.deviceKinds.get(ip) ?? ''))
  return {
    ...context, connected: Boolean(fallback), connectedTo: fallback ? 'pc' : null,
    connectedIp: fallback?.[0] ?? null, connectedLabel: fallback?.[1] ?? null,
    lastPcIp: fallback?.[0] ?? null, lastPcLabel: fallback?.[1] ?? null,
    user: 'guest', currentPath: [], sessions: [], pendingSSH: undefined,
  }
}

export function completeTerminalInput(input: string, context: TerminalContext, runtime: TerminalRuntime, fsRoot: Record<string, FileSystemNode>): string {
  if (context.pendingSSH) return input
  const commands = ['uname', 'uptime', 'hostnamectl', 'id', 'groups', 'ps', 'pgrep', 'top', 'ss', 'systemctl', 'journalctl', 'help', 'ip', 'hostname', 'pwd', 'ping', 'ssh', 'connect', 'console', 'nmap', 'whoami', 'resume', 'ls', 'cd', 'cat', 'clear', 'exit', 'logout']
  const parts = input.trimStart().split(/\s+/)
  const command = parts[0]
  const token = parts.at(-1) ?? ''
  const before = input.slice(0, input.length - token.length)
  let candidates: string[] = []
  if (parts.length === 1) {
    candidates = commands.filter(candidate => candidate.startsWith(token))
    if (candidates.length === 1 && ['ip', 'ping', 'ssh', 'connect', 'console', 'nmap', 'cd', 'cat'].includes(candidates[0])) return `${candidates[0]} `
  } else if (command === 'ip') {
    candidates = ['addr', 'route'].filter(candidate => candidate.startsWith(token))
  } else if (['cd', 'cat', 'ls'].includes(command)) {
    const root = context.connectedTo === 'shadow' ? shadowFileSystem : context.connectedTo === 'server' ? fsRoot : localFileSystem
    const slash = token.lastIndexOf('/')
    const prefix = token.slice(0, slash + 1)
    const name = token.slice(slash + 1)
    const directory = getAtPath(root, normalizePath(prefix || '.', context.currentPath))
    if (directory && typeof directory !== 'string') {
      candidates = Object.entries(directory)
        .filter(([entry, value]) => entry.startsWith(name) && (name.startsWith('.') || !entry.startsWith('.')) && (command !== 'cd' || typeof value !== 'string'))
        .map(([entry, value]) => `${prefix}${entry}${typeof value !== 'string' ? '/' : ''}`)
    }
  } else if (['ssh', 'ping', 'nmap', 'console', 'connect'].includes(command)) {
    const workstations = Array.from(runtime.pcNodes).filter(([ip]) => ['pc', 'laptop'].includes(runtime.deviceKinds.get(ip) ?? ''))
    const hosts = ['server', runtime.serverIp, ...Array.from(runtime.pcNodes).flatMap(([ip, label]) => [ip, label.toLowerCase()]), ...(context.shadowDiscovered ? [SHADOW_IP, 'shadow-gateway'] : [])]
    if (command === 'console') candidates = workstations.map(([, label]) => label.toLowerCase())
    else if (command === 'connect') candidates = parts.length > 2 ? ['server'] : Array.from(runtime.pcNodes.values(), label => label.toLowerCase())
    else if (command === 'nmap') candidates = [...hosts, '10.0.0.0/24', ...(context.shadowDiscovered ? ['10.0.13.0/24'] : [])]
    else if (command === 'ssh' && token.includes('@')) candidates = hosts.map(host => `${token.split('@')[0]}@${host}`)
    else candidates = hosts
    candidates = candidates.filter(candidate => candidate.startsWith(token))
  }
  const unique = [...new Set(candidates)]
  if (!unique.length) return input
  let completion = unique[0]
  for (const candidate of unique.slice(1)) {
    while (!candidate.startsWith(completion)) completion = completion.slice(0, -1)
  }
  return before + completion
}
