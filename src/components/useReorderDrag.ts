import { animate, type AnimationPlaybackControls } from 'motion/react'
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import { useReducedMotion } from '../hooks'

/** Where a dragged item would land: a group key and its index among that group's other items. */
export interface DropSpot {
  group: string
  index: number
}

/** What the list renders while dragging: the drop gap's place and size. */
export interface DragSpot extends DropSpot {
  id: string
  height: number
  /** The gap is still where the item was lifted, so it appears at full height instead of growing. */
  fresh: boolean
  /** Dropped: the copy is flying home and the gap has closed. */
  settling: boolean
}

export interface DropResult extends DropSpot {
  id: string
  from: string
}

export type DragState = 'lifted' | 'settling'

export interface ReorderOptions {
  /** 'xy' lets the copy follow the pointer sideways too, for groups laid out side by side. */
  axis?: 'y' | 'xy'
}

const LONG_PRESS_MS = 350
/** Movement that turns a press into a scroll or swipe, so the long press gives up. */
const SLOP_PX = 8
const EDGE_PX = 56
const MAX_SCROLL_PX = 18
const LIFT_SCALE = 1.02
const CLICK_GRACE_MS = 350
const SPRING ={ type: 'spring', bounce: 0, duration: 0.3 } as const

interface Session {
  id: string
  from: DropSpot
  over: DropSpot
  pointerId: number
  clone: HTMLElement
  height: number
  /** Pointer offset from the item's top, so the copy stays where it was grabbed. */
  grabY: number
  startTop: number
  startLeft: number
  width: number
  startX: number
  startY: number
  x: number
  y: number
  dx: number
  dy: number
  scale: number
  moved: boolean
  /** A pointermove is waiting for the next frame. */
  pending: boolean
  cache: Measure
  scroller: HTMLElement | null
  raf: number
  stop: () => void
}

/** Alt+Up/Down moves the focused row (or step) one place. */
export function moveKeyDelta(e: ReactKeyboardEvent): -1 | 1 | null {
  if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return null
  return e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : null
}

const itemSelector = (scope: string, id?: string): string =>
  `[data-drag="${scope}"][data-drag-id${id === undefined ? '' : `="${CSS.escape(id)}"`}]`
const groupSelector = (scope: string): string => `[data-drag="${scope}"][data-drop-group]`

/** Top (or left) in viewport px from layout offsets (not transforms), so in-flight layout animations don't make targets flicker. The root must be positioned. */
function layoutTop(el: HTMLElement, root: HTMLElement, side: 'Top' | 'Left' = 'Top'): number {
  let y = 0
  for (let n: HTMLElement | null = el; n && n !== root; n = n.offsetParent as HTMLElement | null) y += n[`offset${side}`]
  const box = root.getBoundingClientRect()
  return (side === 'Top' ? box.top : box.left) + y
}

function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
    const { overflowY } = getComputedStyle(n)
    if (/auto|scroll|overlay/.test(overflowY) && n.scrollHeight > n.clientHeight) return n
  }
  return null
}

/** Group and row positions in viewport px at one scroll offset; kept while a drag runs. */
interface Measure {
  scroll: number
  groups: { key: string; top: number; bottom: number; left: number; right: number; mids: number[] }[]
}

const scrollPos = (scroller: HTMLElement | null): number => (scroller ? scroller.scrollTop : window.scrollY)

/** Reads every group and row once (forces layout), leaving out the dragged item. */
function measure(root: HTMLElement, scope: string, id: string, scroller: HTMLElement | null): Measure {
  const groups = [...root.querySelectorAll<HTMLElement>(groupSelector(scope))].flatMap((group) => {
    const key = group.dataset.dropGroup
    if (!key) return []
    const top = layoutTop(group, root)
    const left = layoutTop(group, root, 'Left')
    const rows = [...group.querySelectorAll<HTMLElement>(itemSelector(scope))].filter((r) => r.dataset.dragId !== id)
    const mids = rows.map((r) => layoutTop(r, root) + r.offsetHeight / 2)
    return [{ key, top, bottom: top + group.offsetHeight, left, right: left + group.offsetWidth, mids }]
  })
  return { scroll: scrollPos(scroller), groups }
}

/** The group nearest the copy's centre (x, y), and the index among its rows. */
function hitTest(m: Measure, scroller: HTMLElement | null, x: number, y: number): DropSpot | null {
  // Scrolling since the measurement moved everything by the same amount.
  const shift = m.scroll - scrollPos(scroller)
  let best: Measure['groups'][number] | null = null
  let bestDistance = Infinity
  for (const group of m.groups) {
    const dy = Math.max(0, group.top + shift - y, y - group.bottom - shift)
    const distance = Math.hypot(dy, Math.max(0, group.left - x, x - group.right))
    if (distance < bestDistance) [best, bestDistance] = [group, distance]
  }
  return best ? { group: best.key, index: best.mids.filter((mid) => mid + shift < y).length } : null
}

/** A look-alike of the item that floats above the page while the real one holds its place. */
function makeClone(item: HTMLElement, rect: DOMRect): HTMLElement {
  const clone = item.cloneNode(true) as HTMLElement
  for (const n of [clone, ...clone.querySelectorAll<HTMLElement>('[id],[data-drag-id]')]) {
    n.removeAttribute('id')
    n.removeAttribute('data-drag-id')
  }
  clone.setAttribute('aria-hidden', 'true')
  clone.inert = true
  clone.classList.add('drag-ghost')
  clone.style.cssText += `;position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;margin:0;opacity:1;transform:none;--c:${getComputedStyle(item).getPropertyValue('--c')}`
  // A modal <dialog> sits in the top layer; the copy has to live inside it to show above it.
  ;(item.closest('dialog') ?? document.body).appendChild(clone)
  return clone
}

const paint = (s: Pick<Session, 'clone' | 'dx' | 'dy' | 'scale'>): void => {
  s.clone.style.transform = `translate3d(${s.dx}px, ${s.dy}px, 0) scale(${s.scale})`
}

/** Swallows the click that follows a drag, so dropping a row doesn't also open it. */
function swallowNextClick(): void {
  const off = (): void => {
    window.removeEventListener('click', block, true)
    window.removeEventListener('pointerdown', off, true)
  }
  const block = (e: MouseEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    off()
  }
  window.addEventListener('click', block, true)
  // A new press means the click we were waiting for is not coming.
  window.addEventListener('pointerdown', off, true)
  // A touch "tap" click can arrive a little after pointerup; nothing real is clicked this fast.
  window.setTimeout(off, CLICK_GRACE_MS)
}

/**
 * Pointer-driven reordering for mouse, pen and touch. Items carry `itemProps(id)`, drop zones
 * `groupProps(key)`, all inside a positioned `root`. Grab a handle (instantly) or long-press an
 * item on touch; the item lifts into a floating copy that follows the pointer, a gap opens where
 * it would land (neighbours glide via their `layout` animation), the scroller auto-scrolls near
 * its edges, and Escape puts it back. `onDrop` runs only when the spot changed.
 */
export function useReorderDrag(
  scope: string,
  rootRef: RefObject<HTMLElement | null>,
  onDrop: (drop: DropResult) => void,
  { axis = 'y' }: ReorderOptions = {},
) {
  const reduce = useReducedMotion()
  const [spot, setSpot] = useState<DragSpot | null>(null)
  const session = useRef<Session | null>(null)
  const settle = useRef<{ s: Session; anim: AnimationPlaybackControls | null } | null>(null)
  const latest = useRef({ onDrop, reduce })
  useLayoutEffect(() => {
    latest.current = { onDrop, reduce }
  })

  const finishSettle = (): void => {
    const current = settle.current
    if (!current) return
    settle.current = null
    current.anim?.stop()
    current.s.clone.remove()
    setSpot(null)
  }

  const move = (clientX: number, clientY: number): void => {
    const s = session.current
    const root = rootRef.current
    if (!s || !root) return
    s.x = clientX
    s.y = clientY
    s.moved ||= Math.hypot(clientX - s.startX, clientY - s.startY) > SLOP_PX
    s.dx = axis === 'xy' ? clientX - s.startX : 0
    s.dy = clientY - s.grabY - s.startTop
    paint(s)
    const next = hitTest(s.cache, s.scroller, s.startLeft + s.dx + s.width / 2, clientY - s.grabY + s.height / 2)
    if (!next || (next.group === s.over.group && next.index === s.over.index)) return
    s.over = next
    setSpot({ ...next, id: s.id, height: s.height, fresh: false, settling: false })
  }

  const end = (commit: boolean): void => {
    const s = session.current
    if (!s) return
    if (s.pending) move(s.x, s.y)
    session.current = null
    s.stop()
    // Only a drag that moved can be followed by a click on the row; Escape or a cancel must not eat a real tap.
    if (commit && s.moved) swallowNextClick()
    const changed = commit && (s.over.group !== s.from.group || s.over.index !== s.from.index)
    if (changed) latest.current.onDrop({ id: s.id, from: s.from.group, ...s.over })
    settle.current = { s, anim: null }
    setSpot({ ...s.over, id: s.id, height: s.height, fresh: false, settling: true })
  }

  const start = (pointerId: number, clientX: number, clientY: number, id: string, group: string): void => {
    const root = rootRef.current
    if (!root || session.current) return
    finishSettle()
    const item = root.querySelector<HTMLElement>(itemSelector(scope, id))
    if (!item) return
    const rect = item.getBoundingClientRect()
    const siblings = [...(item.closest(groupSelector(scope))?.querySelectorAll<HTMLElement>(itemSelector(scope)) ?? [])]
    const from = { group, index: Math.max(0, siblings.indexOf(item)) }
    try {
      // Keep receiving moves even when the item re-renders or the pointer leaves it.
      root.setPointerCapture(pointerId)
    } catch {
      // The pointer is already gone; window listeners still end the drag.
    }
    const scroller = scrollParent(root)
    const s: Session = {
      id,
      from,
      over: from,
      pointerId,
      clone: makeClone(item, rect),
      height: rect.height,
      grabY: clientY - rect.top,
      startTop: rect.top,
      startLeft: rect.left,
      width: rect.width,
      startX: clientX,
      startY: clientY,
      x: clientX,
      y: clientY,
      dx: 0,
      dy: 0,
      scale: 1,
      moved: false,
      pending: false,
      cache: measure(root, scope, id, scroller),
      scroller,
      raf: 0,
      stop: () => {},
    }
    const onMove = (e: PointerEvent): void => {
      if (e.pointerId !== pointerId) return
      // One hit-test per frame, however fast the pointer reports.
      s.x = e.clientX
      s.y = e.clientY
      s.pending = true
    }
    const onUp = (e: PointerEvent): void => {
      if (e.pointerId === pointerId) end(true)
    }
    const onCancel = (e: PointerEvent): void => {
      if (e.pointerId === pointerId) end(false)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopImmediatePropagation()
      end(false)
    }
    // A touch long-press would otherwise open the row's menu (or the system one) mid-drag.
    const noMenu = (e: Event): void => {
      e.preventDefault()
      e.stopPropagation()
    }
    const tick = (): void => {
      if (s.pending) {
        s.pending = false
        move(s.x, s.y)
      }
      const box = s.scroller?.getBoundingClientRect()
      const top = Math.max(0, box?.top ?? 0)
      const bottom = Math.min(window.innerHeight, box?.bottom ?? window.innerHeight)
      const push = s.y < top + EDGE_PX ? s.y - top - EDGE_PX : s.y > bottom - EDGE_PX ? s.y - bottom + EDGE_PX : 0
      if (push && s.moved) {
        // Faster the deeper into the edge band, eased so the start is gentle.
        const speed = Math.sign(push) * Math.min(1, Math.abs(push) / EDGE_PX) ** 2 * MAX_SCROLL_PX
        ;(s.scroller ?? document.scrollingElement ?? document.documentElement).scrollBy(0, speed)
        move(s.x, s.y)
      }
      s.raf = requestAnimationFrame(tick)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('contextmenu', noMenu, true)
    document.documentElement.classList.add('is-reordering')
    let lift: AnimationPlaybackControls | null = null
    s.stop = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('contextmenu', noMenu, true)
      document.documentElement.classList.remove('is-reordering')
      cancelAnimationFrame(s.raf)
      lift?.stop()
    }
    session.current = s
    setSpot({ ...from, id, height: rect.height, fresh: true, settling: false })
    if (!latest.current.reduce) {
      lift = animate(1, LIFT_SCALE, { ...SPRING, duration: 0.2, onUpdate: (v) => ((s.scale = v), paint(s)) })
    }
    s.raf = requestAnimationFrame(tick)
  }

  // The gap changes the layout, so refresh the cached positions once React has rendered it.
  const gapGroup = spot?.group
  const gapIndex = spot?.index
  useLayoutEffect(() => {
    const s = session.current
    const root = rootRef.current
    if (s && root) s.cache = measure(root, scope, s.id, s.scroller)
  }, [gapGroup, gapIndex, scope, rootRef])

  // Once the list shows the drop, fly the copy onto the item's new place, then reveal the item.
  const settling = spot?.settling ?? false
  useLayoutEffect(() => {
    const current = settle.current
    const root = rootRef.current
    if (!settling || !current || !root) return
    const { s } = current
    const home = [...root.querySelectorAll<HTMLElement>(itemSelector(scope, s.id))].find((r) => r.dataset.dragState === 'settling')
    const target = home ? layoutTop(home, root) - s.startTop : s.dy
    const targetX = home && axis === 'xy' ? layoutTop(home, root, 'Left') - s.startLeft : s.dx
    const [fromDx, fromDy, fromScale] = [s.dx, s.dy, s.scale]
    s.clone.classList.add('is-settling')
    current.anim = animate(0, 1, {
      ...(latest.current.reduce || !home ? { duration: 0 } : SPRING),
      onUpdate: (p) => {
        s.dx = fromDx + (targetX - fromDx) * p
        s.dy = fromDy + (target - fromDy) * p
        s.scale = fromScale + (1 - fromScale) * p
        paint(s)
      },
      onComplete: finishSettle,
    })
    // finishSettle only touches refs and state setters, so it can stay out of the deps.
  }, [settling, scope, rootRef, axis])

  // A long-press drag must stop the page from scrolling; only a non-passive listener can.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const hold = (e: TouchEvent): void => {
      if (session.current && e.cancelable) e.preventDefault()
    }
    root.addEventListener('touchmove', hold, { passive: false })
    return () => root.removeEventListener('touchmove', hold)
  }, [rootRef])

  useEffect(
    () => () => {
      session.current?.stop()
      session.current?.clone.remove()
      settle.current?.anim?.stop()
      settle.current?.s.clone.remove()
    },
    [],
  )

  /** Handle pointer-down (capture phase): starts at once and keeps the row's swipe out of it. */
  const onHandleDown = (e: ReactPointerEvent, id: string, group: string): void => {
    if (e.button !== 0 || session.current) return
    e.preventDefault()
    e.stopPropagation()
    start(e.pointerId, e.clientX, e.clientY, id, group)
  }

  /**
   * Item pointer-down: on touch, holding still for a moment picks the item up. With `mouse`, a
   * mouse press that then moves picks it up too (a plain click still clicks).
   */
  const onPressDown = (e: ReactPointerEvent, id: string, group: string, mouse = false): void => {
    if (!e.isPrimary || session.current) return
    const touch = e.pointerType === 'touch'
    if (!touch && (!mouse || e.button !== 0)) return
    const { pointerId, clientX: x0, clientY: y0 } = e
    let [x, y] = [x0, y0]
    const off = (): void => {
      window.clearTimeout(timer)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onEnd)
      window.removeEventListener('pointercancel', onEnd)
    }
    const onMove = (ev: PointerEvent): void => {
      if (ev.pointerId !== pointerId) return
      ;[x, y] = [ev.clientX, ev.clientY]
      if (Math.hypot(x - x0, y - y0) <= SLOP_PX) return
      off()
      if (touch) return
      // Lift from where the press began, then catch up, so the copy stays under the grab point.
      start(pointerId, x0, y0, id, group)
      if (session.current) Object.assign(session.current, { x, y, pending: true })
    }
    const onEnd = (ev: PointerEvent): void => {
      if (ev.pointerId === pointerId) off()
    }
    const timer = touch
      ? window.setTimeout(() => {
          off()
          navigator.vibrate?.(10)
          start(pointerId, x, y, id, group)
        }, LONG_PRESS_MS)
      : 0
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onEnd)
    window.addEventListener('pointercancel', onEnd)
  }

  const stateOf = (id: string): DragState | undefined =>
    spot?.id === id ? (spot.settling ? 'settling' : 'lifted') : undefined

  return {
    spot,
    onHandleDown,
    onPressDown,
    stateOf,
    itemProps: (id: string) => ({ 'data-drag': scope, 'data-drag-id': id, 'data-drag-state': stateOf(id) }),
    groupProps: (key: string) => ({ 'data-drag': scope, 'data-drop-group': key }),
  }
}
