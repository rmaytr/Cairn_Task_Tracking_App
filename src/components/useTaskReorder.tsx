import { useRef, useState, type ReactNode } from 'react'
import { applyMove, gapPosition, sortByRank } from '../lib/reorder'
import { effectiveHorizon, horizonIndex } from '../model/derive'
import { priorityOf, type Area, type Horizon, type Priority, type Task } from '../model/types'
import type { Prefs } from '../store/schema'
import { useStore } from '../store/useStore'
import { DropGap } from './DropGap'
import type { RowReorder } from './TaskRow'
import { useReorderDrag, type DropResult, type ReorderOptions } from './useReorderDrag'

/** 'manual' is "My order" (task.rank). */
export type ListSort = Prefs['listSort']['sort']

export interface ListOrder {
  sort: ListSort
  /** Flip the order: e.g. low priority first, or latest deadline first. */
  reverse: boolean
}

/** A list of task rows that can be reordered and dropped into: an area, or a "when". */
export interface OrderGroup {
  key: string
  title: string
  area?: Area
  horizon?: Horizon
  items: readonly { task: Task }[]
}

const PRIORITY_RANK: Record<Priority, number> = { high: 0, normal: 1, low: 2 }

/** Re-sorts the planner's order; ties keep the planner's order (stable sort). */
export function sortItems<T extends { task: Task }>(items: T[], sort: ListSort, reverse: boolean): T[] {
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

const openIds = (group: OrderGroup): string[] => group.items.filter((i) => !i.task.done).map((i) => i.task.id)

/** Toast for a drop into another group; like the radar, says when a due date keeps the task nearer. */
function movedLabel(task: Task, group: Omit<OrderGroup, 'items'>, now: Date): string {
  const pinned =
    group.horizon !== undefined &&
    task.due !== null &&
    horizonIndex(effectiveHorizon({ ...task, horizon: group.horizon }, now)) < horizonIndex(group.horizon)
  return `Moved to ${group.title}${pinned ? ' (due date keeps it closer)' : ''}`
}

/**
 * Applies an order the user made (`seen`: one group's open rows, top to bottom, `id` where they
 * put it; `cross` when it came from another group). Reordering in another sort switches to My
 * order; only changing when (or the area) keeps the sort. Returns what to announce.
 */
export function commitTaskOrder(seen: string[], id: string, group: Omit<OrderGroup, 'items'>, cross: boolean, list: ListOrder, now: Date): string | null {
  const { tasks, moveTask, reorderTasks, setPrefs } = useStore.getState()
  const task = tasks.find((t) => t.id === id)
  if (!task) return null
  const to = !cross ? undefined : group.horizon ? { horizon: group.horizon } : group.area ? { areaId: group.area.id } : undefined
  const where = to && movedLabel(task, group, now)
  if (to && list.sort !== 'manual') {
    moveTask(id, to, where)
    return `Moved ‘${task.title}’ to ${group.title}`
  }
  const switching = list.sort !== 'manual'
  reorderTasks(list.reverse ? [...seen].reverse() : seen, id, to, where || (switching ? 'Switched to My order' : 'Moved'))
  if (switching) setPrefs({ listSort: { sort: 'manual', reverse: list.reverse } })
  return `Moved ‘${task.title}’ to position ${seen.indexOf(id) + 1} of ${seen.length}${cross ? ` in ${group.title}` : ''}`
}

/**
 * Drag and Alt+Up/Down reordering for groups of TaskRows (All tasks, an area's page, Today).
 * Put `rootRef` on a positioned element holding every group, `drag.groupProps(key)` on each
 * group, `rowReorder` on its open rows, `withGap` around its rows, and render `announcer`.
 */
export function useTaskReorder(groups: readonly OrderGroup[], list: ListOrder, now: Date, options?: ReorderOptions) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [said, setSaid] = useState({ text: '', n: 0 })
  const announce = (text: string | null): void => {
    if (text) setSaid((s) => ({ text, n: s.n + 1 }))
  }

  const onDrop = ({ id, from, group: key, index }: DropResult): void => {
    const group = groups.find((g) => g.key === key)
    if (!group) return
    const others = openIds(group).filter((x) => x !== id)
    announce(commitTaskOrder([...others.slice(0, index), id, ...others.slice(index)], id, group, from !== key, list, now))
  }

  const moveByKey = (group: OrderGroup, id: string, delta: -1 | 1): void => {
    const ids = openIds(group)
    const from = ids.indexOf(id)
    const to = from + delta
    if (from < 0 || to < 0 || to >= ids.length) {
      const title = group.items.find((i) => i.task.id === id)?.task.title ?? 'This task'
      announce(`‘${title}’ is already ${delta < 0 ? 'first' : 'last'}`)
      return
    }
    const focused = document.activeElement
    announce(commitTaskOrder(applyMove(ids, from, to), id, group, false, list, now))
    // Reordering moves the row's DOM node, which can drop focus.
    requestAnimationFrame(() => {
      if (focused instanceof HTMLElement && focused.isConnected && document.activeElement !== focused) focused.focus()
    })
  }

  const drag = useReorderDrag('tasks', rootRef, onDrop, options)

  /** The `reorder` prop for one open row of `group`. */
  const rowReorder = (task: Task, group: OrderGroup): RowReorder => {
    const open = openIds(group)
    return {
      attrs: drag.itemProps(task.id),
      state: drag.stateOf(task.id),
      onHandleDown: (e) => drag.onHandleDown(e, task.id, group.key),
      onPressDown: (e) => drag.onPressDown(e, task.id, group.key),
      onMove: (delta) => moveByKey(group, task.id, delta),
      canMove: { up: open.indexOf(task.id) > 0, down: open.indexOf(task.id) < open.length - 1 },
    }
  }

  /** `rows` (a prefix of `group.items`, rendered) with the drop gap in place while dragging over it. */
  const withGap = (group: OrderGroup, rows: ReactNode[]): ReactNode[] => {
    const { spot } = drag
    if (spot?.group !== group.key) return rows
    const movable = group.items.map((i) => !i.task.done && i.task.id !== spot.id)
    return rows.toSpliced(gapPosition(movable, spot.index), 0, <DropGap key="drop-gap" spot={spot} />)
  }

  const announcer = (
    <p className="visually-hidden" aria-live="polite">
      <span key={said.n}>{said.text}</span>
    </p>
  )

  return { rootRef, drag, rowReorder, withGap, announcer }
}
