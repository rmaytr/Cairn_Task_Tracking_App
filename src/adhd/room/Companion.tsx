import { motion } from 'motion/react'
import { useReducedMotion } from '../../hooks'
import { useStore } from '../../store/useStore'
import { companionLine } from './logic'

const BREATH_S = 5.5

interface CompanionProps {
  title: string
  /** How far through the block, 0 to 1. */
  progress: number
  /** Breathing pauses with the timer. */
  paused: boolean
}

/**
 * The quiet companion: a small cairn that breathes slowly beside you, says hello at the start
 * and checks in once halfway. An experiment, labelled as one; off is one tap away.
 */
export function Companion({ title, progress, paused }: CompanionProps) {
  const on = useStore((s) => s.prefs.adhd.companion)
  const setAdhd = useStore((s) => s.setAdhd)
  const reduce = useReducedMotion()
  const breathe = on && !reduce && !paused

  return (
    <div className="room-buddy">
      <div className="room-buddy__head">
        <h2 className="room-panel__title">Quiet company</h2>
        <label className="room-buddy__switch">
          <input type="checkbox" className="check check--square" checked={on} onChange={(e) => setAdhd({ companion: e.target.checked })} />
          <span>Keep me company</span>
        </label>
      </div>
      <p className="room-buddy__note">An experiment: some people focus better with company.</p>
      {on && (
        <div className="room-buddy__body">
          <motion.svg
            className="room-buddy__cairn"
            viewBox="0 0 80 72"
            aria-hidden="true"
            animate={breathe ? { scale: [1, 1.04, 1] } : { scale: 1 }}
            transition={breathe ? { duration: BREATH_S, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
            style={{ originY: 1 }}
          >
            <ellipse className="room-buddy__ground" cx="40" cy="68" rx="30" ry="3" />
            <ellipse className="room-buddy__stone" cx="40" cy="56" rx="26" ry="10" />
            <ellipse className="room-buddy__stone" cx="38" cy="38" rx="19" ry="9" />
            <ellipse className="room-buddy__stone room-buddy__stone--top" cx="41" cy="22" rx="12" ry="8" />
          </motion.svg>
          <p className="room-buddy__line" aria-live="polite">
            {companionLine(title, progress)}
          </p>
        </div>
      )}
    </div>
  )
}
