import { useEffect, useMemo, useState } from 'react'
import { useNow } from '../hooks'
import { warmAudio } from '../lib/feedback'
import type { Task } from '../model/types'
import { localPlan } from '../plan/lockin'
import { useStore } from '../store/useStore'
import { beginBlock, useRoom } from './room/block'
import { BlockEnd } from './room/BlockEnd'
import { pickStartTask } from './room/logic'
import { RoomBlock } from './room/RoomBlock'
import { RoomChoose } from './room/RoomChoose'
import './room/panels.css'
import './room/room.css'
import './room/end.css'

/** Moves focus to the new screen's first control after a phase change (the old button is gone). */
const focusSoon = (selector: string): void => {
  requestAnimationFrame(() => document.querySelector<HTMLElement>(selector)?.focus())
}

/**
 * The Focus room: one task with every support on one screen. Choose (Up next, or pick), guess,
 * work a block with the timer, sound, quiet company and Park it, then wrap up. The block's timer
 * lives in the store, so leaving and coming back resumes the room on that task.
 */
export function FocusRoom() {
  const tasks = useStore((s) => s.tasks)
  const focusTimer = useStore((s) => s.focusTimer)
  const roomTaskId = useStore((s) => s.roomTaskId)
  const sound = useStore((s) => s.prefs.feedback.sound)
  const navigate = useStore((s) => s.navigate)
  const ended = useRoom((s) => s.ended)
  const now = useNow()
  const [chosen, setChosen] = useState<string | null>(() => {
    const s = useStore.getState()
    return pickStartTask(s.tasks, { timerTaskId: s.focusTimer?.taskId ?? null, roomTaskId: s.roomTaskId }, new Date())
  })

  // A task sent here while the room is open ("Focus room" elsewhere) becomes the choice, once.
  const [sent, setSent] = useState(roomTaskId)
  if (roomTaskId !== sent) {
    setSent(roomTaskId)
    if (roomTaskId) setChosen(roomTaskId)
  }
  useEffect(() => {
    if (roomTaskId) useStore.setState({ roomTaskId: null })
  }, [roomTaskId])

  const open = useMemo(() => tasks.filter((t) => !t.done), [tasks])
  const plan = useMemo(() => localPlan(open, now), [open, now])
  const ordered = useMemo(
    () => plan.ids.map((id) => open.find((t) => t.id === id)).filter((t): t is Task => t !== undefined),
    [plan, open],
  )

  const running = focusTimer ? tasks.find((t) => t.id === focusTimer.taskId) : undefined
  if (focusTimer && running) return <RoomBlock task={running} timer={focusTimer.timer} />

  if (ended) {
    return (
      <BlockEnd
        ended={ended}
        onAnother={() => {
          setChosen(ended.taskId)
          useRoom.setState({ ended: null })
          focusSoon('.room-guess .chip')
        }}
        onDoneForNow={() => {
          useRoom.setState({ ended: null })
          navigate({ view: 'home', area: null })
        }}
      />
    )
  }

  const task = open.find((t) => t.id === chosen) ?? ordered[0]
  if (!task) {
    return (
      <div className="room-empty">
        <p className="room-empty__text">Nothing is open right now. Add a task on Today, then come back.</p>
        <button type="button" className="btn btn--primary" onClick={() => navigate({ view: 'home', area: null })}>
          Back to Today
        </button>
      </div>
    )
  }

  return (
    <>
      <p className="room-lede">One task, and everything that helps with it, on one screen.</p>
      <RoomChoose
        task={task}
        open={ordered}
        plan={plan}
        onPick={setChosen}
        onStart={(minutes, guessMin) => {
          if (sound) warmAudio()
          beginBlock(task.id, minutes, guessMin)
          focusSoon('.room-timer__btns button')
        }}
      />
    </>
  )
}
