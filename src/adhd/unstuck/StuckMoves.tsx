import { useRef, useState, type ReactNode } from 'react'
import { useNow } from '../../hooks'
import { Icon } from '../../components/Icon'
import { addDays, todayISO } from '../../lib/dates'
import { nextStep } from '../../model/derive'
import type { Task } from '../../model/types'
import { filterByEffort, localPlan } from '../../plan/lockin'
import { useStore } from '../../store/useStore'
import { TreatPicker } from '../TreatPicker'
import { MOVE_FOR, WHEN_CHIPS, WHY, formatPlan, openersFor, type Blocker } from './blockers'

/** The "why this works" line, with its source in small text. */
export function WhyLine({ blocker }: { blocker: Blocker }) {
  const why = WHY[MOVE_FOR[blocker]]
  return (
    <p className="stuck__why">
      {why.line} <small>{why.source}</small>
    </p>
  )
}

const Saved = ({ children }: { children: ReactNode }) => (
  <p className="stuck__saved" role="status">
    <Icon name="check" size={16} /> {children}
  </p>
)

export function TinyStep({ task }: { task: Task }) {
  const addStep = useStore((s) => s.addStep)
  const openRoom = useStore((s) => s.openRoom)
  const [own, setOwn] = useState('')
  const [added, setAdded] = useState<string | null>(null)
  const add = (title: string): void => {
    const t = title.trim()
    if (!t) return
    addStep(task.id, t)
    setAdded(t)
    setOwn('')
  }
  return (
    <div className="stuck__move">
      <p className="stuck__lede">Pick a first step that takes about two minutes.</p>
      <ul className="stuck__choices">
        {openersFor(task.title).map((o) => (
          <li key={o}>
            <button type="button" className="stuck__choice" onClick={() => add(o)}>
              <Icon name="plus" size={16} /> {o}
            </button>
          </li>
        ))}
      </ul>
      <form
        className="stuck__form"
        onSubmit={(e) => {
          e.preventDefault()
          add(own)
        }}
      >
        <input className="field" aria-label="Your own tiny step" placeholder="Or write your own" value={own} maxLength={300} onChange={(e) => setOwn(e.target.value)} />
        <button type="submit" className="btn" disabled={!own.trim()}>
          Add
        </button>
      </form>
      {added && (
        <>
          <Saved>Added to “{task.title}”: {added}</Saved>
          <button type="button" className="btn btn--primary" onClick={() => openRoom(task.id)}>
            <Icon name="door" size={18} /> Start a 5-minute block in the Focus room
          </button>
        </>
      )}
    </div>
  )
}

export function IfThen({ task }: { task: Task }) {
  const updateTask = useStore((s) => s.updateTask)
  const [when, setWhen] = useState('')
  const [will, setWill] = useState(() => nextStep(task)?.title ?? '')
  const [saved, setSaved] = useState<string | null>(null)
  const plan = formatPlan(when, will)
  return (
    <form
      className="stuck__move"
      onSubmit={(e) => {
        e.preventDefault()
        if (!plan) return
        updateTask(task.id, { plan })
        setSaved(plan)
      }}
    >
      <p className="stuck__lede">Decide when you will start, so you don’t have to decide again.</p>
      <div className="stuck__chips" role="group" aria-label="When">
        {WHEN_CHIPS.map((c) => (
          <button key={c} type="button" className="stuck__chip" aria-pressed={when === c} onClick={() => setWhen(c)}>
            {c}
          </button>
        ))}
      </div>
      <label className="stuck__label">
        When
        <input className="field" value={when} maxLength={120} placeholder="e.g. after lunch" onChange={(e) => setWhen(e.target.value)} />
      </label>
      <label className="stuck__label">
        I will
        <input className="field" value={will} maxLength={160} placeholder="e.g. open the doc and write the title" onChange={(e) => setWill(e.target.value)} />
      </label>
      <button type="submit" className="btn btn--primary" disabled={!plan}>
        Save my plan
      </button>
      {saved && <Saved>Saved: {saved} You’ll see it on Today when this task is up next.</Saved>}
    </form>
  )
}

export function LessBoring({ task }: { task: Task }) {
  const navigate = useStore((s) => s.navigate)
  const openRoom = useStore((s) => s.openRoom)
  const [treat, setTreat] = useState(false)
  const [picked, setPicked] = useState(false)
  const treatButton = useRef<HTMLButtonElement>(null)
  return (
    <div className="stuck__move">
      <p className="stuck__lede">Make it a little nicer. Pick one.</p>
      <ul className="stuck__choices">
        <li>
          <button type="button" className="stuck__choice" onClick={() => navigate({ view: 'adhd', tool: 'sounds' })}>
            <Icon name="headphones" size={16} /> Put on a focus sound
          </button>
        </li>
        <li>
          <button type="button" className="stuck__choice" onClick={() => openRoom(task.id)}>
            <Icon name="door" size={16} /> Race your past self in the Focus room
          </button>
        </li>
        <li>
          <button type="button" className="stuck__choice" ref={treatButton} aria-expanded={treat} onClick={() => setTreat(true)}>
            <Icon name="gift" size={16} /> Pick a treat for after
          </button>
        </li>
      </ul>
      <p className="stuck__tip">Or change place: a different chair, the library, the kitchen table.</p>
      {treat &&
        (picked ? <Saved>Treat chosen. Now a short start.</Saved> : <TreatPicker
            onDone={() => {
              setPicked(true)
              treatButton.current?.focus() // the picker's Done / Skip goes away
            }}
          />)}
    </div>
  )
}

export function BeKind({ task }: { task: Task }) {
  const openRoom = useStore((s) => s.openRoom)
  const snoozeTask = useStore((s) => s.snoozeTask)
  const navigate = useStore((s) => s.navigate)
  const [snoozed, setSnoozed] = useState(false)
  if (snoozed) {
    return (
      <div className="stuck__move">
        <Saved>Moved it back. It will be there when you’re ready.</Saved>
        <button type="button" className="btn" onClick={() => navigate({ view: 'home', area: null })}>
          Back to Today
        </button>
      </div>
    )
  }
  return (
    <div className="stuck__move">
      <p className="stuck__kind">Avoiding something doesn’t mean you’re lazy. It usually means it feels heavy. That’s allowed.</p>
      <div className="stuck__row">
        <button type="button" className="btn btn--primary" onClick={() => openRoom(task.id)}>
          <Icon name="eye" size={18} /> Just look at it for 2 minutes
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            snoozeTask(task.id)
            setSnoozed(true)
          }}
        >
          Not now
        </button>
      </div>
    </div>
  )
}

export function PickOne() {
  const now = useNow()
  const tasks = useStore((s) => s.tasks)
  const startFocus = useStore((s) => s.startFocus)
  const listSort = useStore((s) => s.prefs.listSort)
  const plan = localPlan(tasks.filter((t) => !t.done), now, listSort)
  const pick = tasks.find((t) => t.id === plan.ids[0])
  if (!pick) return <p className="stuck__lede">Nothing is open. That’s fine.</p>
  return (
    <div className="stuck__move">
      <p className="stuck__lede">Cairn picked this one. Ignore the rest for now.</p>
      <p className="stuck__pick">{pick.title}</p>
      {plan.reasons[pick.id] && <p className="stuck__tip">{plan.reasons[pick.id]}</p>}
      <button type="button" className="btn btn--primary" onClick={() => startFocus(pick.id)}>
        <Icon name="target" size={18} /> Lock in
      </button>
    </div>
  )
}

export function SmallThings({ task }: { task: Task }) {
  const now = useNow()
  const tasks = useStore((s) => s.tasks)
  const openRoom = useStore((s) => s.openRoom)
  const navigate = useStore((s) => s.navigate)
  const updateTask = useStore((s) => s.updateTask)
  const [moved, setMoved] = useState(false)
  const quick = filterByEffort(tasks, 'quick').slice(0, 3)
  const today = todayISO(now)
  const heavyToday = !moved && task.effort !== 's' && (task.horizon === 'today' || task.due === today)
  return (
    <div className="stuck__move">
      <p className="stuck__lede">Low energy is real. Go small today.</p>
      {quick.length > 0 && (
        <ul className="stuck__choices" aria-label="Quick wins">
          {quick.map((t) => (
            <li key={t.id}>
              <button type="button" className="stuck__choice" onClick={() => openRoom(t.id)}>
                <Icon name="check" size={16} /> {t.title}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="stuck__row">
        <button type="button" className="btn" onClick={() => navigate({ view: 'adhd', tool: 'move' })}>
          <Icon name="walk" size={18} /> Take a move break
        </button>
        {heavyToday && (
          <button
            type="button"
            className="btn"
            onClick={() => {
              updateTask(task.id, { due: addDays(today, 1) })
              setMoved(true)
            }}
          >
            Move “{task.title}” to tomorrow
          </button>
        )}
      </div>
      {moved && <Saved>Moved to tomorrow. Today gets lighter.</Saved>}
    </div>
  )
}
