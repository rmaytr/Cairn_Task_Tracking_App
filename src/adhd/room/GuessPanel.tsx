import { useState } from 'react'
import { Icon } from '../../components/Icon'
import type { Task } from '../../model/types'
import { useStore } from '../../store/useStore'
import { guessRatio, pastRuns, suggestMinutes } from '../calibration'
import { ghostText, ratioHint } from './logic'

const CHIPS = [5, 10, 15, 25, 45] as const
const MAX_MINUTES = 180

interface GuessPanelProps {
  task: Task
  onStart: (minutes: number, guessMin: number | null) => void
}

/** Time sense before a block: guess first, see your usual ratio, then start a padded block. */
export function GuessPanel({ task, onStart }: GuessPanelProps) {
  const sessions = useStore((s) => s.prefs.adhd.sessions)
  const [minutes, setMinutes] = useState<number | null>(null)
  const [custom, setCustom] = useState('')
  const [skip, setSkip] = useState(false)
  const ratio = guessRatio(sessions)
  const runs = pastRuns(sessions, task)
  const suggested = minutes !== null && !skip ? suggestMinutes(minutes, ratio) : minutes
  const hint = minutes !== null && !skip ? ratioHint(minutes, ratio) : null
  const pick = (m: number): void => {
    setMinutes(m)
    setCustom('')
  }

  return (
    <div className="room-guess">
      <h2 className="room-panel__title" id="guess-h">
        {skip ? 'How long a block?' : 'How long do you think this will take?'}
      </h2>
      <div className="room-guess__chips" role="group" aria-labelledby="guess-h">
        {CHIPS.map((m) => (
          <button key={m} type="button" className="chip" aria-pressed={minutes === m && custom === ''} onClick={() => pick(m)}>
            {m} min
          </button>
        ))}
        <label className="room-guess__custom">
          <span className="visually-hidden">Other, in minutes</span>
          <input
            className="field num"
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_MINUTES}
            placeholder="Other"
            value={custom}
            onChange={(e) => {
              setCustom(e.target.value)
              const n = Math.round(Number(e.target.value))
              setMinutes(n >= 1 && n <= MAX_MINUTES ? n : null)
            }}
          />
        </label>
      </div>
      {hint && <p className="room-guess__hint">{hint}</p>}
      {runs && <p className="room-guess__ghost">{ghostText(runs)}</p>}
      <div className="room-guess__go">
        <button
          type="button"
          className="btn btn--primary btn--lg"
          disabled={suggested === null}
          onClick={() => suggested !== null && onStart(suggested, skip ? null : minutes)}
        >
          <Icon name="play" size={18} /> {suggested === null ? 'Start' : `Start ${suggested} min`}
        </button>
        {minutes !== null && suggested !== minutes && (
          <button type="button" className="btn btn--lg" onClick={() => onStart(minutes, minutes)}>
            {minutes} min, my guess
          </button>
        )}
      </div>
      <button type="button" className="btn btn--ghost btn--sm room-guess__skip" onClick={() => setSkip(!skip)}>
        {skip ? 'Make a guess after all' : 'Skip the guess'}
      </button>
    </div>
  )
}
