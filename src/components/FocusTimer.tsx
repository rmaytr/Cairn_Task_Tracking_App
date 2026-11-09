import { useEffect, useState } from 'react'
import { useReducedMotion } from '../hooks'
import { chime } from '../lib/feedback'
import { extend, finishTime, isFinished, isPaused, pause, remainingMs, resume, start, type FocusTimer as Timer } from '../model/timer'
import { useStore } from '../store/useStore'
import { Icon } from './Icon'
import './FocusTimer.css'

const CHOICES = [5, 15, 25] as const
const EXTRA_MINUTES = 5
const RADIUS = 52
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

const clock = (ms: number): string => {
  const total = Math.ceil(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

interface FocusTimerProps {
  timer: Timer | null
  onChange: (timer: Timer) => void
  /** Stops the timer and adds the minutes worked to the task. */
  onEnd: () => void
}

/** A calm timer beside the current step: pick 5 / 15 / 25 minutes, watch the ring, pause or stop. */
export function FocusTimer({ timer, onChange, onEnd }: FocusTimerProps) {
  const sound = useStore((s) => s.prefs.feedback.sound)
  const reduce = useReducedMotion()
  const [now, setNow] = useState(() => Date.now())
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

  useEffect(() => {
    if (finished && sound) chime()
  }, [finished, sound])

  if (!timer) {
    return (
      <div className="ftimer ftimer--idle" role="group" aria-label="Focus timer">
        <span className="ftimer__label">
          <Icon name="hourglass" size={16} /> Focus for
        </span>
        {CHOICES.map((m) => (
          <button key={m} type="button" className="btn btn--sm" onClick={() => onChange(start(Date.now(), m))}>
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
        <button type="button" className="btn btn--sm" onClick={() => onChange(extend(timer, Date.now(), EXTRA_MINUTES))}>
          <Icon name="plus" size={14} /> {EXTRA_MINUTES} min
        </button>
        <button type="button" className="btn btn--sm btn--primary" onClick={onEnd}>
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
        <span className="ftimer__time num" role="timer" aria-label={`${clock(left)} left`}>
          {clock(left)}
        </span>
        <span className="ftimer__until">{paused ? 'Paused' : `until ${until}`}</span>
      </div>
      <div className="ftimer__btns">
        <button
          type="button"
          className="icon-btn"
          onClick={() => onChange(paused ? resume(timer, Date.now()) : pause(timer, Date.now()))}
          aria-label={paused ? 'Resume timer' : 'Pause timer'}
          title={paused ? 'Resume' : 'Pause'}
        >
          <Icon name={paused ? 'play' : 'pause'} size={18} />
        </button>
        <button type="button" className="icon-btn" onClick={onEnd} aria-label="Stop timer" title="Stop">
          <Icon name="close" size={18} />
        </button>
      </div>
    </div>
  )
}
