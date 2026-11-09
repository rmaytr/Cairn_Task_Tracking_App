import { useEffect } from 'react'
import { isFinished, isPaused, remainingMs, type FocusTimer } from '../../model/timer'
import type { Task } from '../../model/types'
import { useStore } from '../../store/useStore'
import { pastRuns } from '../calibration'
import { SoundToggle } from '../sound/SoundToggle'
import { ensureBlock, finishBlock, patchBlock, useRoom } from './block'
import { Companion } from './Companion'
import { exitRampDue } from './logic'
import { ParkIt } from './ParkIt'
import { RoomTimer } from './RoomTimer'
import { TaskCard } from './TaskCard'
import { useTick } from './useTick'

interface RoomBlockProps {
  task: Task
  timer: FocusTimer
}

/** A running block: the timer first, then the task, Park it, quiet company and sound, on one screen. */
export function RoomBlock({ task, timer }: RoomBlockProps) {
  const sessions = useStore((s) => s.prefs.adhd.sessions)
  const block = useRoom((s) => (s.block?.taskId === task.id ? s.block : null))
  const [now, setNow] = useTick(timer)
  const finished = isFinished(timer, now)
  const workedMs = timer.durationMs - remainingMs(timer, now)
  const ramp = block !== null && !block.rampDismissed && !finished && exitRampDue({ startMin: block.startMin, durationMs: timer.durationMs, workedMs })

  // A timer started from Lock in has no block yet: make one up from the timer.
  useEffect(() => {
    ensureBlock()
  }, [task.id])

  return (
    <div className="room-grid">
      <section className="room-panel room-panel--timer" aria-label="Timer">
        <RoomTimer timer={timer} block={block} now={now} setNow={setNow} runs={pastRuns(sessions, task)} onWrapUp={() => finishBlock()} />
        <div aria-live="polite">
          {ramp && (
            <div className="room-ramp">
              <p className="room-ramp__text">You’ve been at it a while. Water, stretch, still the right task?</p>
              <div className="room-ramp__btns">
                <button type="button" className="btn btn--sm" onClick={() => patchBlock({ rampDismissed: true })}>
                  Keep going
                </button>
                <button type="button" className="btn btn--sm btn--primary" onClick={() => finishBlock({ moveFirst: true })}>
                  Take a break
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
      <section className="room-panel" aria-label="Your task">
        <TaskCard task={task} />
      </section>
      <section className="room-panel" aria-labelledby="park-h">
        <ParkIt parked={block?.parked ?? []} />
      </section>
      <section className="room-panel" aria-label="Quiet company">
        <Companion title={task.title} progress={finished ? 1 : workedMs / timer.durationMs} paused={isPaused(timer)} />
      </section>
      <section className="room-panel" aria-label="Sound">
        <h2 className="room-panel__title">Sound</h2>
        <p className="room-panel__hint">Noise helps some people focus and bothers others. Try it both ways.</p>
        <SoundToggle />
      </section>
    </div>
  )
}
