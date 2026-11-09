import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { previewCapture, useAddTask } from '../assist/useAddTask'
import { areaStyle, useAreaMap, useNow } from '../hooks'
import { formatDue } from '../lib/dates'
import { guessIntents, type ActionId, type GoTarget, type Intent } from '../lib/intent'
import { compareUrgency, effectiveHorizon } from '../model/derive'
import { HORIZON_LABEL, type Area, type Task } from '../model/types'
import { THEMES, resolveTheme } from '../model/themes'
import { useStore } from '../store/useStore'
import { Dialog } from './Dialog'
import { Icon, type IconName } from './Icon'
import './QuickFind.css'

const MAX_TASKS = 6
const EMPTY_TASKS = 5

type Section = 'Best guess' | 'Tasks' | 'Go to' | 'Actions'

interface Item {
  id: string
  section: Section
  icon: IconName
  label: string
  meta?: string
  /** Area color for task rows. */
  area?: Area
  done?: boolean
  run: () => void
}

export function QuickFind() {
  const open = useStore((s) => s.quickFindOpen)
  const setOpen = useStore((s) => s.setQuickFindOpen)
  return (
    <Dialog open={open} onClose={() => setOpen(false)} title="Command palette">
      {open && <PaletteBody onDone={() => setOpen(false)} />}
    </Dialog>
  )
}

/** Matches every word of the query against title, notes and steps (so "lab cs" finds "CS303 lab report"). */
function score(task: Task, words: string[]): number {
  const title = task.title.toLowerCase()
  const rest = `${task.notes} ${task.steps.map((s) => s.title).join(' ')}`.toLowerCase()
  let total = 0
  for (const w of words) {
    if (title.startsWith(w)) total += 3
    else if (title.includes(w)) total += 2
    else if (rest.includes(w)) total += 1
    else return 0
  }
  return total
}

const matchesWords = (label: string, words: string[]): boolean => {
  const l = label.toLowerCase()
  return words.every((w) => l.includes(w))
}

const ACTIONS: { id: ActionId; label: string; icon: IconName }[] = [
  { id: 'new-task', label: 'New task', icon: 'plus' },
  { id: 'new-area', label: 'New area', icon: 'plus' },
  { id: 'import', label: 'Import', icon: 'import' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
  { id: 'reset', label: 'Weekly reset', icon: 'reset' },
  { id: 'shortcuts', label: 'Keyboard shortcuts', icon: 'keyboard' },
  { id: 'theme', label: 'Switch light/dark', icon: 'sun' },
]

const quote = (s: string): string => `‘${s}’`

function PaletteBody({ onDone }: { onDone: () => void }) {
  const tasks = useStore((s) => s.tasks)
  const areas = useStore((s) => s.areas)
  const view = useStore((s) => s.view)
  const addTask = useAddTask()
  const areaMap = useAreaMap()
  const now = useNow()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const items = useMemo(() => {
    const st = useStore.getState()
    const words = query.toLowerCase().split(/\s+/).filter(Boolean)
    const taskById = (id: string): Task | undefined => tasks.find((t) => t.id === id)
    const areaName = (id: string): string => areaMap.get(id)?.name ?? ''
    const close = (fn: () => void) => () => {
      onDone()
      fn()
    }

    const openTask = (id: string): void => {
      if (view === 'focus' || view === 'reset') st.navigate({ view: 'tasks', mode: 'list' })
      st.select(id)
    }
    const go = (target: GoTarget): void => {
      if (target === 'settings') st.setSettingsOpen(true)
      else if (target.startsWith('area:')) st.navigate({ view: 'tasks', area: target.slice(5) })
      else st.navigate({ view: target as 'home' | 'tasks' | 'focus' | 'reset', area: null })
    }
    const runAction = (id: ActionId): void => {
      if (id === 'new-task') st.setQuickAddOpen(true)
      else if (id === 'new-area') st.setNewAreaOpen(true)
      else if (id === 'import') st.setImportOpen(true)
      else if (id === 'settings') st.setSettingsOpen(true)
      else if (id === 'reset') st.navigate({ view: 'reset', area: null })
      else if (id === 'shortcuts') st.setShortcutsOpen(true)
      else {
        const current = resolveTheme(st.prefs.theme, window.matchMedia('(prefers-color-scheme: dark)').matches)
        const dark = THEMES.find((t) => t.id === current)?.dark ?? false
        st.setPrefs({ theme: dark ? 'stone' : 'night' })
      }
    }
    const goLabel = (target: GoTarget): string =>
      target.startsWith('area:') ? areaName(target.slice(5)) : { home: 'Today', tasks: 'All tasks', focus: 'Lock in', reset: 'Weekly reset', settings: 'Settings' }[target as string] ?? ''

    const describe = (intent: Intent): Item | null | undefined => {
      const t = 'taskId' in intent ? taskById(intent.taskId) : undefined
      const title = t ? quote(t.title) : ''
      switch (intent.kind) {
        case 'add': {
          const p = previewCapture(intent.text, null, areas)
          if (!p) return null
          const bits = [p.due ? ` for ${formatDue(p.due, now).toLowerCase()}` : '', ` · ${areaName(p.areaId)}`]
          return { id: 'best-add', section: 'Best guess', icon: 'plus', label: `Add ${quote(p.title)}${bits.join('')}`, run: close(() => {
              if (addTask(intent.text)) st.showToast(`Added to ${areaName(p.areaId)}`)
            }) }
        }
        case 'done':
          return t && { id: 'best', section: 'Best guess', icon: 'doneAll', label: `Mark ${title} done`, run: close(() => st.setDone(t.id, true)) }
        case 'snooze':
          return t && { id: 'best', section: 'Best guess', icon: 'clock', label: `Snooze ${title}`, run: close(() => st.snoozeTask(t.id)) }
        case 'move':
          return t && { id: 'best', section: 'Best guess', icon: 'move', label: `Move ${title} to ${areaName(intent.areaId)}`, run: close(() => st.moveTask(t.id, { areaId: intent.areaId }, `Moved to ${areaName(intent.areaId)}`)) }
        case 'reschedule':
          return t && { id: 'best', section: 'Best guess', icon: 'calendar', label: `Set ${title} for ${formatDue(intent.due, now).toLowerCase()}`, run: close(() => st.rescheduleTask(t.id, intent.due)) }
        case 'open':
          return t && { id: 'best', section: 'Best guess', icon: 'arrowRight', label: `Open ${title}`, run: close(() => openTask(t.id)) }
        case 'go':
          return { id: 'best', section: 'Best guess', icon: 'arrowRight', label: `Go to ${goLabel(intent.target)}`, run: close(() => go(intent.target)) }
        case 'action': {
          const a = ACTIONS.find((x) => x.id === intent.id)
          return a ? { id: 'best', section: 'Best guess', icon: a.icon, label: a.label, run: close(() => runAction(a.id)) } : null
        }
      }
    }

    const best = words.length ? guessIntents(query, { tasks, areas, now })[0] : undefined
    const out: Item[] = []
    const bestItem = best && describe(best)
    if (bestItem) out.push(bestItem)

    const pool = tasks.filter((t) => !t.done || words.length > 0)
    const found = words.length
      ? pool
          .map((t) => ({ t, s: score(t, words) }))
          .filter((r) => r.s > 0)
          .sort((a, b) => b.s - a.s || Number(a.t.done) - Number(b.t.done) || compareUrgency(a.t, b.t, now))
          .map((r) => r.t)
      : [...pool].sort((a, b) => compareUrgency(a, b, now)).slice(0, EMPTY_TASKS)
    for (const t of found.slice(0, MAX_TASKS)) {
      out.push({
        id: `task-${t.id}`,
        section: 'Tasks',
        icon: 'check',
        label: t.title,
        meta: `${areaName(t.areaId)} · ${t.done ? 'Done' : HORIZON_LABEL[effectiveHorizon(t, now)]}`,
        area: areaMap.get(t.areaId),
        done: t.done,
        run: close(() => openTask(t.id)),
      })
    }

    const places: { target: GoTarget; icon: IconName }[] = [
      { target: 'home', icon: 'home' },
      { target: 'tasks', icon: 'list' },
      { target: 'focus', icon: 'focus' },
      ...areas.map((a): { target: GoTarget; icon: IconName } => ({ target: `area:${a.id}`, icon: 'arrowRight' })),
    ]
    for (const p of places) {
      const label = goLabel(p.target)
      if (matchesWords(label, words)) out.push({ id: `go-${p.target}`, section: 'Go to', icon: p.icon, label, run: close(() => go(p.target)) })
    }
    for (const a of ACTIONS) {
      if (matchesWords(a.label, words)) out.push({ id: `action-${a.id}`, section: 'Actions', icon: a.icon, label: a.label, run: close(() => runAction(a.id)) })
    }
    return out
  }, [query, tasks, areas, areaMap, now, view, addTask, onDone])

  const current = Math.min(active, Math.max(items.length - 1, 0))
  const activeId = items[current] ? `pal-${items[current].id}` : undefined
  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView({ block: 'nearest' })
  }, [activeId])

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive(Math.min(current + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive(Math.max(current - 1, 0))
    } else if (e.key === 'Enter' && !e.nativeEvent.isComposing && items[current]) {
      e.preventDefault()
      items[current].run()
    }
  }

  const sections = (['Best guess', 'Tasks', 'Go to', 'Actions'] as const).filter((s) => items.some((i) => i.section === s))

  return (
    <div className="dialog__body find">
      <input
        className="field find__input"
        autoFocus
        data-autofocus
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setActive(0)
        }}
        onKeyDown={onKeyDown}
        placeholder="Type a task, a command, or search"
        aria-label="Type a task, a command, or search"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded
        aria-controls="find-results"
        aria-activedescendant={activeId}
      />
      <div id="find-results" className="find__results" role="listbox" aria-label="Results">
        {sections.map((section) => (
          <div key={section} role="group" aria-labelledby={`pal-h-${section.replace(' ', '')}`} className="find__group">
            <p className="find__heading" id={`pal-h-${section.replace(' ', '')}`}>
              {section}
            </p>
            {items.map((item, i) =>
              item.section !== section ? null : (
                <div
                  key={item.id}
                  id={`pal-${item.id}`}
                  role="option"
                  aria-selected={i === current}
                  className="find__item"
                  style={areaStyle(item.area)}
                  onMouseEnter={() => setActive(i)}
                  onClick={item.run}
                >
                  {item.area ? <span className="dot" /> : <Icon name={item.icon} size={18} />}
                  <span className={`find__title${item.done ? ' is-done' : ''}`}>{item.label}</span>
                  {item.meta && <span className="find__meta">{item.meta}</span>}
                </div>
              ),
            )}
          </div>
        ))}
      </div>
      <p className="find__hint">
        <span className="kbd">↑</span> <span className="kbd">↓</span> to move, <span className="kbd">Enter</span> to do it
      </p>
    </div>
  )
}
