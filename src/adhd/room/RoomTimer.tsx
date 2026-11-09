import { useEffect } from 'react'
import { Icon } from '../../components/Icon'
import { useReducedMotion } from '../../hooks'
import { tock, warmAudio } from '../../lib/feedback'
import { extend, finishTime, isFinished, isPaused, pause, remainingMs, resume, type FocusTimer } from '../../model/timer'
import { useStore } from '../../store/useStore'
import { patchBlock, type Block } from './block'
import { ghostText, nudgeFor } from './logic'

const RADIUS = 52
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const EXTRA_MINUTES = 5
const MIN = 60_000

const clock = (ms: number): string => {
  const total = Math.ceil(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** Where the shrinking arc's end will be when `minutes` have passed: the ghost pace marker. */
function ghostPoint(minutes: number, durationMs: number): { x: number; y: number } | null {
  const left = 1 - (minutes * MIN) / durationMs
  if (left <= 0 || left >= 1) return null
  const angle = 2 * Math.PI * left
  return { x: 60 + RADIUS * Math.cos(angle), y: 60 + RADIUS * Math.sin(angle) }
}

interface RoomTimerProps {
  timer: FocusTimer
  block: Block | null
  now: number
  setNow: (at: number) => void
  runs: { last: number; best: number; n: number } | null
  onWrapUp: () => void
}

/** The big disc that shrinks as time goes, "until 3:40", pause, +5 min, and soft notices near the end. */
export function RoomTimer({ timer, block, now, setNow, runs, onWrapUp }: RoomTimerProps) {
  const updateFocusTimer = useStore((s) => s.updateFocusTimer)
  const feedback = useStore((s) => s.prefs.feedback)
  const reduce = useReducedMotion()
  const left = remainingMs(timer, now)
  const paused = isPaused(timer)
  const finished = isFinished(timer, now)
  const nudge = paused ? null : nudgeFor(left, timer.durationMs)
  const change = (next: (at: number) => FocusTimer): void => {
    const at = Date.now()
    setNow(at)
    updateFocusTimer(next(at))
  }

  // A soft sound with each notice, once per notice, only if sounds are on.
  useEffect(() => {
    if (nudge === null || !block || block.nudged === nudge) return
    patchBlock({ nudged: nudge })
    if (feedback.sound) tock({ sound: true, haptics: feedback.haptics })
  }, [nudge, block, feedback])

  const ghost = runs ? ghostPoint(runs.last, timer.durationMs) : null
  const until = new Date(finishTime(timer, now)).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  const notice = finished
    ? 'Time’s up. Keep going, or wrap up?'
    : nudge === 5
      ? 'About 5 minutes left. Start finding a stopping point.'
      : nudge === 1
        ? 'One minute left.'
        : ''

  return (
    <div className="room-timer">
      <div className="room-timer__disc">
        <svg className="room-timer__ring" viewBox="0 0 120 120" aria-hidden="true">
          <circle className="room-timer__track" cx="60" cy="60" r={RADIUS} />
          <circle
            className="room-timer__arc"
            cx="60"
            cy="60"
            r={RADIUS}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - left / timer.durationMs)}
            style={reduce ? { transition: 'none' } : undefined}
          />
          {ghost && <circle className="room-timer__ghost" cx={ghost.x} cy={ghost.y} r="4.5" />}
        </svg>
        <div className="room-timer__read">
          <span className="room-timer__time num" role="timer">
            {clock(left)}
            <span className="visually-hidden"> left</span>
          </span>
          <span className="room-timer__until">{finished ? 'Time’s up' : paused ? 'Paused' : `until ${until}`}</span>
        </div>
      </div>
      {runs && (
        <p className="room-timer__ghost-note">
          <span className="room-timer__ghost-dot" aria-hidden="true" /> {ghostText(runs)}
        </p>
      )}
      <p className={notice ? 'room-timer__notice' : 'visually-hidden'} aria-live="polite">
        {notice}
      </p>
      <div className="room-timer__btns">
        {!finished && (
          <button type="button" className="btn" onClick={() => change((at) => (paused ? resume(timer, at) : pause(timer, at)))}>
            <Icon name={paused ? 'play' : 'pause'} size={16} /> {paused ? 'Resume' : 'Pause'}
          </button>
        )}
        <button
          type="button"
          className="btn"
          onClick={() => {
            if (feedback.sound) warmAudio()
            change((at) => extend(timer, at, EXTRA_MINUTES))
          }}
        >
          <Icon name="plus" size={16} /> {EXTRA_MINUTES} min
        </button>
        <button type="button" className={finished ? 'btn btn--primary' : 'btn btn--ghost'} onClick={onWrapUp}>
          <Icon name="check" size={16} /> {finished ? 'Wrap up' : 'Stop and wrap up'}
        </button>
      </div>
    </div>
  )
}
