import { motion } from 'motion/react'
import { Icon } from '../../components/Icon'
import { useReducedMotion } from '../../hooks'
import { useStore } from '../../store/useStore'
import { TOOLS, toolInfo } from '../tools'
import { useOpenTool } from './useOpenTool'

const SPRING = { type: 'spring', stiffness: 520, damping: 32 } as const

/** A clock face with a block of time drawn on it: time made visible, the room's whole idea. */
function RoomArt() {
  return (
    <svg className="hub-hero__art" viewBox="0 0 200 200" aria-hidden="true" focusable="false">
      <circle cx="100" cy="100" r="78" className="hub-hero__track" />
      <path d="M100 22 A78 78 0 0 1 174.2 124.1" className="hub-hero__arc" />
      {Array.from({ length: 12 }, (_, i) => (
        <line key={i} x1="100" y1="36" x2="100" y2={i % 3 === 0 ? 46 : 41} transform={`rotate(${i * 30} 100 100)`} className="hub-hero__tick" />
      ))}
      <circle cx="174.2" cy="124.1" r="7" className="hub-hero__dot" />
      <ellipse cx="100" cy="128" rx="26" ry="9" className="hub-hero__stone" />
      <ellipse cx="100" cy="111" rx="18" ry="8" className="hub-hero__stone" />
      <ellipse cx="100" cy="97" rx="10" ry="6" className="hub-hero__stone hub-hero__stone--top" />
    </svg>
  )
}

/** Focus room as the big card: the one primary action on the hub. */
function RoomHero() {
  const openTool = useOpenTool()
  const last = useStore((s) => s.prefs.adhd.sessions.at(-1))
  const room = toolInfo('room')
  return (
    <article className="hub-hero" aria-labelledby="hub-room-h">
      <div className="hub-hero__text">
        <h3 id="hub-room-h" className="hub-hero__label">
          <Icon name={room.icon} size={16} /> {room.label}
        </h3>
        <p className="hub-hero__statement display">Sit down with one thing. The room holds the rest.</p>
        <p className="hub-hero__blurb">{room.blurb}</p>
        <div className="hub-hero__actions">
          <button type="button" className="btn btn--primary btn--lg" onClick={() => openTool('room')}>
            <Icon name="play" size={16} /> Start a block
          </button>
          {last && (
            <span className="hub-hero__last num">
              Last block: {Math.round(last.actualMin)} min{last.title ? ` on “${last.title}”` : ''}
            </span>
          )}
        </div>
      </div>
      <RoomArt />
    </article>
  )
}

export function ToolCards() {
  const openTool = useOpenTool()
  const reduce = useReducedMotion()
  return (
    <section className="hub__tools" aria-labelledby="tools-h">
      <h2 id="tools-h" className="visually-hidden">
        Tools
      </h2>
      <RoomHero />
      <ul className="hub-tools">
        {TOOLS.filter((t) => t.id !== 'room').map((t) => (
          <li key={t.id}>
            <motion.button
              type="button"
              className="hub-tool"
              data-tool={t.id}
              onClick={() => openTool(t.id)}
              whileHover={reduce ? undefined : { y: -2 }}
              whileTap={reduce ? undefined : { scale: 0.98 }}
              transition={SPRING}
            >
              <span className="hub-tool__icon">
                <Icon name={t.icon} size={20} />
              </span>
              <span className="hub-tool__label">{t.label}</span>
              <span className="hub-tool__blurb">{t.blurb}</span>
              <span className="hub-tool__go" aria-hidden="true">
                <Icon name="arrowRight" size={16} />
              </span>
            </motion.button>
          </li>
        ))}
      </ul>
    </section>
  )
}
