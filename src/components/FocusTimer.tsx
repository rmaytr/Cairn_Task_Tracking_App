import { useEffect, useState } from 'react'
import { useReducedMotion } from '../hooks'
import { warmAudio } from '../lib/feedback'
import { extend, finishTime, isFinished, isPaused, pause, remainingMs, resume, type FocusTimer as Timer } from '../model/timer'
import { useStore } from '../store/useStore'
import { Icon } from './Icon'
import './FocusTimer.css'

const CHOICES = [5, 15, 25] as const
const EXTRA_MINUTES = 5
const RADIUS = 52
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const LAST_MINUTE_MS = 60_000

const clock = (ms: number): string => {
  const total = Math.ceil(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

interface FocusTimerProps {
  taskId: string
}

/**
 * A calm timer beside the current step: pick 5 / 15 / 25 minutes, watch the ring, pause or stop.
 * The timer itself lives in the store; the end chime is scheduled app-wide (useFocusTimer).
 */
export function FocusTimer({ taskId }: FocusTimerProps) {
  const sound = useStore((s) => s.prefs.feedback.sound)
  const timer = useStore((s) => (s.focusTimer?.taskId === taskId ? s.focusTimer.timer : null))
  const startFocusTimer = useStore((s) => s.startFocusTimer)
  const updateFocusTimer = useStore((s) => s.updateFocusTimer)
  const endFocusTimer = useStore((s) => s.endFocusTimer)
  const reduce = useReducedMotion()
  const [now, setNow] = useState(() => Date.now())
  /** Moves `now` along with the change, so the first frame isn't drawn against a stale clock. */
  const change = (next: (at: number) => Timer): void => {
    const at = Date.now()
    setNow(at)
    updateFocusTimer(next(at))
  }
  const running = timer !== null && !isPaused(timer) && !isFinished(timer, now)
  const finished = timer !== null && isFinished(timer, now)

  // The clock is derived from the end timestamp; ticking only repaints it.
  useEffect(() => {
    if (!running) return
    const refresh = (): void => setNow(Date.now())
    refresh()
    const id = setInterval(refresh, 1000)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [running])

  if (!timer) {
    return (
      <div className="ftimer ftimer--idle" role="group" aria-label="Focus timer">
        <span className="ftimer__label">
          <Icon name="hourglass" size={16} /> Focus for
        </span>
        {CHOICES.map((m) => (
          <button
            key={m}
            type="button"
            className="btn btn--sm"
            onClick={() => {
              if (sound) warmAudio()
              const at = Date.now()
              setNow(at)
              startFocusTimer(taskId, m, at)
            }}
          >
            {m} min
          </button>
        ))}
      </div>
    )
  }

  if (finished) {
    return (
      <div className="ftimer ftimer--done" role="status">
        <p className="ftimer__msg">Time. Keep going or call it?</p>
        <button type="button" className="btn btn--sm" onClick={() => change((at) => extend(timer, at, EXTRA_MINUTES))}>
          <Icon name="plus" size={14} /> {EXTRA_MINUTES} min
        </button>
        <button type="button" className="btn btn--sm btn--primary" onClick={() => endFocusTimer()}>
          Done
        </button>
      </div>
    )
  }

  const left = remainingMs(timer, now)
  const paused = isPaused(timer)
  const offset = CIRCUMFERENCE * (1 - left / timer.durationMs)
  const until = new Date(finishTime(timer, now)).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

  return (
    <div className="ftimer ftimer--run">
      <svg className="ftimer__ring" viewBox="0 0 120 120" aria-hidden="true">
        <circle className="ftimer__track" cx="60" cy="60" r={RADIUS} />
        <circle
          className="ftimer__arc"
          cx="60"
          cy="60"
          r={RADIUS}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          style={reduce ? { transition: 'none' } : undefined}
        />
      </svg>
      <div className="ftimer__read">
        <span className="ftimer__time num" role="timer">
          {clock(left)}
          <span className="visually-hidden"> left</span>
        </span>
        <span className="visually-hidden" aria-live="polite">
          {!paused && left <= LAST_MINUTE_MS ? 'One minute left' : ''}
        </span>
        <span className="ftimer__until">{paused ? 'Paused' : `until ${until}`}</span>
      </div>
      <div className="ftimer__btns">
        <button
          type="button"
          className="icon-btn"
          onClick={() => change((at) => (paused ? resume(timer, at) : pause(timer, at)))}
          aria-label={paused ? 'Resume timer' : 'Pause timer'}
          title={paused ? 'Resume' : 'Pause'}
        >
          <Icon name={paused ? 'play' : 'pause'} size={18} />
        </button>
        <button type="button" className="icon-btn" onClick={() => endFocusTimer()} aria-label="Stop timer" title="Stop">
          <Icon name="close" size={18} />
        </button>
      </div>
    </div>
  )
}
