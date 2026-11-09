import { AnimatePresence } from 'motion/react'
import { useMemo, type ReactNode } from 'react'
import { areaStyle, useNow, useSwipeHint } from '../hooks'
import { MAX_AREAS } from '../model/defaults'
import { effectiveHorizon } from '../model/derive'
import { HORIZONS, HORIZON_LABEL, type Task } from '../model/types'
import { orderTasks } from '../plan/order'
import { useStore } from '../store/useStore'
import { AddRow } from './AddRow'
import { Icon } from './Icon'
import { TaskRow } from './TaskRow'
import { sortItems, useTaskReorder, type ListOrder, type OrderGroup } from './useTaskReorder'
import './ListView.css'

export type { ListSort } from './useTaskReorder'

export interface ListFilters extends ListOrder {
  showDone: boolean
  query: string
}

interface Group extends OrderGroup {
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

  const { rootRef, drag, rowReorder, withGap, announcer } = useTaskReorder(groups, filters, now)
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
        reorder={reorderable && !task.done ? rowReorder(task, group) : undefined}
      />
    ))
    return reorderable ? withGap(group, rows) : rows
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
      {announcer}
    </div>
  )
}
