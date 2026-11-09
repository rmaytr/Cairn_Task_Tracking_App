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
  startY: number
  y: number
  dy: number
  scale: number
  moved: boolean
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

/** Top in viewport px from layout offsets (not transforms), so in-flight layout animations don't make targets flicker. The root must be positioned. */
function layoutTop(el: HTMLElement, root: HTMLElement): number {
  let y = 0
  for (let n: HTMLElement | null = el; n && n !== root; n = n.offsetParent as HTMLElement | null) y += n.offsetTop
  return root.getBoundingClientRect().top + y
}

function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
    const { overflowY } = getComputedStyle(n)
    if (/auto|scroll|overlay/.test(overflowY) && n.scrollHeight > n.clientHeight) return n
  }
  return null
}

function hitTest(root: HTMLElement, scope: string, id: string, y: number): DropSpot | null {
  let best: HTMLElement | null = null
  let bestDistance = Infinity
  for (const group of root.querySelectorAll<HTMLElement>(groupSelector(scope))) {
    const top = layoutTop(group, root)
    const distance = Math.max(0, top - y, y - top - group.offsetHeight)
    if (distance < bestDistance) [best, bestDistance] = [group, distance]
  }
  if (!best?.dataset.dropGroup) return null
  const rows = [...best.querySelectorAll<HTMLElement>(itemSelector(scope))].filter((r) => r.dataset.dragId !== id)
  return { group: best.dataset.dropGroup, index: rows.filter((r) => layoutTop(r, root) + r.offsetHeight / 2 < y).length }
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
  document.body.appendChild(clone)
  return clone
}

const paint = (s: Pick<Session, 'clone' | 'dy' | 'scale'>): void => {
  s.clone.style.transform = `translate3d(0, ${s.dy}px, 0) scale(${s.scale})`
}

/** Swallows the click that follows a drag, so dropping a row doesn't also open it. */
function swallowNextClick(): void {
  const off = (): void => window.removeEventListener('click', block, true)
  const block = (e: MouseEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    off()
  }
  window.addEventListener('click', block, true)
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
export function useReorderDrag(scope: string, rootRef: RefObject<HTMLElement | null>, onDrop: (drop: DropResult) => void) {
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

  const move = (clientY: number): void => {
    const s = session.current
    const root = rootRef.current
    if (!s || !root) return
    s.y = clientY
    s.moved ||= Math.abs(clientY - s.startY) > SLOP_PX
    s.dy = clientY - s.grabY - s.startTop
    paint(s)
    const next = hitTest(root, scope, s.id, clientY - s.grabY + s.height / 2)
    if (!next || (next.group === s.over.group && next.index === s.over.index)) return
    s.over = next
    setSpot({ ...next, id: s.id, height: s.height, fresh: false, settling: false })
  }

  const end = (commit: boolean): void => {
    const s = session.current
    if (!s) return
    session.current = null
    s.stop()
    swallowNextClick()
    const changed = commit && (s.over.group !== s.from.group || s.over.index !== s.from.index)
    if (changed) latest.current.onDrop({ id: s.id, from: s.from.group, ...s.over })
    settle.current = { s, anim: null }
    setSpot({ ...s.over, id: s.id, height: s.height, fresh: false, settling: true })
  }

  const start = (pointerId: number, clientY: number, id: string, group: string): void => {
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
    const s: Session = {
      id,
      from,
      over: from,
      pointerId,
      clone: makeClone(item, rect),
      height: rect.height,
      grabY: clientY - rect.top,
      startTop: rect.top,
      startY: clientY,
      y: clientY,
      dy: 0,
      scale: 1,
      moved: false,
      scroller: scrollParent(root),
      raf: 0,
      stop: () => {},
    }
    const onMove = (e: PointerEvent): void => {
      if (e.pointerId === pointerId) move(e.clientY)
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
      const box = s.scroller?.getBoundingClientRect()
      const top = Math.max(0, box?.top ?? 0)
      const bottom = Math.min(window.innerHeight, box?.bottom ?? window.innerHeight)
      const push = s.y < top + EDGE_PX ? s.y - top - EDGE_PX : s.y > bottom - EDGE_PX ? s.y - bottom + EDGE_PX : 0
      if (push && s.moved) {
        // Faster the deeper into the edge band, eased so the start is gentle.
        const speed = Math.sign(push) * Math.min(1, Math.abs(push) / EDGE_PX) ** 2 * MAX_SCROLL_PX
        ;(s.scroller ?? document.scrollingElement ?? document.documentElement).scrollBy(0, speed)
        move(s.y)
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

  // Once the list shows the drop, fly the copy onto the item's new place, then reveal the item.
  const settling = spot?.settling ?? false
  useLayoutEffect(() => {
    const current = settle.current
    const root = rootRef.current
    if (!settling || !current || !root) return
    const { s } = current
    const home = [...root.querySelectorAll<HTMLElement>(itemSelector(scope, s.id))].find((r) => r.dataset.dragState === 'settling')
    const target = home ? layoutTop(home, root) - s.startTop : s.dy
    const [fromDy, fromScale] = [s.dy, s.scale]
    s.clone.classList.add('is-settling')
    current.anim = animate(0, 1, {
      ...(latest.current.reduce || !home ? { duration: 0 } : SPRING),
      onUpdate: (p) => {
        s.dy = fromDy + (target - fromDy) * p
        s.scale = fromScale + (1 - fromScale) * p
        paint(s)
      },
      onComplete: finishSettle,
    })
    // finishSettle only touches refs and state setters, so it can stay out of the deps.
  }, [settling, scope, rootRef])

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
      settle.current?.s.clone.remove()
    },
    [],
  )

  /** Handle pointer-down (capture phase): starts at once and keeps the row's swipe out of it. */
  const onHandleDown = (e: ReactPointerEvent, id: string, group: string): void => {
    if (e.button !== 0 || session.current) return
    e.preventDefault()
    e.stopPropagation()
    start(e.pointerId, e.clientY, id, group)
  }

  /** Item pointer-down: on touch, holding still for a moment picks the item up. */
  const onPressDown = (e: ReactPointerEvent, id: string, group: string): void => {
    if (e.pointerType !== 'touch' || !e.isPrimary || session.current) return
    const { pointerId, clientX: x0, clientY: y0 } = e
    let y = y0
    const off = (): void => {
      window.clearTimeout(timer)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onEnd)
      window.removeEventListener('pointercancel', onEnd)
    }
    const onMove = (ev: PointerEvent): void => {
      if (ev.pointerId !== pointerId) return
      y = ev.clientY
      if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > SLOP_PX) off()
    }
    const onEnd = (ev: PointerEvent): void => {
      if (ev.pointerId === pointerId) off()
    }
    const timer = window.setTimeout(() => {
      off()
      navigator.vibrate?.(10)
      start(pointerId, y, id, group)
    }, LONG_PRESS_MS)
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
