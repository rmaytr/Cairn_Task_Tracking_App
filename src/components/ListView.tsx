import { AnimatePresence } from 'motion/react'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { areaStyle, useNow, useSwipeHint } from '../hooks'
import { applyMove, gapPosition, sortByRank } from '../lib/reorder'
import { MAX_AREAS } from '../model/defaults'
import { effectiveHorizon, horizonIndex } from '../model/derive'
import { HORIZONS, HORIZON_LABEL, priorityOf, type Area, type Horizon, type Priority, type Task } from '../model/types'
import { orderTasks } from '../plan/order'
import type { Prefs } from '../store/schema'
import { useStore } from '../store/useStore'
import { AddRow } from './AddRow'
import { DropGap } from './DropGap'
import { Icon } from './Icon'
import { TaskRow } from './TaskRow'
import { useReorderDrag, type DropResult } from './useReorderDrag'
import './ListView.css'

/** 'manual' is "My order" (task.rank). */
export type ListSort = Prefs['listSort']['sort']

export interface ListFilters {
  sort: ListSort
  /** Flip the order: e.g. low priority first, or latest deadline first. */
  reverse: boolean
  showDone: boolean
  query: string
}

const PRIORITY_RANK: Record<Priority, number> = { high: 0, normal: 1, low: 2 }

/** Re-sorts the planner's order; ties keep the planner's order (stable sort). */
function sortItems<T extends { task: Task }>(items: T[], sort: ListSort, reverse: boolean): T[] {
  const sorted =
    sort === 'due'
      ? [...items].sort((a, b) => (a.task.due ?? '9999').localeCompare(b.task.due ?? '9999'))
      : sort === 'priority'
        ? [...items].sort((a, b) => PRIORITY_RANK[priorityOf(a.task)] - PRIORITY_RANK[priorityOf(b.task)])
        : sort === 'manual'
          ? sortByRank(items, (i) => i.task.rank)
          : items
  return reverse ? [...sorted].reverse() : sorted
}

interface Group {
  key: string
  title: string
  area?: Area
  horizon?: Horizon
  /** Rows can be dragged into (and within) this group. */
  droppable: boolean
  items: { task: Task; blockedBy?: string }[]
}

function matches(task: Task, query: string): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  return (
    task.title.toLowerCase().includes(q) ||
    task.notes.toLowerCase().includes(q) ||
    task.steps.some((s) => s.title.toLowerCase().includes(q))
  )
}

const openIds = (group: Group): string[] => group.items.filter((i) => !i.task.done).map((i) => i.task.id)

/** Toast for a drop into another group; like the radar, says when a due date keeps the task nearer. */
function movedLabel(task: Task, group: Group, now: Date): string {
  const pinned =
    group.horizon !== undefined &&
    task.due !== null &&
    horizonIndex(effectiveHorizon({ ...task, horizon: group.horizon }, now)) < horizonIndex(group.horizon)
  return `Moved to ${group.title}${pinned ? ' (due date keeps it closer)' : ''}`
}

/**
 * Every task, grouped by area — or, on an area's page, by when. Order inside a group follows
 * the chosen sort (by default the planning engine: deadlines, priority, "do after" links).
 * Rows reorder by drag or Alt+Up/Down; doing so in another sort switches to My order.
 */
export function ListView({ areaId, filters }: { areaId: string | null; filters: ListFilters }) {
  const areas = useStore((s) => s.areas)
  const tasks = useStore((s) => s.tasks)
  const hidden = useStore((s) => s.prefs.hiddenAreas)
  const setNewAreaOpen = useStore((s) => s.setNewAreaOpen)
  const now = useNow()
  const rootRef = useRef<HTMLDivElement>(null)
  const [said, setSaid] = useState({ text: '', n: 0 })
  const announce = (text: string): void => setSaid((s) => ({ text, n: s.n + 1 }))

  const groups = useMemo((): Group[] => {
    const keep = (t: Task): boolean =>
      (areaId ? t.areaId === areaId : !hidden.includes(t.areaId)) &&
      matches(t, filters.query)
    const ordered = sortItems(
      orderTasks(tasks.filter(keep), now).map((p) => ({ task: p.task, blockedBy: p.blockedBy[0]?.title })),
      filters.sort,
      filters.reverse,
    )
    const done = filters.showDone ? tasks.filter((t) => t.done && keep(t)).map((task) => ({ task })) : []
    const all = [...ordered, ...done]
    if (areaId) {
      const rings: Group[] = HORIZONS.map((h) => ({
        key: h,
        title: HORIZON_LABEL[h],
        horizon: h,
        droppable: true,
        items: all.filter((i) => !i.task.done && effectiveHorizon(i.task, now) === h),
      }))
      const withDone: Group[] = done.length ? [...rings, { key: 'done', title: 'Done', droppable: false, items: done }] : rings
      return withDone.filter((g) => g.items.length > 0 || g.key === 'today')
    }
    return areas
      .filter((a) => !hidden.includes(a.id))
      .map((a) => ({ key: a.id, title: a.name, area: a, droppable: true, items: all.filter((i) => i.task.areaId === a.id) }))
  }, [tasks, areas, hidden, areaId, filters, now])

  /** Applies an order the user made (`seen`: one group's open rows, top to bottom). */
  const commit = (seen: string[], id: string, group: Group, cross: boolean): void => {
    const { tasks: current, moveTask, reorderTasks, setPrefs } = useStore.getState()
    const task = current.find((t) => t.id === id)
    if (!task) return
    const to = !cross ? undefined : group.horizon ? { horizon: group.horizon } : group.area ? { areaId: group.area.id } : undefined
    const where = to && movedLabel(task, group, now)
    if (to && filters.sort !== 'manual') {
      // Changing when (or the area) keeps the current sort; only reordering asks for My order.
      moveTask(id, to, where)
      announce(`Moved ‘${task.title}’ to ${group.title}`)
      return
    }
    const switching = filters.sort !== 'manual'
    reorderTasks(filters.reverse ? [...seen].reverse() : seen, id, to, where || (switching ? 'Switched to My order' : 'Moved'))
    if (switching) setPrefs({ listSort: { sort: 'manual', reverse: filters.reverse } })
    announce(`Moved ‘${task.title}’ to position ${seen.indexOf(id) + 1} of ${seen.length}${cross ? ` in ${group.title}` : ''}`)
  }

  const onDrop = ({ id, from, group: key, index }: DropResult): void => {
    const group = groups.find((g) => g.key === key)
    if (!group) return
    const others = openIds(group).filter((x) => x !== id)
    commit([...others.slice(0, index), id, ...others.slice(index)], id, group, from !== key)
  }

  const moveByKey = (group: Group, id: string, delta: -1 | 1): void => {
    const ids = openIds(group)
    const from = ids.indexOf(id)
    const to = from + delta
    if (from < 0 || to < 0 || to >= ids.length) {
      const title = group.items.find((i) => i.task.id === id)?.task.title ?? 'This task'
      announce(`‘${title}’ is already ${delta < 0 ? 'first' : 'last'}`)
      return
    }
    const focused = document.activeElement
    commit(applyMove(ids, from, to), id, group, false)
    // Reordering moves the row's DOM node, which can drop focus.
    requestAnimationFrame(() => {
      if (focused instanceof HTMLElement && focused.isConnected && document.activeElement !== focused) focused.focus()
    })
  }

  const drag = useReorderDrag('tasks', rootRef, onDrop)
  const searching = filters.query.length > 0
  // Reordering a filtered subset would be guesswork about the hidden rows.
  const canReorder = !searching
  const total = groups.reduce((n, g) => n + g.items.length, 0)
  useSwipeHint(total > 0)

  const renderRows = (group: Group): ReactNode[] => {
    const reorderable = canReorder && group.droppable
    const rows: ReactNode[] = group.items.map(({ task, blockedBy }) => (
      <TaskRow
        key={task.id}
        task={task}
        now={now}
        blockedBy={blockedBy}
        reorder={
          reorderable && !task.done
            ? {
                attrs: drag.itemProps(task.id),
                state: drag.stateOf(task.id),
                onHandleDown: (e) => drag.onHandleDown(e, task.id, group.key),
                onPressDown: (e) => drag.onPressDown(e, task.id, group.key),
                onMove: (delta) => moveByKey(group, task.id, delta),
              }
            : undefined
        }
      />
    ))
    const { spot } = drag
    if (reorderable && spot?.group === group.key) {
      const movable = group.items.map((i) => !i.task.done && i.task.id !== spot.id)
      rows.splice(gapPosition(movable, spot.index), 0, <DropGap key="drop-gap" spot={spot} />)
    }
    return rows
  }

  return (
    <div className="list" ref={rootRef}>
      {groups.map((group) => {
        if (searching && group.items.length === 0) return null
        const rows = renderRows(group)
        return (
          <section
            key={group.key}
            className="list__group"
            style={areaStyle(group.area)}
            aria-labelledby={`g-${group.key}`}
            {...(canReorder && group.droppable ? drag.groupProps(group.key) : {})}
          >
            <h2 className="list__group-title" id={`g-${group.key}`}>
              {group.area && <span className="list__swatch" />}
              {group.title}
              <span className="list__count num">{group.items.length}</span>
            </h2>
            {rows.length > 0 && (
              <ul className="trows">
                <AnimatePresence initial={false}>{rows}</AnimatePresence>
              </ul>
            )}
            {!searching && (group.area || group.key === 'today') && (
              <AddRow label={group.area ? `Add to ${group.title}` : 'Add a task'} areaId={group.area?.id ?? areaId} />
            )}
          </section>
        )
      })}
      {!areaId && !searching && areas.length < MAX_AREAS && (
        <button type="button" className="list__new-area" onClick={() => setNewAreaOpen(true)}>
          <Icon name="plus" size={18} /> New area
        </button>
      )}
      <p className="list__empty" role="status">
        {searching && total === 0 ? 'No tasks match that search.' : ''}
      </p>
      <p className="visually-hidden" aria-live="polite">
        <span key={said.n}>{said.text}</span>
      </p>
    </div>
  )
}
