import { motion } from 'motion/react'
import { useRef, useState, type ReactNode } from 'react'
import { areaStyle, useAreaMap, useReducedMotion } from '../hooks'
import { gapPosition } from '../lib/reorder'
import type { Task } from '../model/types'
import { useStore } from '../store/useStore'
import { DropGap } from './DropGap'
import { Icon } from './Icon'
import { moveKeyDelta, useReorderDrag } from './useReorderDrag'
import './StepList.css'

interface StepListProps {
  task: Task
  compact?: boolean
}

const SCOPE = 'steps'

/** Checklist of a task's steps with inline editing, reordering and an always-ready "add step" field. */
export function StepList({ task, compact = false }: StepListProps) {
  const addStep = useStore((s) => s.addStep)
  const updateStep = useStore((s) => s.updateStep)
  const deleteStep = useStore((s) => s.deleteStep)
  const moveStep = useStore((s) => s.moveStep)
  const area = useAreaMap().get(task.areaId)
  const reduce = useReducedMotion()
  const [draft, setDraft] = useState('')
  const [said, setSaid] = useState({ text: '', n: 0 })
  const addRef = useRef<HTMLInputElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  const move = (stepId: string, to: number): void => {
    const step = task.steps.find((s) => s.id === stepId)
    if (!step) return
    moveStep(task.id, stepId, to)
    setSaid((s) => ({ text: `Moved step ‘${step.title}’ to position ${to + 1} of ${task.steps.length}`, n: s.n + 1 }))
  }
  /** One place up or down, then back to the step's text so keyboard users keep their spot. */
  const nudge = (stepId: string, to: number): void => {
    if (to < 0 || to >= task.steps.length) return
    move(stepId, to)
    requestAnimationFrame(() => {
      rootRef.current?.querySelector<HTMLInputElement>(`[data-drag-id="${CSS.escape(stepId)}"] .steps__text`)?.focus()
    })
  }
  const drag = useReorderDrag(SCOPE, rootRef, ({ id, index }) => move(id, index))

  const rows: ReactNode[] = task.steps.map((step, i) => (
    // Keyed on the title too, so the uncontrolled input picks up external changes like Undo.
    <motion.li
      key={`${step.id}:${step.title}`}
      layout={!reduce && drag.stateOf(step.id) !== 'lifted'}
      transition={{ duration: 0.18 }}
      className={`steps__item${step.done ? ' is-done' : ''}`}
      {...drag.itemProps(step.id)}
    >
      <input
        type="checkbox"
        className="check check--square"
        checked={step.done}
        onChange={(e) => updateStep(task.id, step.id, { done: e.target.checked })}
        aria-label={`Step done: ${step.title}`}
      />
      <input
        className="steps__text"
        defaultValue={step.title}
        aria-label="Step"
        aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
        onBlur={(e) => {
          const v = e.target.value.trim()
          if (!v) deleteStep(task.id, step.id)
          else if (v !== step.title) updateStep(task.id, step.id, { title: v.slice(0, 300) })
        }}
        onKeyDown={(e) => {
          const delta = moveKeyDelta(e)
          if (delta) {
            // Steps move themselves; the row around them must not move the task too.
            e.preventDefault()
            e.stopPropagation()
            nudge(step.id, i + delta)
            return
          }
          if (e.key === 'Enter') {
            e.preventDefault()
            addRef.current?.focus()
          }
        }}
      />
      <span className="steps__move">
        {i > 0 && (
          <button type="button" className="steps__nudge" onClick={() => nudge(step.id, i - 1)} aria-label={`Move step ${step.title} up`}>
            <Icon name="arrowUp" size={14} />
          </button>
        )}
        {i < task.steps.length - 1 && (
          <button type="button" className="steps__nudge" onClick={() => nudge(step.id, i + 1)} aria-label={`Move step ${step.title} down`}>
            <Icon name="arrowDown" size={14} />
          </button>
        )}
      </span>
      <button type="button" className="icon-btn steps__del" onClick={() => deleteStep(task.id, step.id)} aria-label={`Remove step ${step.title}`}>
        <Icon name="close" size={16} />
      </button>
      <span className="steps__grip" aria-hidden="true" title="Drag to reorder (Alt+Up/Down)" onPointerDownCapture={(e) => drag.onHandleDown(e, step.id, SCOPE)}>
        <Icon name="grip" size={14} />
      </span>
    </motion.li>
  ))
  const { spot } = drag
  if (spot) rows.splice(gapPosition(task.steps.map((s) => s.id !== spot.id), spot.index), 0, <DropGap key="drop-gap" spot={spot} />)

  return (
    <div ref={rootRef} className={`steps${compact ? ' steps--compact' : ''}`} style={areaStyle(area)}>
      {task.steps.length > 0 && (
        <ul className="steps__list" {...drag.groupProps(SCOPE)}>
          {rows}
        </ul>
      )}
      <form
        className="steps__add"
        onSubmit={(e) => {
          e.preventDefault()
          addStep(task.id, draft)
          setDraft('')
        }}
      >
        <Icon name="plus" size={16} />
        <input
          ref={addRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={task.steps.length ? 'Add another step' : 'Break it into smaller steps'}
          aria-label="New step"
          maxLength={300}
        />
      </form>
      <p className="visually-hidden" aria-live="polite">
        <span key={said.n}>{said.text}</span>
      </p>
    </div>
  )
}
