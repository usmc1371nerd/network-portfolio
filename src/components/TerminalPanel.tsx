import { useEffect, useRef } from 'react'

type TerminalPanelProps = {
  lines: string[]
  inputValue: string
  prompt: string
  onInputChange: (value: string) => void
  onSubmit: () => void
}

export function TerminalPanel({
  lines,
  inputValue,
  prompt,
  onInputChange,
  onSubmit,
}: TerminalPanelProps) {
  const outputRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [lines])

  return (
    <section className="panel terminal-panel">
      <h3>Terminal</h3>
      <div className="panel-body terminal-output" ref={outputRef}>
        {lines.map((line, index) => (
          <div key={`${line}-${index}`} className="log-line">
            {line}
          </div>
        ))}
      </div>
      <label className="terminal-input-row" htmlFor="terminal-input">
        <span className="prompt">{prompt}</span>
        <input
          id="terminal-input"
          type="text"
          value={inputValue}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              onSubmit()
            }
          }}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
    </section>
  )
}
