import { motion } from 'motion/react'
import { useState } from 'react'
import { useReducedMotion } from '../hooks'
import type { DragSpot } from './useReorderDrag'
import './Reorder.css'

/**
 * The slot a dragged item will land in. Where the item was lifted it appears at full size (the
 * item leaves the flow in the same frame, so nothing moves); in another group it grows open. On
 * drop it leaves the flow at once, as the item takes its place.
 */
export function DropGap({ spot }: { spot: DragSpot }) {
  const reduce = useReducedMotion()
  const [grow] = useState(!spot.fresh && !reduce)
  return (
    <motion.li
      className={`drop-gap${grow ? ' is-growing' : ''}`}
      aria-hidden="true"
      layout={reduce ? false : 'position'}
      style={{ height: spot.height, display: spot.settling ? 'none' : undefined }}
      exit={{ height: 0, opacity: 0, transition: { duration: reduce ? 0 : 0.18 } }}
      transition={{ duration: 0.18 }}
    />
  )
}
