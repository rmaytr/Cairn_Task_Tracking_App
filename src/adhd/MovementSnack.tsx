import { useEffect, useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import { useReducedMotion } from '../hooks'
import { MOVES } from './unstuck/breakMoves'
import { MoveFigure } from './unstuck/MoveFigure'
import './unstuck/unstuck.css'

export interface MovementSnackProps {
  /** Called when the break ends or is skipped. */
  onDone: () => void
  /** Heading level for its titles: 2 on its own page, deeper when embedded under another heading. */
  headingLevel?: 2 | 3 | 4
}

interface Clock {
  index: number
  left: number
}

/** A ~90 second guided movement break: one move at a time with a countdown. */
export function MovementSnack({ onDone, headingLevel = 2 }: MovementSnackProps) {
  const H = `h${headingLevel}` as const
  const reduce = useReducedMotion()
  const [clock, setClock] = useState<Clock>({ index: 0, left: MOVES[0]!.seconds })
  const [paused, setPaused] = useState(false)
  const [seated, setSeated] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const finished = clock.index >= MOVES.length
  const move = MOVES[clock.index]

  const skip = (): void =>
    setClock(({ index }) => ({ index: index + 1, left: MOVES[index + 1]?.seconds ?? 0 }))

  useEffect(() => {
    if (paused || finished) return
    const id = setInterval(() => {
      setClock((c) => (c.left <= 1 ? { index: c.index + 1, left: MOVES[c.index + 1]?.seconds ?? 0 } : { ...c, left: c.left - 1 }))
    }, 1000)
    return () => clearInterval(id)
  }, [paused, finished])

  useEffect(() => {
    if (finished) heading.current?.focus()
  }, [finished])

  if (finished || !move) {
    return (
      <div className="mv">
        <H ref={heading} tabIndex={-1} className="stuck__h">Nice. That’s the break.</H>
        <p className="stuck__lede">Your body has had a moment. Whenever you’re ready.</p>
        <button type="button" className="btn btn--primary btn--lg" onClick={onDone}>
          Back to it
        </button>
      </div>
    )
  }
  return (
    <div className="mv">
      <p className="stuck__steps num">
        Move {clock.index + 1} of {MOVES.length}
      </p>
      <MoveFigure id={move.id} still={reduce || paused} />
      <H className="stuck__h" aria-live="polite">{move.title}</H>
      <p className="stuck__lede">{seated ? move.seated : move.how}</p>
      <p className="mv__count num" role="timer" aria-label={`${clock.left} seconds left`}>
        {clock.left}
        <small>s</small>
      </p>
      <div className="stuck__row mv__controls">
        <button type="button" className="btn" onClick={() => setPaused((p) => !p)}>
          <Icon name={paused ? 'play' : 'pause'} size={16} /> {paused ? 'Resume' : 'Pause'}
        </button>
        <button type="button" className="btn" onClick={skip}>
          <Icon name="skip" size={16} /> Skip move
        </button>
        <button type="button" className="btn btn--ghost" onClick={onDone}>
          End break
        </button>
      </div>
      <label className="mv__seated">
        <input type="checkbox" checked={seated} onChange={(e) => setSeated(e.target.checked)} /> I’m sitting
      </label>
      <p className="stuck__why">
        Exercise briefly helped focus in studies of children with ADHD. This short break is a lighter version.{' '}
        <small>Chueh et al. 2022, meta-analysis</small>
      </p>
    </div>
  )
}
