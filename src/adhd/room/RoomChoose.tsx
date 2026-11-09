import type { Task } from '../../model/types'
import type { LockInPlan } from '../../plan/lockin'
import { GuessPanel } from './GuessPanel'
import { TaskCard } from './TaskCard'

interface RoomChooseProps {
  task: Task
  /** Open tasks in Up next order, for the picker. */
  open: readonly Task[]
  plan: LockInPlan
  onPick: (taskId: string) => void
  onStart: (minutes: number, guessMin: number | null) => void
}

/** Before a block: the one task (Up next unless you pick another) and the guess. */
export function RoomChoose({ task, open, plan, onPick, onStart }: RoomChooseProps) {
  const upNext = plan.ids[0] === task.id

  return (
    <div className="room-grid">
      <section className="room-panel" aria-label="Your task">
        <p className="room-panel__eyebrow">{upNext ? 'Up next' : 'Your one task'}</p>
        <TaskCard task={task} reason={plan.reasons[task.id] ?? null} />
        {open.length > 1 && (
          <label className="room-pick">
            <span>Or pick another</span>
            <select className="field" value={task.id} onChange={(e) => onPick(e.target.value)}>
              {open.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </label>
        )}
      </section>
      <section className="room-panel" aria-labelledby="guess-h">
        <GuessPanel key={task.id} task={task} onStart={onStart} />
      </section>
    </div>
  )
}
