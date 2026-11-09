import { useId } from 'react'
import { Icon, type IconName } from '../../components/Icon'
import { useStore } from '../../store/useStore'
import type { PlaybookMark } from '../types'
import { EVIDENCE_LABEL, formatSources, type Evidence, type Fact } from './facts'
import { useOpenTool } from './useOpenTool'
import './learn.css'

const MARKS: readonly { mark: PlaybookMark; label: string; icon: IconName }[] = [
  { mark: 'helps', label: 'Helps me', icon: 'check' },
  { mark: 'try', label: 'Want to try', icon: 'flag' },
  { mark: 'nope', label: 'Not for me', icon: 'close' },
]

const DOTS: Record<Evidence, number> = { strong: 3, moderate: 2, early: 1 }

export function EvidenceTag({ evidence }: { evidence: Evidence }) {
  return (
    <span className={`evidence evidence--${evidence}`}>
      <span className="evidence__dots" aria-hidden="true">
        {[1, 2, 3].map((i) => (
          <i key={i} className={i <= DOTS[evidence] ? 'is-on' : undefined} />
        ))}
      </span>
      {EVIDENCE_LABEL[evidence]}
    </span>
  )
}

/** Helps me / Want to try / Not for me. Pressing the active one clears it. */
export function MarkButtons({ fact }: { fact: Fact }) {
  const mark = useStore((s) => s.prefs.adhd.playbook[fact.id])
  const setAdhd = useStore((s) => s.setAdhd)
  const choose = (next: PlaybookMark): void => {
    const current = useStore.getState().prefs.adhd.playbook
    const rest = Object.fromEntries(Object.entries(current).filter(([id]) => id !== fact.id))
    setAdhd({ playbook: next === current[fact.id] ? rest : { ...rest, [fact.id]: next } })
  }
  return (
    <div className="marks" role="group" aria-label={`Does “${fact.title}” fit you?`}>
      {MARKS.map((m) => (
        <button key={m.mark} type="button" className={`marks__btn marks__btn--${m.mark}`} aria-pressed={mark === m.mark} onClick={() => choose(m.mark)}>
          <Icon name={m.icon} size={14} /> {m.label}
        </button>
      ))}
    </div>
  )
}

interface FactCardProps {
  fact: Fact
  /** Heading level inside the surrounding section. */
  level?: 3 | 4
  /** Playbook rows: title, marks and "Try it" only. */
  compact?: boolean
}

export function FactCard({ fact, level = 3, compact = false }: FactCardProps) {
  const id = useId()
  const openTool = useOpenTool()
  const Heading = level === 3 ? 'h3' : 'h4'
  const tryIt = fact.tryIt
  return (
    <article className={`fact${compact ? ' fact--compact' : ''}`} aria-labelledby={id} data-fact={fact.id}>
      <div className="fact__top">
        <EvidenceTag evidence={fact.evidence} />
      </div>
      <Heading className="fact__title" id={id}>
        {fact.title}
      </Heading>
      {!compact && (
        <>
          <p className="fact__body">{fact.body}</p>
          <p className="fact__source">{formatSources(fact.sources)}</p>
        </>
      )}
      <div className="fact__foot">
        <MarkButtons fact={fact} />
        {tryIt && (
          <button type="button" className="btn btn--ghost btn--sm fact__try" onClick={() => openTool(tryIt.tool)}>
            {tryIt.label} <Icon name="arrowRight" size={14} />
          </button>
        )}
      </div>
    </article>
  )
}
