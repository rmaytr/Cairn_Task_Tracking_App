import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import { useNow } from '../hooks'
import { localPlan } from '../plan/lockin'
import { useStore } from '../store/useStore'
import { BLOCKERS, BLOCKER_LABEL, MOVE_FOR, type Blocker } from './unstuck/blockers'
import { BeKind, IfThen, LessBoring, PickOne, SmallThings, TinyStep, WhyLine } from './unstuck/StuckMoves'
import './unstuck/unstuck.css'

const MOVE_TITLE: Record<Blocker, string> = {
  big: 'Make the first step tiny',
  start: 'Decide when you’ll start',
  boring: 'Make it less boring',
  bad: 'Be kind, then look at it',
  many: 'One thing, picked for you',
  energy: 'Go small today',
}

/** #adhd/unstuck: which task, what's in the way, one move that ends in a real action. */
export function Unstuck() {
  const tasks = useStore((s) => s.tasks)
  const now = useNow()
  const [taskId, setTaskId] = useState<string | null>(null)
  const [choosing, setChoosing] = useState(false)
  const [blocker, setBlocker] = useState<Blocker | null>(null)
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const heading = useRef<HTMLHeadingElement>(null)
  const firstRender = useRef(true)

  const ordered = useMemo(() => {
    const open = tasks.filter((t) => !t.done)
    const ids = localPlan(open, now).ids
    return ids.map((id) => open.find((t) => t.id === id)).filter((t) => t !== undefined)
  }, [tasks, now])
  const task = ordered.find((t) => t.id === taskId) ?? ordered[0]

  // Move focus to the new step's heading so keyboard and screen-reader users land on it.
  useEffect(() => {
    if (firstRender.current) firstRender.current = false
    else heading.current?.focus()
  }, [step, choosing])

  if (!task) {
    return (
      <div className="stuck">
        <p className="stuck__lede">Nothing is open right now. Add something on Today when you’re ready.</p>
      </div>
    )
  }
  const goBack = (): void => {
    if (step === 1 && choosing) setChoosing(false)
    else setStep(step === 3 ? 2 : 1)
  }

  return (
    <div className="stuck">
      <p className="stuck__steps" aria-hidden="true">
        Step {step} of 3
      </p>
      {step > 1 || choosing ? (
        <button type="button" className="btn btn--ghost btn--sm stuck__back" onClick={goBack}>
          <Icon name="chevronLeft" size={14} /> Back
        </button>
      ) : null}

      {step === 1 && !choosing && (
        <>
          <h2 ref={heading} tabIndex={-1} className="stuck__h">Which task feels stuck?</h2>
          <p className="stuck__pick">{task.title}</p>
          <div className="stuck__row">
            <button type="button" className="btn btn--primary" onClick={() => { setTaskId(task.id); setStep(2) }}>
              Use this one
            </button>
            {ordered.length > 1 && (
              <button type="button" className="btn" onClick={() => setChoosing(true)}>
                Pick another
              </button>
            )}
          </div>
        </>
      )}

      {step === 1 && choosing && (
        <>
          <h2 ref={heading} tabIndex={-1} className="stuck__h">Pick the task</h2>
          <ul className="stuck__choices">
            {ordered.slice(0, 8).map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  className="stuck__choice"
                  onClick={() => { setTaskId(t.id); setChoosing(false); setStep(2) }}
                >
                  {t.title}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {step === 2 && (
        <>
          <h2 ref={heading} tabIndex={-1} className="stuck__h">What’s in the way?</h2>
          <p className="stuck__task">{task.title}</p>
          <ul className="stuck__choices stuck__choices--big">
            {BLOCKERS.map((b) => (
              <li key={b}>
                <button type="button" className="stuck__choice" onClick={() => { setBlocker(b); setStep(3) }}>
                  {BLOCKER_LABEL[b]}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {step === 3 && blocker && (
        <>
          <h2 ref={heading} tabIndex={-1} className="stuck__h">{MOVE_TITLE[blocker]}</h2>
          <p className="stuck__task">{task.title}</p>
          {renderMove(blocker, task)}
          <WhyLine blocker={blocker} />
        </>
      )}
    </div>
  )
}

function renderMove(blocker: Blocker, task: Parameters<typeof TinyStep>[0]['task']) {
  switch (MOVE_FOR[blocker]) {
    case 'tiny-step':
      return <TinyStep task={task} />
    case 'if-then':
      return <IfThen task={task} />
    case 'less-boring':
      return <LessBoring task={task} />
    case 'be-kind':
      return <BeKind task={task} />
    case 'pick-one':
      return <PickOne />
    case 'small-things':
      return <SmallThings task={task} />
  }
}
