import { useState } from 'react'
import { nextStep } from '../../model/derive'
import type { Task } from '../../model/types'
import { useStore } from '../../store/useStore'

interface TaskCardProps {
  task: Task
  /** A short "why this one" under the title (Up next's reason). */
  reason?: string | null
}

/** The one task: its title, the next small step set large, and every step to tick off. */
export function TaskCard({ task, reason }: TaskCardProps) {
  const updateStep = useStore((s) => s.updateStep)
  const addStep = useStore((s) => s.addStep)
  const [draft, setDraft] = useState('')
  const step = nextStep(task)
  const done = task.steps.filter((s) => s.done).length

  return (
    <div className="room-task">
      <h2 className="room-task__title">{task.title}</h2>
      {reason && <p className="room-task__why">{reason}</p>}
      <p className="room-task__label">{step ? `Next small step · ${done + 1} of ${task.steps.length}` : 'Next small step'}</p>
      <p className="room-task__step display">{step ? step.title : task.steps.length > 0 ? 'All steps done.' : 'Just start.'}</p>
      {task.steps.length > 0 ? (
        <ul className="room-task__steps" aria-label="Steps">
          {task.steps.map((s) => (
            <li key={s.id}>
              <label className={s.id === step?.id ? 'is-next' : undefined}>
                <input
                  type="checkbox"
                  className="check check--square"
                  checked={s.done}
                  onChange={(e) => updateStep(task.id, s.id, { done: e.target.checked })}
                />
                <span>{s.title}</span>
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <form
          className="room-task__add"
          onSubmit={(e) => {
            e.preventDefault()
            addStep(task.id, draft)
            setDraft('')
          }}
        >
          <input
            className="field"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="What’s the smallest first step?"
            aria-label="First step"
            maxLength={300}
          />
          <button type="submit" className="btn" disabled={!draft.trim()}>
            Add
          </button>
        </form>
      )}
    </div>
  )
}
