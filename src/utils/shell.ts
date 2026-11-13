// Deliberately small shell grammar. No eval, subprocesses, command substitution or redirects.
export type ShellPart = { text: string; expand: boolean }
export type ShellWord = ShellPart[]
type Operator = '|' | '&&' | '||' | ';'
type Token = { word: ShellWord } | { operator: Operator }
export type ShellJob = { stages: ShellWord[][]; condition: '&&' | '||' | ';' }
export type ShellPlan = { jobs: ShellJob[]; error?: never } | { error: string; jobs?: never }

export function parseShell(input: string): ShellPlan {
  if (input.length > 2048) return { error: 'command exceeds the 2048-character lab limit' }
  if (Array.from(input).some(char => { const code = char.charCodeAt(0); return (code < 32 && code !== 9) || code === 127 })) return { error: 'control characters and multiline commands are unsupported' }
  const tokens: Token[] = []
  let parts: ShellPart[] = []
  let active = false
  let quote: 'single' | 'double' | null = null
  const add = (text: string, expand: boolean) => {
    active = true
    const previous = parts.at(-1)
    if (previous?.expand === expand) previous.text += text
    else parts.push({ text, expand })
  }
  const flush = () => {
    if (active) tokens.push({ word: parts })
    parts = []; active = false
  }
  for (let index = 0; index < input.length; index++) {
    const char = input[index]
    if (quote === 'single') {
      if (char === "'") quote = null
      else add(char, false)
      continue
    }
    if (char === '\\') {
      const next = input[++index]
      if (next === undefined) return { error: 'unfinished escape' }
      if (quote === 'double' && !['$', '`', '"', '\\'].includes(next)) add('\\', true)
      add(next, false)
      continue
    }
    if (char === '`' || (char === '$' && input[index + 1] === '(')) return { error: 'command substitution is unsupported in this simulation' }
    if (quote === 'double') {
      if (char === '"') quote = null
      else add(char, true)
      continue
    }
    if (char === "'" || char === '"') { active = true; quote = char === "'" ? 'single' : 'double'; continue }
    if (/\s/.test(char)) { flush(); continue }
    if (['>', '<', '(', ')'].includes(char)) return { error: 'redirection and subshells are unsupported in this read-only simulation' }
    if (['|', '&', ';'].includes(char)) {
      flush()
      let operator: Operator
      if (char === '&') {
        if (input[index + 1] !== '&') return { error: 'background jobs are unsupported; use && for conditional execution' }
        index++; operator = '&&'
      } else if (char === '|' && input[index + 1] === '|') { index++; operator = '||' }
      else operator = char as '|' | ';'
      tokens.push({ operator })
    } else add(char, true)
    if (tokens.length > 128) return { error: 'too many shell tokens' }
  }
  if (quote) return { error: 'unclosed quote' }
  flush()
  if (tokens.length > 128) return { error: 'too many shell tokens' }
  if (!tokens.length) return { jobs: [] }
  const jobs: ShellJob[] = []
  let words: ShellWord[] = []
  let stages: ShellWord[][] = []
  let condition: ShellJob['condition'] = ';'
  let operators = 0
  for (const token of tokens) {
    if ('word' in token) { words.push(token.word); continue }
    if (!words.length) return { error: 'unexpected shell operator' }
    stages.push(words); words = []
    if (++operators > 16) return { error: 'too many shell operators (maximum 16)' }
    if (token.operator !== '|') {
      jobs.push({ stages, condition }); stages = []; condition = token.operator
    }
  }
  if (!words.length) return { error: 'missing command after shell operator' }
  stages.push(words); jobs.push({ stages, condition })
  if (jobs.some(job => job.stages.length > 8)) return { error: 'pipelines are limited to 8 stages' }
  return { jobs }
}

export function expandWord(word: ShellWord, environment: Record<string, string>): string {
  return word.map(part => part.expand
    ? part.text.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*|\?)\}|\$([A-Za-z_][A-Za-z0-9_]*|\?)/g, (_match, braced: string, bare: string) => environment[braced ?? bare] ?? '')
    : part.text).join('')
}

export type TextResult = { output: string[]; exitCode: number }
export function textCommand(command: string, args: string[], stdin?: string[]): TextResult | null {
  const bad = (usage: string): TextResult => ({ output: [`usage: ${usage}`], exitCode: 2 })
  if (command === 'grep') {
    let insensitive = false, numbered = false, invert = false, count = false
    let index = 0
    while (args[index]?.startsWith('-') && args[index] !== '--') {
      const flag = args[index++]
      if (!/^-[Finvc]+$/.test(flag)) return bad('grep [-Finvc] [--] <literal pattern> [path] (literal matching only)')
      insensitive ||= flag.includes('i'); numbered ||= flag.includes('n'); invert ||= flag.includes('v'); count ||= flag.includes('c')
    }
    if (args[index] === '--') index++
    if (args.length !== index + 1 || stdin === undefined) return bad('grep [-Finvc] [--] <literal pattern> [path]')
    const pattern = insensitive ? args[index].toLowerCase() : args[index]
    const matches = stdin.map((line, index) => ({ line, index })).filter(({ line }) => (insensitive ? line.toLowerCase() : line).includes(pattern) !== invert)
    return { output: count ? [String(matches.length)] : matches.map(({ line, index }) => numbered ? `${index + 1}:${line}` : line), exitCode: matches.length ? 0 : 1 }
  }
  if (command === 'head' || command === 'tail') {
    let count = 10
    if (args.length) {
      if (args.length !== 2 || args[0] !== '-n' || !/^\d+$/.test(args[1]) || Number(args[1]) > 200) return bad(`${command} [-n 0..200] [path]`)
      count = Number(args[1])
    }
    if (stdin === undefined) return bad(`${command} [-n 0..200] [path]`)
    return { output: !count ? [] : command === 'head' ? stdin.slice(0, count) : stdin.slice(-count), exitCode: 0 }
  }
  if (command === 'wc') {
    if (args.some(arg => !/^-[lwc]+$/.test(arg)) || stdin === undefined) return bad('wc [-lwc] [path]')
    const flags = args.join('') || '-lwc'
    const text = stdin.length ? stdin.join('\n') + '\n' : ''
    const output: number[] = []
    if (flags.includes('l')) output.push(stdin.length)
    if (flags.includes('w')) output.push(text.trim() ? text.trim().split(/\s+/).length : 0)
    if (flags.includes('c')) output.push(new TextEncoder().encode(text).length)
    return { output: [output.join(' ')], exitCode: 0 }
  }
  return null
}
