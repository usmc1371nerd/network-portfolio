import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react'

type TerminalPanelProps = {
  lines: string[]
  inputValue: string
  prompt: string
  isGlitching: boolean
  isRunning: boolean
  isPassword: boolean
  onCancel: () => void
  resumeUrl: string
  resumeDownloadName: string
  onInputChange: (value: string) => void
  onKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void
  suggestedCommands: string[]
  onRunSuggestedCommand: (command: string) => void
}

export function TerminalPanel({
  lines,
  inputValue,
  prompt,
  isGlitching,
  isRunning,
  isPassword,
  onCancel,
  resumeUrl,
  resumeDownloadName,
  onInputChange,
  onKeyDown,
  suggestedCommands,
  onRunSuggestedCommand,
}: TerminalPanelProps) {
  const outputRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [prompt, isRunning])

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [lines])

  return (
    <section className={`panel terminal-panel${isGlitching ? ' terminal-panel--glitch' : ''}`}>
      <h3 className="terminal-heading">
        <span>Terminal <small>{isRunning ? 'Running…' : 'Simulated Linux shell'}</small></span>
        <button type="button" className="terminal-suggestion-button" onClick={onCancel}>Cancel / Ctrl+C</button>
      </h3>
      <div className="panel-body terminal-output" ref={outputRef} role="log" aria-label="Terminal output" aria-live="polite">
        {lines.map((line, index) => (
          <div key={`${line}-${index}`} className="log-line">
            {line}
          </div>
        ))}
      </div>
      {suggestedCommands.length > 0 ? (
        <div className="terminal-suggestion-row">
          <span className="terminal-suggestion-label">Suggested:</span>
          {suggestedCommands.map((command) => (
            <button
              key={command}
              type="button"
              className="terminal-suggestion-button"
              onClick={() => onRunSuggestedCommand(command)}
            >
              {command}
            </button>
          ))}
          <a
            className="terminal-suggestion-button terminal-suggestion-link"
            href={resumeUrl}
            download={resumeDownloadName}
          >
            Grab Resume
          </a>
        </div>
      ) : (
        <div className="terminal-suggestion-row">
          <span className="terminal-suggestion-label">Quick Link:</span>
          <a
            className="terminal-suggestion-button terminal-suggestion-link"
            href={resumeUrl}
            download={resumeDownloadName}
          >
            Grab Resume
          </a>
        </div>
      )}
      <label className="terminal-input-row" htmlFor="terminal-input">
        <span className="prompt">{prompt}</span>
        <input
          id="terminal-input"
          ref={inputRef}
          type={isPassword ? "password" : "text"}
          readOnly={isRunning}
          maxLength={2048}
          aria-label={isPassword ? "SSH password" : "Terminal command or login response"}
          autoCapitalize="none"
          autoCorrect="off"
          value={inputValue}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={onKeyDown}
          autoComplete={isPassword ? "new-password" : "off"}
          spellCheck={false}
        />
      </label>
    </section>
  )
}
