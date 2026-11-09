import { motion } from 'motion/react'
import { useId, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react'
import { areaStyle, useReducedMotion } from '../hooks'
import { isTaskDrag, TASK_DRAG_TYPE } from '../lib/drag'
import { gapPosition } from '../lib/reorder'
import { MAX_AREAS } from '../model/defaults'
import type { Area } from '../model/types'
import { useStore, type View } from '../store/useStore'
import { AreaMenu } from './AreaMenu'
import { Dialog } from './Dialog'
import { DropGap } from './DropGap'
import { Icon, type IconName } from './Icon'
import { Logo } from './Logo'
import { useMenu } from './useMenu'
import { SyncBadge } from './SyncBadge'
import { moveKeyDelta, useReorderDrag } from './useReorderDrag'
import './Navigation.css'

const NAV: readonly { view: View; label: string; icon: IconName; key: string }[] = [
  { view: 'home', label: 'Today', icon: 'home', key: '1' },
  { view: 'tasks', label: 'All tasks', icon: 'list', key: '2' },
  { view: 'focus', label: 'Lock in', icon: 'target', key: '3' },
  { view: 'adhd', label: 'ADHD toolkit', icon: 'brain', key: '4' },
]

function useOpenCounts(): Map<string, number> {
  const tasks = useStore((s) => s.tasks)
  return useMemo(() => {
    const map = new Map<string, number>()
    for (const t of tasks) if (!t.done) map.set(t.areaId, (map.get(t.areaId) ?? 0) + 1)
    return map
  }, [tasks])
}

/** The brand doubles as the Home button, like most apps. */
function Brand() {
  const navigate = useStore((s) => s.navigate)
  return (
    <button type="button" className="brand" onClick={() => navigate({ view: 'home', area: null })} aria-label="Cairn, go to Today">
      <Logo />
      <span className="brand__name">Cairn</span>
    </button>
  )
}

export function Sidebar() {
  const view = useStore((s) => s.view)
  const areaFilter = useStore((s) => s.areaFilter)
  const navigate = useStore((s) => s.navigate)
  const setImportOpen = useStore((s) => s.setImportOpen)
  const setSettingsOpen = useStore((s) => s.setSettingsOpen)
  const setQuickFindOpen = useStore((s) => s.setQuickFindOpen)
  const setQuickAddOpen = useStore((s) => s.setQuickAddOpen)
  const moveTask = useStore((s) => s.moveTask)
  const [dropOnToday, setDropOnToday] = useState(false)

  return (
    <nav className="side" aria-label="Main">
      <Brand />
      <div className="side__actions">
        <button type="button" className="btn btn--primary side__add" onClick={() => setQuickAddOpen(true)} aria-keyshortcuts="n">
          <Icon name="plus" size={18} /> New task
        </button>
        <button type="button" className="side__find" onClick={() => setQuickFindOpen(true)} aria-keyshortcuts="Control+K">
          <Icon name="search" size={17} />
          <span>Search</span>
          <span className="kbd" aria-hidden="true">
            Ctrl K
          </span>
        </button>
      </div>
      <ul className="side__nav">
        {NAV.map((item) => {
          const active = view === item.view && !(item.view === 'tasks' && areaFilter)
          return (
            <li
              key={item.view}
              // Dropping a dragged task on Today moves it to today.
              {...(item.view === 'home' && {
                onDragOver: (e: DragEvent) => {
                  if (!isTaskDrag(e)) return
                  e.preventDefault()
                  setDropOnToday(true)
                },
                onDragLeave: () => setDropOnToday(false),
                onDrop: (e: DragEvent) => {
                  setDropOnToday(false)
                  const id = e.dataTransfer.getData(TASK_DRAG_TYPE)
                  if (id) moveTask(id, { horizon: 'today' }, 'Moved to Today')
                },
              })}
            >
              <button
                type="button"
                className={`side__link${item.view === 'home' && dropOnToday ? ' is-drop' : ''}`}
                aria-current={active ? 'page' : undefined}
                onClick={() => navigate({ view: item.view, area: null })}
                aria-keyshortcuts={item.key}
              >
                {active && <NavPill />}
                <Icon name={item.icon} size={19} />
                {item.label}
              </button>
            </li>
          )
        })}
      </ul>
      <AreaNav />
      <div className="side__footer">
        <SyncBadge />
        <button type="button" className="side__link side__link--small" onClick={() => setImportOpen(true)}>
          <Icon name="import" size={18} /> Import
        </button>
        <button type="button" className="side__link side__link--small" onClick={() => setSettingsOpen(true)}>
          <Icon name="settings" size={18} /> Settings
        </button>
      </div>
    </nav>
  )
}

/** The active marker; one shared element, so it slides between items when the page changes. */
function NavPill() {
  return <motion.span layoutId="side-pill" className="side__pill" transition={{ type: 'spring', stiffness: 520, damping: 42 }} />
}

const AREAS_SCOPE = 'areas'

interface AreaItemProps {
  area: Area
  count: number
  current: boolean
  onOpen: () => void
  drag: ReturnType<typeof useReorderDrag>
  /** Alt+Up/Down: one place up or down. */
  onMove: (delta: -1 | 1) => void
}

/**
 * One area in the sidebar: click to open its page, ⋯ (or right-click) for its actions,
 * rename in place, drop a dragged task on it to move the task there, and drag it (grip, mouse
 * press-and-move, touch long-press) or press Alt+Up/Down to reorder.
 */
function AreaItem({ area, count, current, onOpen, drag, onMove }: AreaItemProps) {
  const updateArea = useStore((s) => s.updateArea)
  const moveTask = useStore((s) => s.moveTask)
  const menu = useMenu()
  const dotsRef = useRef<HTMLButtonElement>(null)
  const [renaming, setRenaming] = useState(false)
  const [dropping, setDropping] = useState(false)
  const reduce = useReducedMotion()
  const dragState = drag.stateOf(area.id)

  if (renaming) {
    return (
      <li>
        <form
          className="side__rename"
          style={areaStyle(area)}
          onSubmit={(e) => {
            e.preventDefault()
            // Enter unmounts the field without a blur, so save here too.
            const name = new FormData(e.currentTarget).get('name')?.toString().trim()
            if (name && name !== area.name) updateArea(area.id, { name })
            setRenaming(false)
          }}
        >
          <span className="side__area-dot" />
          <input
            className="side__rename-input"
            name="name"
            defaultValue={area.name}
            autoFocus
            maxLength={40}
            aria-label={`Rename ${area.name}`}
            onFocus={(e) => e.currentTarget.select()}
            onBlur={(e) => {
              const name = e.currentTarget.value.trim()
              if (name && name !== area.name) updateArea(area.id, { name })
              setRenaming(false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault()
                e.currentTarget.value = area.name
                e.currentTarget.blur()
              }
            }}
          />
        </form>
      </li>
    )
  }

  return (
    <motion.li
      {...drag.itemProps(area.id)}
      layout={!reduce && dragState !== 'lifted'}
      transition={{ duration: 0.18 }}
      className={`side__area-item${menu.anchor ? ' has-menu' : ''}${dropping ? ' is-drop' : ''}`}
      onDragOver={(e) => {
        if (!isTaskDrag(e)) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        setDropping(true)
      }}
      onDragLeave={() => setDropping(false)}
      onDrop={(e) => {
        setDropping(false)
        const id = e.dataTransfer.getData(TASK_DRAG_TYPE)
        if (id) moveTask(id, { areaId: area.id }, `Moved to ${area.name}`)
      }}
    >
      <span className="side__grip" aria-hidden="true" title="Drag to reorder (Alt+Up/Down)" onPointerDownCapture={(e) => drag.onHandleDown(e, area.id, AREAS_SCOPE)}>
        <Icon name="grip" size={14} />
      </span>
      <button
        type="button"
        className="side__area"
        style={areaStyle(area)}
        aria-current={current ? 'page' : undefined}
        aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
        onClick={onOpen}
        onPointerDown={(e) => drag.onPressDown(e, area.id, AREAS_SCOPE, true)}
        onKeyDown={(e) => {
          const delta = moveKeyDelta(e)
          if (!delta) return
          e.preventDefault()
          onMove(delta)
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          // The keyboard menu key reports (0, 0): open beside the ⋯ instead.
          menu.openAt(e.clientX || e.clientY ? { x: e.clientX, y: e.clientY } : { el: dotsRef.current })
        }}
      >
        {current && <NavPill />}
        <span className="side__area-dot" />
        <span className="side__area-name">{area.name}</span>
        <span className="side__count num">{count}</span>
      </button>
      <button
        ref={dotsRef}
        type="button"
        className="side__dots"
        aria-label={`Options for ${area.name}`}
        aria-haspopup="menu"
        aria-expanded={Boolean(menu.anchor)}
        onClick={() => (menu.anchor ? menu.close() : menu.openAt({ el: dotsRef.current }))}
      >
        <Icon name="dots" size={18} />
      </button>
      <AreaMenu area={area} anchor={menu.anchor} onClose={menu.close} onRename={() => setRenaming(true)} />
    </motion.li>
  )
}

/** Each area opens its own page (Tasks filtered to that area). */
function AreaNav({ onPick }: { onPick?: () => void }) {
  const areas = useStore((s) => s.areas)
  const areaFilter = useStore((s) => s.areaFilter)
  const view = useStore((s) => s.view)
  const navigate = useStore((s) => s.navigate)
  const setNewAreaOpen = useStore((s) => s.setNewAreaOpen)
  const reorderArea = useStore((s) => s.reorderArea)
  const counts = useOpenCounts()
  const headingId = useId()
  const rootRef = useRef<HTMLElement>(null)
  const [said, setSaid] = useState({ text: '', n: 0 })
  const announce = (text: string): void => setSaid((s) => ({ text, n: s.n + 1 }))

  const move = (id: string, to: number): void => {
    const area = areas.find((a) => a.id === id)
    if (!area) return
    reorderArea(id, to)
    announce(`Moved ‘${area.name}’ to position ${to + 1} of ${areas.length}`)
  }
  const drag = useReorderDrag(AREAS_SCOPE, rootRef, ({ id, index }) => move(id, index))
  const nudge = (id: string, delta: -1 | 1): void => {
    const from = areas.findIndex((a) => a.id === id)
    const to = from + delta
    if (to < 0 || to >= areas.length) {
      announce(`‘${areas[from]?.name ?? 'This area'}’ is already ${delta < 0 ? 'first' : 'last'}`)
      return
    }
    move(id, to)
    // Reordering moves the item's DOM node, which can drop focus.
    requestAnimationFrame(() => rootRef.current?.querySelector<HTMLElement>(`[data-drag-id="${CSS.escape(id)}"] .side__area`)?.focus())
  }

  const rows: ReactNode[] = areas.map((area) => (
    <AreaItem
      key={area.id}
      area={area}
      count={counts.get(area.id) ?? 0}
      current={view === 'tasks' && areaFilter === area.id}
      onOpen={() => {
        navigate({ view: 'tasks', area: area.id })
        onPick?.()
      }}
      drag={drag}
      onMove={(delta) => nudge(area.id, delta)}
    />
  ))
  const { spot } = drag
  if (spot) rows.splice(gapPosition(areas.map((a) => a.id !== spot.id), spot.index), 0, <DropGap key="drop-gap" spot={spot} />)

  return (
    <section className="side__areas" aria-labelledby={headingId} ref={rootRef}>
      <h2 id={headingId} className="side__heading">
        Areas
      </h2>
      <ul {...drag.groupProps(AREAS_SCOPE)}>{rows}</ul>
      <p className="visually-hidden" aria-live="polite">
        <span key={said.n}>{said.text}</span>
      </p>
      {areas.length < MAX_AREAS && (
        <button
          type="button"
          className="side__link side__link--small side__new-area"
          onClick={() => {
            setNewAreaOpen(true)
            onPick?.()
          }}
        >
          <Icon name="plus" size={17} /> New area
        </button>
      )}
    </section>
  )
}

const TABS: readonly { view: View; label: string; icon: IconName }[] = [
  { view: 'home', label: 'Today', icon: 'home' },
  { view: 'tasks', label: 'Tasks', icon: 'list' },
]

/** Phone navigation: Today · Tasks · [+] · Focus · More. */
export function BottomNav() {
  const view = useStore((s) => s.view)
  const navigate = useStore((s) => s.navigate)
  const setQuickAddOpen = useStore((s) => s.setQuickAddOpen)
  const [moreOpen, setMoreOpen] = useState(false)

  const tab = (item: { view: View; label: string; icon: IconName }) => (
    <button
      key={item.view}
      type="button"
      className="tabs__item"
      aria-current={view === item.view ? 'page' : undefined}
      onClick={() => navigate({ view: item.view, area: null })}
    >
      <Icon name={item.icon} size={22} />
      <span>{item.label}</span>
    </button>
  )

  return (
    <>
      <nav className="tabs" aria-label="Views">
        {TABS.map(tab)}
        <button type="button" className="tabs__add" onClick={() => setQuickAddOpen(true)} aria-label="New task">
          <Icon name="plus" size={26} />
        </button>
        {tab({ view: 'focus', label: 'Lock in', icon: 'target' })}
        <button type="button" className="tabs__item" onClick={() => setMoreOpen(true)} aria-haspopup="dialog">
          <Icon name="menu" size={22} />
          <span>More</span>
        </button>
      </nav>
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  )
}

function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const setImportOpen = useStore((s) => s.setImportOpen)
  const setSettingsOpen = useStore((s) => s.setSettingsOpen)
  const navigate = useStore((s) => s.navigate)
  return (
    <Dialog open={open} onClose={onClose} title="More">
      {open && (
        <div className="dialog__body more">
          <AreaNav onPick={onClose} />
          <div className="more__links">
            <button
              type="button"
              className="side__link"
              onClick={() => {
                navigate({ view: 'adhd', area: null })
                onClose()
              }}
            >
              <Icon name="brain" size={19} /> ADHD toolkit
            </button>
            <button
              type="button"
              className="side__link"
              onClick={() => {
                navigate({ view: 'reset', area: null })
                onClose()
              }}
            >
              <Icon name="reset" size={19} /> Weekly reset
            </button>
            <button
              type="button"
              className="side__link"
              onClick={() => {
                onClose()
                setImportOpen(true)
              }}
            >
              <Icon name="import" size={19} /> Import
            </button>
            <button
              type="button"
              className="side__link"
              onClick={() => {
                onClose()
                setSettingsOpen(true)
              }}
            >
              <Icon name="settings" size={19} /> Settings
            </button>
          </div>
        </div>
      )}
    </Dialog>
  )
}
