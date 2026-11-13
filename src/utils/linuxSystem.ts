import type { TerminalContext, TerminalRuntime } from './terminal'

export type LabService = {
  name: string
  description: string
  state: 'active' | 'failed'
  pid: number
  command: string
  sockets: { protocol: 'tcp' | 'udp'; port: number }[]
}

// One simulated service inventory drives process tables, sockets, scans and SSH.
export function servicesForHost(ip: string, runtime: TerminalRuntime): LabService[] {
  const kind = runtime.deviceKinds.get(ip) ?? (ip === '10.0.13.37' ? 'server' : 'pc')
  const services: LabService[] = []
  if (kind !== 'camera') services.push({ name: 'ssh', description: 'OpenBSD Secure Shell server', state: 'active', pid: 612, command: '/usr/sbin/sshd -D', sockets: [{ protocol: 'tcp', port: 22 }] })
  if (kind === 'server' || kind === 'camera') services.push({ name: 'nginx', description: 'HTTP and reverse proxy server', state: 'active', pid: 734, command: 'nginx: master process', sockets: [{ protocol: 'tcp', port: 443 }, ...(kind === 'camera' ? [{ protocol: 'tcp' as const, port: 80 }] : [])] })
  if (kind === 'nas') services.push({ name: 'smbd', description: 'Samba SMB service', state: 'active', pid: 821, command: '/usr/sbin/smbd --foreground', sockets: [{ protocol: 'tcp', port: 445 }] })
  if (ip === runtime.serverIp) services.push({ name: 'backup-agent', description: 'Lab backup agent', state: 'failed', pid: 0, command: '/usr/local/bin/backup-agent', sockets: [] })
  return services
}

export function listeningSockets(ip: string, runtime: TerminalRuntime) {
  return servicesForHost(ip, runtime).filter(service => service.state === 'active').flatMap(service => service.sockets.map(socket => ({ ...socket, service })))
}

export type JournalEntry = { host: string; unit: string; message: string; at: number }

export function recordJournal(context: TerminalContext, host: string, unit: string, message: string): TerminalContext {
  return { ...context, journal: [...(context.journal ?? []), { host, unit, message, at: Date.now() }].slice(-100) }
}

export function journalForHost(context: TerminalContext, runtime: TerminalRuntime): JournalEntry[] {
  const host = context.connectedIp ?? ''
  const seed: JournalEntry[] = [
    { host, unit: 'systemd', message: 'Reached target Multi-User System.', at: 0 },
    ...servicesForHost(host, runtime).flatMap(service => service.state === 'active'
      ? [{ host, unit: service.name, message: `Started ${service.description}.`, at: 0 }]
      : [
        { host, unit: service.name, message: 'Backup destination /mnt/backup is not mounted.', at: 0 },
        { host, unit: service.name, message: 'Main process exited, code=exited, status=1/FAILURE', at: 0 },
        { host, unit: service.name, message: 'Failed with result exit-code.', at: 0 },
      ]),
  ]
  return [...seed, ...(context.journal ?? []).filter(entry => entry.host === host)]
}

export function formatJournal(entry: JournalEntry): string {
  const time = entry.at ? new Date(entry.at).toISOString().slice(11, 19) : '00:00:00'
  return `${time} ${entry.unit}[lab]: ${entry.message}`
}

export type InspectionResult = { output: string[]; exitCode?: number }
const usage = (text: string): InspectionResult => ({ output: [`usage: ${text}`], exitCode: 2 })

export function inspectSystem(command: string, args: string[], context: TerminalContext, runtime: TerminalRuntime): InspectionResult | null {
  const hostname = context.connectedLabel?.toLowerCase() ?? 'lab'
  const services = servicesForHost(context.connectedIp ?? '', runtime)
  if (command === 'uname') {
    if (args.length > 1 || (args[0] && !['-a', '-r', '-s', '-n', '-m'].includes(args[0]))) return usage('uname [-a|-r|-s|-n|-m]')
    const values: Record<string, string> = { '-s': 'Linux', '-n': hostname, '-r': '6.8.0-lab', '-m': 'x86_64', '-a': `Linux ${hostname} 6.8.0-lab #1 SMP x86_64 GNU/Linux (simulated)` }
    return { output: [values[args[0] ?? '-s']] }
  }
  if (command === 'uptime') return args.length ? usage('uptime') : { output: [' 12:00:00 up 2 days, 3:15, 1 user, load average: 0.08, 0.04, 0.01 (simulated)'] }
  if (command === 'hostnamectl') return args.length ? usage('hostnamectl') : { output: [` Static hostname: ${hostname}`, '  Virtualization: browser simulation', 'Operating System: Ubuntu 24.04 LTS (lab profile)', '          Kernel: Linux 6.8.0-lab', '    Architecture: x86-64'] }
  if (command === 'id' || command === 'groups') {
    if (args.length) return usage(command)
    const user = context.user ?? 'guest'
    return { output: [command === 'id' ? `uid=1000(${user}) gid=1000(${user}) groups=1000(${user}),4(adm)` : `${user} adm`] }
  }
  if (command === 'ps' || command === 'pgrep' || command === 'top') {
    const processes = [
      { pid: 1, user: 'root', name: '/sbin/init' },
      ...services.filter(service => service.state === 'active').map(service => ({ pid: service.pid, user: 'root', name: service.command })),
      { pid: 1400, user: context.user ?? 'guest', name: '-bash' },
    ]
    if (command === 'pgrep') {
      const full = args[0] === '-f'
      const names = full ? args.slice(1) : args
      if (names.length !== 1 || names[0].startsWith('-')) return usage('pgrep [-f] <literal process name>')
      const matched = processes.filter(process => (full ? process.name : process.name.split(' ')[0].split('/').at(-1)!).includes(names[0]))
      return { output: matched.map(process => String(process.pid)), exitCode: matched.length ? 0 : 1 }
    }
    if (command === 'ps' && args.length && !(args.length === 1 && ['aux', '-ef'].includes(args[0]))) return usage('ps [aux|-ef]')
    if (command === 'top' && !(args.length === 3 && args[0] === '-b' && args[1] === '-n' && args[2] === '1')) return usage('top -b -n 1 (one simulated snapshot)')
    return { output: ['USER       PID %CPU %MEM COMMAND', ...processes.map(process => `${process.user.padEnd(10)} ${String(process.pid).padStart(4)}  0.0  0.2 ${process.name}`)] }
  }
  if (command === 'ss') {
    if (!args.length || args.some(arg => !/^-[tulnp]+$/.test(arg))) return usage('ss -tuln [-p]')
    const flags = args.join('')
    if (!flags.includes('l') || (!flags.includes('t') && !flags.includes('u'))) return usage('ss -tuln [-p] (listening sockets only)')
    const output = ['Netid State  Recv-Q Send-Q Local Address:Port Peer Address:Port' + (flags.includes('p') ? ' Process' : '')]
    for (const socket of listeningSockets(context.connectedIp ?? '', runtime)) {
      if (!flags.includes(socket.protocol[0])) continue
      output.push(`${socket.protocol.padEnd(5)} LISTEN 0      128    0.0.0.0:${socket.port}          0.0.0.0:*` + (flags.includes('p') ? ' (process details require root)' : ''))
    }
    return { output }
  }
  if (command === 'systemctl') {
    const mode = args[0] ?? 'list-units'
    if (mode === '--failed' || mode === 'list-units') {
      if (args.length > 1) return usage('systemctl [--failed|list-units|status <unit>|is-active <unit>]')
      const selected = mode === '--failed' ? services.filter(service => service.state === 'failed') : services
      return { output: ['UNIT                    LOAD   ACTIVE SUB     DESCRIPTION', ...selected.map(service => `${(service.name + '.service').padEnd(23)} loaded ${service.state.padEnd(6)} ${service.state === 'active' ? 'running' : 'failed '} ${service.description}`), `${selected.length} loaded units listed.`] }
    }
    if (['start', 'stop', 'restart', 'enable', 'disable'].includes(mode)) return { output: ['Interactive authentication required. Guest sessions cannot modify system services.'], exitCode: 1 }
    if (!['status', 'is-active'].includes(mode) || args.length !== 2) return usage('systemctl [--failed|list-units|status <unit>|is-active <unit>]')
    const name = args[1].replace(/\.service$/, '')
    const service = services.find(service => service.name === name)
    if (!service) return { output: [`Unit ${name}.service could not be found.`], exitCode: 4 }
    if (mode === 'is-active') return { output: [service.state], exitCode: service.state === 'active' ? 0 : 3 }
    return { output: [`● ${name}.service - ${service.description}`, '     Loaded: loaded (simulated unit; enabled)', `     Active: ${service.state}${service.state === 'active' ? ' (running)' : ' (Result: exit-code)'}`, ...(service.pid ? [`   Main PID: ${service.pid} (${service.command.split('/').at(-1)})`] : []), ...journalForHost(context, runtime).filter(entry => entry.unit === name).slice(-3).map(formatJournal)], exitCode: service.state === 'active' ? 0 : 3 }
  }
  if (command === 'journalctl') {
    let unit: string | undefined
    let count = 20
    let failedOnly = false
    for (let index = 0; index < args.length; index++) {
      const arg = args[index]
      if (arg === '--no-pager') continue
      if (arg === '-u' && args[index + 1]) unit = args[++index].replace(/\.service$/, '')
      else if (arg === '-n' && /^\d+$/.test(args[index + 1] ?? '') && Number(args[index + 1]) <= 100) count = Number(args[++index])
      else if (arg === '-p' && args[index + 1] === 'err') { failedOnly = true; index++ }
      else return usage('journalctl [-u unit] [-n 0..100] [-p err] [--no-pager]')
    }
    let entries = journalForHost(context, runtime).filter(entry => !unit || entry.unit === unit)
    if (failedOnly) entries = entries.filter(entry => /failed|failure|not mounted/i.test(entry.message))
    return { output: count ? entries.slice(-count).map(formatJournal) : [] }
  }
  return null
}
