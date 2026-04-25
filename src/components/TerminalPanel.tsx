import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react'

type TerminalPanelProps = {
  lines: string[]
  inputValue: string
  prompt: string
  isGlitching: boolean
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
  resumeUrl,
  resumeDownloadName,
  onInputChange,
  onKeyDown,
  suggestedCommands,
  onRunSuggestedCommand,
}: TerminalPanelProps) {
  const outputRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [lines])

  return (
    <section className={`panel terminal-panel${isGlitching ? ' terminal-panel--glitch' : ''}`}>
      <h3>Terminal</h3>
      <div className="panel-body terminal-output" ref={outputRef}>
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
          type="text"
          value={inputValue}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={onKeyDown}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
    </section>
  )
}
