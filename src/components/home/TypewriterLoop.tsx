import { useEffect, useState } from 'react'

const WORDS = [
  'Hacker',
  'Builder',
  'Curiosity Driven',
  'Dad',
  'Combat Vet',
  'Always Learning',
]

const TYPE_SPEED_MS = 80
const DELETE_SPEED_MS = 45
const PAUSE_AFTER_TYPE_MS = 1600
const PAUSE_AFTER_DELETE_MS = 380
const EXTRA_PAUSE_INDEX = WORDS.length - 1 // "Always Learning"
const EXTRA_PAUSE_MS = 1000

type Phase = 'typing' | 'pausing' | 'deleting' | 'waiting'

type TypewriterLoopProps = {
  className?: string
}

export function TypewriterLoop({ className = '' }: TypewriterLoopProps) {
  const [wordIndex, setWordIndex] = useState(0)
  const [displayed, setDisplayed] = useState('')
  const [phase, setPhase] = useState<Phase>('typing')

  useEffect(() => {
    const word = WORDS[wordIndex]

    if (phase === 'typing') {
      if (displayed.length < word.length) {
        const timeout = setTimeout(() => {
          setDisplayed(word.slice(0, displayed.length + 1))
        }, TYPE_SPEED_MS)

        return () => clearTimeout(timeout)
      }

      const pauseMs =
        PAUSE_AFTER_TYPE_MS + (wordIndex === EXTRA_PAUSE_INDEX ? EXTRA_PAUSE_MS : 0)
      const timeout = setTimeout(() => setPhase('deleting'), pauseMs)

      return () => clearTimeout(timeout)
    }

    if (phase === 'deleting') {
      if (displayed.length > 0) {
        const timeout = setTimeout(() => {
          setDisplayed((prev) => prev.slice(0, -1))
        }, DELETE_SPEED_MS)

        return () => clearTimeout(timeout)
      }

      const timeout = setTimeout(() => {
        setWordIndex((prev) => (prev + 1) % WORDS.length)
        setPhase('typing')
      }, PAUSE_AFTER_DELETE_MS)

      return () => clearTimeout(timeout)
    }
  }, [displayed, phase, wordIndex])

  return (
    <div className={`typewriter-wrap ${className}`.trim()} aria-live="polite" aria-label={`${displayed}`}>
      <span className="typewriter-text">{displayed}</span>
      <span className="typewriter-cursor" aria-hidden="true">▋</span>
    </div>
  )
}
