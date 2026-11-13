import type { FileSystemNode } from '../data/serverFileSystem'
import type { TerminalContext, TerminalRuntime } from './terminal'
import { formatJournal, journalForHost } from './linuxSystem'

export type VirtualDirectory = Record<string, FileSystemNode>
export function systemFileSystem(base: VirtualDirectory, context: TerminalContext, runtime: TerminalRuntime): VirtualDirectory {
  const user = context.user ?? 'guest'
  const hostname = context.connectedLabel?.toLowerCase() ?? 'lab'
  return {
    ...base,
    etc: {
      hostname: `${hostname}\n`,
      'os-release': 'NAME="Ubuntu"\nVERSION="24.04 LTS (simulated lab)"\nID=ubuntu\n',
      passwd: `root:x:0:0:root:/root:/bin/bash\n${user}:x:1000:1000:Lab user:/home/${user}:/bin/bash\n`,
      shadow: '[protected simulated credential database]',
      hosts: ['127.0.0.1 localhost', `${runtime.serverIp} jp-server server`, ...Array.from(runtime.pcNodes, ([ip, label]) => `${ip} ${label.toLowerCase()}`)].join('\n') + '\n',
      ssh: { sshd_config: 'Port 22\nPermitRootLogin no\nPasswordAuthentication yes\n' },
    },
    var: { log: { 'auth.log': journalForHost(context, runtime).filter(entry => entry.unit === 'ssh').map(formatJournal).join('\n') + '\n' } },
    home: { [user]: { 'README.txt': 'Your simulated home directory. Portfolio sections remain available at /projects, /about and /resume on JP-SERVER.\n' } },
    root: { 'private.txt': '[protected root-only lab file]' },
    mnt: {},
    proc: { meminfo: 'MemTotal:        4194304 kB\nMemFree:         2621440 kB\nMemAvailable:    3407872 kB\n' },
  }
}

export function normalizePath(raw: string, current: string[], user = 'guest'): string[] {
  const home = raw === '~' || raw.startsWith('~/')
  const parts = home ? ['home', user] : raw.startsWith('/') ? [] : [...current]
  for (const part of (home ? raw.slice(1) : raw).split('/')) {
    if (!part || part === '.') continue
    if (part === '..') parts.pop()
    else parts.push(part)
  }
  return parts
}

export function nodeAtPath(root: VirtualDirectory, path: string[]): FileSystemNode | undefined {
  let node: FileSystemNode = root
  for (const part of path) {
    if (typeof node === 'string' || !Object.hasOwn(node, part)) return undefined
    node = node[part]
  }
  return node
}

export function accessDenied(path: string[], operation: 'read' | 'list' | 'traverse' | 'stat' = 'read'): boolean {
  if (path[0] === 'root' && (path.length > 1 || operation !== 'stat')) return true
  return path.join('/') === 'etc/shadow' && operation === 'read'
}

export function metadata(path: string[], node: FileSystemNode, user: string) {
  const protectedRoot = path.join('/') === 'root'
  const sensitive = path.join('/') === 'etc/shadow'
  const system = !path.length || (path[0] === 'home' && path.length === 1) || ['etc', 'var', 'root', 'proc', 'mnt'].includes(path[0])
  const directory = typeof node !== 'string'
  return {
    directory,
    size: directory ? 4096 : new TextEncoder().encode(node).length,
    owner: system ? 'root' : user,
    mode: directory ? (protectedRoot ? 'drwx------' : 'drwxr-xr-x') : sensitive ? '-rw-------' : '-rw-r--r--',
  }
}

function globMatches(name: string, pattern: string): boolean {
  // Bounded dynamic programming, never compile untrusted patterns as regular expressions.
  let row = Array<boolean>(name.length + 1).fill(false)
  row[0] = true
  for (const char of pattern) {
    const next = Array<boolean>(name.length + 1).fill(false)
    if (char === '*') next[0] = row[0]
    for (let index = 1; index <= name.length; index++) next[index] = char === '*' ? row[index] || next[index - 1] : row[index - 1] && (char === '?' || char === name[index - 1])
    row = next
  }
  return row[name.length]
}

export type FileInspection = { output: string[]; diagnostics?: string[]; exitCode: number }
const diagnostic = (message: string, exitCode = 1): FileInspection => ({ output: [], diagnostics: [message], exitCode })

export function inspectFiles(command: string, args: string[], root: VirtualDirectory, context: TerminalContext): FileInspection | null {
  const user = context.user ?? 'guest'
  if (command === 'find') {
    const raw = args[0] && !args[0].startsWith('-') ? args[0] : '.'
    let index = raw === args[0] ? 1 : 0
    let pattern = '*', type: string | undefined, maxdepth = 8
    for (; index < args.length; index++) {
      if (args[index] === '-name' && args[index + 1] !== undefined && args[index + 1].length <= 128) pattern = args[++index]
      else if (args[index] === '-type' && ['f', 'd'].includes(args[index + 1])) type = args[++index]
      else if (args[index] === '-maxdepth' && /^\d+$/.test(args[index + 1] ?? '') && Number(args[index + 1]) <= 8) maxdepth = Number(args[++index])
      else return diagnostic('usage: find [path] [-name glob] [-type f|d] [-maxdepth 0..8]', 2)
    }
    const start = normalizePath(raw, context.currentPath, user)
    const node = nodeAtPath(root, start)
    if (node === undefined) return diagnostic(`find: ${raw}: No such file or directory`)
    const output: string[] = [], diagnostics: string[] = []
    let visited = 0
    const walk = (node: FileSystemNode, path: string[], label: string, depth: number) => {
      if (++visited > 500) return
      if (accessDenied(path, 'stat')) { diagnostics.push(`find: ${label}: Permission denied`); return }
      const directory = typeof node !== 'string'
      if ((!type || (type === 'd') === directory) && globMatches(path.at(-1) ?? '/', pattern)) output.push(label)
      if (!directory || depth >= maxdepth) return
      if (accessDenied(path, 'traverse')) { diagnostics.push(`find: ${label}: Permission denied`); return }
      for (const [name, child] of Object.entries(node)) walk(child, [...path, name], `${label.replace(/\/$/, '')}/${name}`, depth + 1)
    }
    walk(node, start, raw, 0)
    if (visited > 500) diagnostics.push('find: lab traversal limit reached (500 entries)')
    return { output, diagnostics, exitCode: diagnostics.length ? 1 : 0 }
  }
  if (!['file', 'stat', 'du'].includes(command)) return null
  let paths = args
  if (command === 'du') {
    if (args[0] !== '-sh' || args.length > 2) return diagnostic('usage: du -sh [path]', 2)
    paths = args.slice(1)
  }
  if (paths.length > 1 || (command !== 'du' && paths.length !== 1)) return diagnostic(`usage: ${command} ${command === 'du' ? '-sh [path]' : '<path>'}`, 2)
  const raw = paths[0] ?? '.'
  const path = normalizePath(raw, context.currentPath, user)
  if (accessDenied(path, command === 'du' ? 'traverse' : command === 'file' ? 'read' : 'stat')) return diagnostic(`${command}: ${raw}: Permission denied`)
  const node = nodeAtPath(root, path)
  if (node === undefined) return diagnostic(`${command}: ${raw}: No such file or directory`)
  const info = metadata(path, node, user)
  if (command === 'file') return { output: [`${raw}: ${info.directory ? 'directory' : /^[\x20-\x7e\n\t\r]*$/.test(String(node)) ? 'ASCII text' : 'UTF-8 Unicode text'}`], exitCode: 0 }
  if (command === 'stat') return { output: [`  File: ${raw}`, `  Size: ${info.size}\tType: ${info.directory ? 'directory' : 'regular file'}`, `Access: (${info.mode})  Uid: (${info.owner}) Gid: (${info.owner})`, 'Metadata belongs to the simulated filesystem.'], exitCode: 0 }
  let bytes = 0
  const errors: string[] = []
  let visited = 0
  const measure = (node: FileSystemNode, path: string[]) => {
    if (++visited > 500) return
    if (accessDenied(path, typeof node === 'string' ? 'stat' : 'traverse')) { errors.push(`du: /${path.join('/')}: Permission denied`); return }
    bytes += typeof node === 'string' ? new TextEncoder().encode(node).length : 4096
    if (typeof node !== 'string') for (const [name, child] of Object.entries(node)) measure(child, [...path, name])
  }
  measure(node, path)
  if (visited > 500) errors.push('du: lab traversal limit reached')
  return { output: [`${Math.max(1, Math.ceil(bytes / 1024))}K\t${raw}`], diagnostics: errors, exitCode: errors.length ? 1 : 0 }
}
