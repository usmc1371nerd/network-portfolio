import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

// Run the production TypeScript command engine on the same Node 20+ used by CI.
function moduleURL(path, replacements = {}) {
  let source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
  for (const [specifier, url] of Object.entries(replacements)) source = source.replaceAll(`'${specifier}'`, JSON.stringify(url))
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2023 } })
  return `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
}
const imports = { '../constants/resume': moduleURL('src/constants/resume.ts'), './linuxSystem': moduleURL('src/utils/linuxSystem.ts'), './shell': moduleURL('src/utils/shell.ts') }
const { processTerminalCommand: process, reconcileTerminalContext: reconcile, buildPrompt, initialTerminalLines, completeTerminalInput: complete } = await import(moduleURL('src/utils/terminal.ts', imports))
const { serverFileSystem } = await import(moduleURL('src/data/serverFileSystem.ts', imports))
function runtime(linked = ['10.0.0.10', '10.0.0.12', '10.0.0.13']) {
  return {
    knownIps: new Set(['10.0.0.1', '10.0.0.10', '10.0.0.11', '10.0.0.12', '10.0.0.13']),
    serverReachable: linked.length > 0,
    pcNodes: new Map([['10.0.0.10', 'PC-1'], ['10.0.0.11', 'PC-2'], ['10.0.0.12', 'CAM-3'], ['10.0.0.13', 'NAS-4']]),
    linkedIps: new Set(linked),
    deviceKinds: new Map([['10.0.0.1', 'server'], ['10.0.0.10', 'pc'], ['10.0.0.11', 'laptop'], ['10.0.0.12', 'camera'], ['10.0.0.13', 'nas']]),
    serverIp: '10.0.0.1', serverLabel: 'JP-SERVER', helpEnabled: true,
  }
}
function local() {
  return { connected: true, connectedTo: 'pc', connectedLabel: 'PC-1', connectedIp: '10.0.0.10', lastPcLabel: 'PC-1', lastPcIp: '10.0.0.10', currentPath: [], onboardingStep: 'connect-pc-1', shadowDiscovered: false, sessions: [], user: 'guest' }
}
function run(command, context = local(), network = runtime()) { return process(command, context, serverFileSystem, network) }
function login(context, host = 'server', network = runtime(), user = 'guest', password = 'portfolio') {
  let result = run(`ssh ${user}@${host}`, context, network)
  if (result.context.pendingSSH?.phase === 'host-key') result = run('yes', result.context, network)
  return run(password, result.context, network).context
}

test('local console works without cable, but another cabled PC does not grant it network access', () => {
  const net = runtime(['10.0.0.11'])
  assert.match(run('ip addr', local(), net).output.join('\n'), /NO-CARRIER/)
  assert.deepEqual(run('ip route', local(), net).output, [])
  assert.match(run('ssh server', local(), net).output.join('\n'), /Network is unreachable/)
  assert.match(run('nmap 10.0.0.0/24', local(), net).output.join('\n'), /Network is unreachable/)
  assert.equal(run('whoami', local(), net).output[0], 'guest')
  assert.match(run('ping -c 1 pc-1', local(), net).output.join('\n'), /1 received/)
})

test('lab cable controls never authenticate or cross restricted segments', () => {
  const result = run('connect pc-1', local(), runtime([]))
  assert.equal(result.context.connectedTo, 'pc')
  assert.deepEqual(result.connectionEvent, { sourceLabel: 'PC-1', targetLabel: 'JP-SERVER' })
  assert.equal(run('connect pc-1 shadow-gateway').connectionEvent, undefined)
  assert.equal(run('connect shadow-gateway').context.connectedTo, 'pc')
  assert.equal(run('connect pc-1').connectionEvent, undefined)
  assert.equal(run('console cam-3').context.connectedIp, '10.0.0.10')
})

test('scan honors CIDR boundaries, connected devices, discovery-only flags, and services', () => {
  const scan = run('nmap 10.0.0.0/24').output.join('\n')
  assert.match(scan, /PC-1|pc-1/)
  assert.doesNotMatch(scan, /10\.0\.0\.11|10\.0\.13\.37/)
  assert.match(scan, /80\/tcp.*http/)
  assert.match(scan, /445\/tcp/)
  assert.doesNotMatch(run('nmap -sn 10.0.0.0/24').output.join('\n'), /\d+\/tcp/)
  assert.match(run('nmap server').output.join('\n'), /22\/tcp.*open/)
  assert.match(run('nmap 10.0.0.0/99').output.join('\n'), /valid IPv4/)
  assert.match(run('nmap 999.0.0.0/24').output.join('\n'), /valid IPv4/)
})

test('network failures distinguish DNS, routing, refused ports and firewall timeout', () => {
  assert.match(run('ping missing-host').output.join('\n'), /resolve hostname/)
  assert.match(run('ping pc-2').output.join('\n'), /No route to host/)
  assert.match(run('ssh cam-3').output.join('\n'), /Connection refused/)
  const server = { ...login(local()), shadowDiscovered: true }
  assert.match(run('ssh shadow@10.0.13.37', server).output.join('\n'), /Connection timed out/)
})

test('SSH requires explicit host trust and password; retries are bounded', () => {
  const pending = run('ssh guest@server').context
  assert.equal(pending.connectedTo, 'pc')
  assert.equal(pending.pendingSSH.phase, 'host-key')
  assert.match(buildPrompt(pending), /yes\/no/)
  assert.equal(run('no', pending).context.pendingSSH, undefined)
  assert.equal(run('perhaps', pending).context.pendingSSH.phase, 'host-key')
  let auth = run('yes', pending).context
  assert.equal(auth.pendingSSH.phase, 'password')
  assert.match(buildPrompt(auth), /password:/)
  for (let i = 0; i < 3; i++) auth = run('wrong', auth).context
  assert.equal(auth.pendingSSH, undefined)
  assert.equal(auth.connectedTo, 'pc')
  const again = run('ssh guest@server', auth).context
  assert.equal(again.pendingSSH.phase, 'password')
  assert.equal(run('Portfolio', again).context.connectedTo, 'pc')
  assert.equal(login(local(), 'server', runtime(), 'root').connectedTo, 'pc')
})

test('nested sessions preserve user, hostname and directory on each exit', () => {
  let server = login(local())
  assert.equal(run('whoami', server).output[0], 'guest')
  assert.equal(run('hostname', server).output[0], 'jp-server')
  server = run('cd /projects', server).context
  const nas = login(server, 'nas-4')
  assert.equal(nas.connectedLabel, 'NAS-4')
  assert.equal(nas.sessions.length, 2)
  const back = run('exit', nas).context
  assert.equal(back.connectedTo, 'server')
  assert.deepEqual(back.currentPath, ['projects'])
  const workstation = run('logout', back).context
  assert.equal(workstation.connectedLabel, 'PC-1')
  assert.equal(workstation.sessions.length, 0)
  assert.equal(run('exit', workstation).context.connectedTo, 'pc')
  assert.equal(run('console pc-2', server).context.connectedTo, 'server')
})

test('Linux paths work from any directory without exposing prototype properties', () => {
  let context = login(local())
  context = run('cd projects/../about/.', context).context
  assert.equal(run('pwd', context).output[0], '/about')
  assert.match(run('cat ../projects/network-lab.txt', context).output.join('\n'), /Interactive frontend/)
  assert.ok(run('ls /projects', context).output.includes('network-lab.txt'))
  assert.match(run('cd summary.txt', context).output.join('\n'), /Not a directory/)
  assert.match(run('cat /projects', context).output.join('\n'), /Is a directory/)
  assert.match(run('cat /__proto__', context).output.join('\n'), /No such file/)
  assert.deepEqual(run('cd ~', context).context.currentPath, [])
  assert.match(run('ls -z', context).output.join('\n'), /supported options/)
  assert.match(run('typo', context).output[0], /command not found/)
  assert.match(run('cat README.txt').output.join('\n'), /Local workstation console/)
})

test('shadow segment is discovered through routes/clues and still requires workstation pivot and auth', () => {
  assert.doesNotMatch(run('nmap 10.0.13.0/24').output.join('\n'), /Host is up/)
  const server = run('cat /.secretfile', login(local())).context
  assert.equal(server.shadowDiscovered, true)
  const pc = run('exit', server).context
  assert.match(run('nmap -sn 10.0.13.0/24', pc).output.join('\n'), /10\.0\.13\.37/)
  const shadow = login(pc, '10.0.13.37', runtime(), 'shadow', 'shadow')
  assert.equal(shadow.connectedTo, 'shadow')
  assert.equal(run('whoami', shadow).output[0], 'shadow')
  assert.equal(run('exit', shadow).context.connectedLabel, 'PC-1')
  assert.equal(run('ip route', login(local())).context.shadowDiscovered, true)
})

test('removing a cable or a parent host unwinds remote sessions and cancels pending auth', () => {
  const server = login(local())
  const nested = login(server, 'nas-4')
  const disconnected = runtime(['10.0.0.13'])
  const restored = reconcile(nested, disconnected)
  assert.equal(restored.connectedLabel, 'PC-1')
  assert.equal(restored.sessions.length, 0)
  assert.equal(reconcile(server, runtime()), server)
  const removed = runtime()
  removed.pcNodes.delete('10.0.0.10')
  removed.deviceKinds.delete('10.0.0.10')
  assert.equal(reconcile(server, removed).connectedLabel, 'PC-2')
  const pending = run('yes', run('ssh server').context).context
  assert.equal(run('portfolio', pending, disconnected).context.pendingSSH, undefined)
  assert.equal(reconcile(pending, disconnected).pendingSSH, undefined)
})

test('ping validates count, emits Linux statistics and records real simulated protocol events', () => {
  const result = run('ping -c 2 server')
  assert.match(result.output.join('\n'), /2 packets transmitted, 2 received/)
  assert.equal(result.output.filter(line => line.includes('icmp_seq=')).length, 2)
  assert.equal(result.streamed, true)
  assert.match(result.networkLogs.join('\n'), /ARP.*ICMP/s)
  assert.match(run('ping -c 0 server').output[0], /usage/)
  assert.match(run('ping -c 999999 server').output[0], /usage/)
  assert.match(run('ping -c 2x server').output[0], /usage/)
})

test('Tab completion preserves flags, SSH users and absolute/relative nested paths', () => {
  assert.equal(complete('ip a', local(), runtime(), serverFileSystem), 'ip addr')
  assert.equal(complete('ssh guest@serv', local(), runtime(), serverFileSystem), 'ssh guest@server')
  assert.equal(complete('ping -c 2 serv', local(), runtime(), serverFileSystem), 'ping -c 2 server')
  assert.equal(complete('nmap -sn 10.0.0.0/', local(), runtime(), serverFileSystem), 'nmap -sn 10.0.0.0/24')
  const server = login(local())
  assert.equal(complete('cat /about/summ', server, runtime(), serverFileSystem), 'cat /about/summary.txt')
  assert.equal(complete('cd /pro', server, runtime(), serverFileSystem), 'cd /projects/')
  const projects = run('cd projects', server).context
  assert.equal(complete('cat ../about/summ', projects, runtime(), serverFileSystem), 'cat ../about/summary.txt')
  assert.equal(complete('cat READ', local(), runtime(), serverFileSystem), 'cat README.txt')
  assert.equal(complete('console cam', local(), runtime(), serverFileSystem), 'console cam')
  const auth = run('yes', run('ssh server').context).context
  assert.equal(complete('port', auth, runtime(), serverFileSystem), 'port')
})

test('routine guidance and SSH prompts do not reveal the hidden account or password', () => {
  const contexts = [local(), login(local())]
  const routine = [...initialTerminalLines, ...run('cat README.txt').output]
  for (const context of contexts) routine.push(...run('help', context).output)
  const first = run('ssh guest@server')
  const accepted = run('yes', first.context)
  routine.push(...first.output, ...accepted.output)
  const known = run('exit', run('portfolio', accepted.context).context).context
  routine.push(...run('ssh guest@server', known).output)
  assert.doesNotMatch(routine.join('\n'), /shadow|10\.0\.13\.37/i)
  const clue = run('cat /.secretfile', login(local()))
  assert.match(clue.output.join('\n'), /SSH account: shadow/)
  assert.match(clue.output.join('\n'), /password matches the account name/)
  assert.equal(clue.context.shadowDiscovered, true)
  const pc = run('exit', clue.context).context
  assert.equal(login(pc, '10.0.13.37', runtime(), 'shadow', 'shadow').connectedTo, 'shadow')
})

test('service status, process inspection, listening sockets and scans share the same inventory', () => {
  const server = login(local())
  const status = run('systemctl status ssh', server)
  assert.equal(status.exitCode, 0)
  assert.match(status.output.join('\n'), /Main PID: 612/)
  assert.match(run('ps aux', server).output.join('\n'), /612.*sshd/)
  assert.deepEqual(run('pgrep sshd', server).output, ['612'])
  assert.match(run('ss -tuln', server).output.join('\n'), /0\.0\.0\.0:22/)
  assert.match(run('nmap server', server).output.join('\n'), /22\/tcp.*open/)
  assert.match(run('systemctl --failed', server).output.join('\n'), /backup-agent/)
  assert.equal(run('systemctl status backup-agent', server).exitCode, 3)
  assert.equal(run('systemctl is-active missing', server).exitCode, 4)
  assert.equal(run('systemctl restart ssh', server).exitCode, 1)
  assert.match(run('journalctl -u backup-agent -p err', server).output.join('\n'), /not mounted/)
  assert.equal(run('pgrep missing-process', server).exitCode, 1)
  assert.equal(run('top -b -n 1', server).exitCode, 0)
  assert.equal(run('top', server).exitCode, 2)
  assert.equal(run('journalctl -n 999999', server).exitCode, 2)
  assert.deepEqual(run('journalctl -n 0', server).output, [])
})

test('authentication journal records actual attempts per host without passwords or hidden account hints', () => {
  const pending = run('yes', run('ssh server').context).context
  const rejected = run('DO-NOT-LOG-THIS-PASSWORD', pending).context
  const server = run('portfolio', rejected).context
  const log = run('journalctl -u ssh', server).output.join('\n')
  assert.match(log, /Failed password for guest from 10\.0\.0\.10/)
  assert.match(log, /Accepted password for guest/)
  assert.doesNotMatch(log, /DO-NOT-LOG|portfolio|shadow/)
  const pc = run('exit', server).context
  assert.doesNotMatch(run('journalctl -u ssh', pc).output.join('\n'), /Accepted password/)
  assert.match(run('uname -a', server).output[0], /Linux jp-server.*simulated/)
  assert.match(run('id', server).output[0], /uid=1000\(guest\)/)
  assert.equal(run('uname --bogus', server).exitCode, 2)
})

test('pipelines filter real command output and preserve the last stage status', () => {
  const server = login(local())
  assert.match(run('ps aux | grep sshd', server).output.join('\n'), /612.*sshd/)
  assert.deepEqual(run('ps aux | grep missing', server).output, [])
  assert.equal(run('ps aux | grep missing', server).context.lastExitCode, 1)
  assert.deepEqual(run('ps aux | grep sshd | wc -l', server).output, ['1'])
  assert.deepEqual(run('systemctl --failed | grep backup | head -n 1', server).output.length, 1)
  assert.deepEqual(run('echo hello | cat', server).output, ['hello'])
  assert.match(run('missing-program | wc -l', server).output.join('\n'), /command not found.*0/s)
  assert.equal(run('missing-program | wc -l', server).exitCode, 0)
})

test('conditional chains and exit status reflect both successful and failed commands', () => {
  assert.deepEqual(run('false && echo wrong || echo fallback').output, ['fallback'])
  assert.deepEqual(run('true || echo wrong; echo done').output, ['done'])
  assert.deepEqual(run('false; echo $?').output, ['1'])
  assert.equal(run('missing-command').exitCode, 127)
  assert.deepEqual(run('missing-command; echo $?').output.at(-1), '127')
  const server = login(local())
  assert.deepEqual(run('cd /projects && pwd', server).output, ['/projects'])
  assert.match(run('cd /missing && pwd || echo failed', server).output.join('\n'), /No such file.*failed/s)
  assert.equal(run('cd /missing', server).exitCode, 1)
})

test('quoting and expansion handle literal shell metacharacters without executing code', () => {
  assert.deepEqual(run('echo "$USER@$HOSTNAME"').output, ['guest@pc-1'])
  assert.deepEqual(run("echo '$USER; $(uname) | literal'").output, ['$USER; $(uname) | literal'])
  assert.deepEqual(run('echo hello\\ world').output, ['hello world'])
  assert.deepEqual(run('echo ""').output, [''])
  assert.equal(run('echo $(uname)').exitCode, 2)
  assert.equal(run('echo `uname`').exitCode, 2)
  assert.equal(run('echo "unfinished').exitCode, 2)
  assert.equal(run('echo hello > /tmp/file').exitCode, 2)
  assert.equal(run('echo hi &').exitCode, 2)
  assert.equal(run('echo hi |').exitCode, 2)
  assert.equal(run('echo hi && ssh server').context.pendingSSH, undefined)
  assert.equal(run('echo hi | cd /').exitCode, 2)
  assert.equal(run('echo '+ 'x'.repeat(3000)).exitCode, 2)
  assert.equal(run('echo a'+ ' | cat'.repeat(9)).exitCode, 2)
})

test('text utilities support bounded counts, literal matching and file input', () => {
  const server = login(local())
  assert.match(run('grep -in cybersecurity /about/summary.txt', server).output[0], /^1:/)
  assert.equal(run('grep -c absent /about/summary.txt', server).exitCode, 1)
  assert.deepEqual(run('echo AbC | grep -i abc').output, ['AbC'])
  assert.deepEqual(run('echo aaa | grep "(a+)+$"').output, [])
  assert.equal(run('echo a | grep -E ".*"').exitCode, 2)
  assert.deepEqual(run('cat /projects/network-lab.txt | head -n 1', server).output.length, 1)
  assert.deepEqual(run('tail -n 0 /projects/network-lab.txt', server).output, [])
  assert.equal(run('head -n 100000 /projects/network-lab.txt', server).exitCode, 2)
  assert.equal(run('grep word /missing', server).exitCode, 1)
  assert.match(run('wc -l /projects/network-lab.txt', server).output[0], /^3$/)
})

test('password replies bypass shell expansion/history and cannot inject chained commands', () => {
  const ready = run('yes', run('ssh server').context).context
  const before = ready.shellHistory
  const result = run('portfolio; echo hacked', ready)
  assert.equal(result.context.connectedTo, 'pc')
  assert.deepEqual(result.context.shellHistory, before)
  assert.doesNotMatch(JSON.stringify(result.context.journal), /hacked|portfolio/)
  const server = run('portfolio', ready).context
  const history = run('history', server).output.join('\n')
  assert.match(history, /ssh server/)
  assert.doesNotMatch(history, /portfolio|hacked/)
})

test('file errors remain diagnostics rather than becoming pipeline input', () => {
  const server = login(local())
  const result = run('grep word /missing | wc -l', server)
  assert.match(result.output.join('\n'), /No such file/)
  assert.equal(result.output.at(-1), '0')
  assert.equal(result.exitCode, 0)
  const state = run('systemctl status missing | wc -l', server)
  assert.match(state.output.join('\n'), /could not be found/)
  assert.equal(state.output.at(-1), '0')
})
