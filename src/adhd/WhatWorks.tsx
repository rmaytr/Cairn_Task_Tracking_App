import { useState } from 'react'
import { useStore } from '../store/useStore'
import { EvidenceTag, FactCard } from './learn/FactCard'
import { EVIDENCE_MEANING, FACTS, TOPIC_LABEL, type Evidence, type Fact, type Topic } from './learn/facts'
import './learn/learn.css'

const TOPICS = (Object.keys(TOPIC_LABEL) as Topic[]).filter((t) => FACTS.some((f) => f.topic === t))
const LEVELS: readonly Evidence[] = ['strong', 'moderate', 'early']

function Playbook() {
  const playbook = useStore((s) => s.prefs.adhd.playbook)
  const groups: { title: string; facts: Fact[] }[] = [
    { title: 'Helps me', facts: FACTS.filter((f) => playbook[f.id] === 'helps') },
    { title: 'Want to try', facts: FACTS.filter((f) => playbook[f.id] === 'try') },
  ]
  const empty = groups.every((g) => g.facts.length === 0)
  return (
    <section className="panel learn__playbook" aria-labelledby="playbook-h">
      <h2 id="playbook-h">My playbook</h2>
      {empty ? (
        <p className="learn__hint">Mark a card “Helps me” or “Want to try” below and it lands here, so what works for you is one tap away.</p>
      ) : (
        groups
          .filter((g) => g.facts.length > 0)
          .map((g) => (
            <div key={g.title} className="learn__group">
              <h3 className="learn__group-title">
                {g.title} <span className="num">{g.facts.length}</span>
              </h3>
              <ul className="learn__list learn__list--compact">
                {g.facts.map((f) => (
                  <li key={f.id}>
                    <FactCard fact={f} level={4} compact />
                  </li>
                ))}
              </ul>
            </div>
          ))
      )}
    </section>
  )
}

function HowSure() {
  return (
    <details className="learn__sure">
      <summary>How sure is this?</summary>
      <dl>
        {LEVELS.map((e) => (
          <div key={e}>
            <dt>
              <EvidenceTag evidence={e} />
            </dt>
            <dd>{EVIDENCE_MEANING[e]}</dd>
          </div>
        ))}
      </dl>
    </details>
  )
}

/** #adhd/learn: short research cards in plain words, and the ones you keep. */
export function WhatWorks() {
  const [topic, setTopic] = useState<Topic | null>(null)
  const shown = topic ? FACTS.filter((f) => f.topic === topic) : FACTS
  return (
    <div className="learn">
      <p className="learn__lede">Short research summaries in plain words. Mark what fits you; your playbook keeps it.</p>
      <Playbook />
      <section className="learn__library" aria-labelledby="library-h">
        <div className="learn__library-head">
          <h2 id="library-h">All cards</h2>
          <HowSure />
        </div>
        <div className="learn__topics" role="group" aria-label="Filter by topic">
          <button type="button" className="chip" aria-pressed={topic === null} onClick={() => setTopic(null)}>
            All <span className="num">{FACTS.length}</span>
          </button>
          {TOPICS.map((t) => (
            <button key={t} type="button" className="chip" aria-pressed={topic === t} onClick={() => setTopic(topic === t ? null : t)}>
              {TOPIC_LABEL[t]}
            </button>
          ))}
        </div>
        <ul className="learn__list">
          {shown.map((f) => (
            <li key={f.id}>
              <FactCard fact={f} />
            </li>
          ))}
        </ul>
      </section>
      <p className="hub__foot">Cairn isn’t medical advice. Each card is a short summary of the sources named on it; the full studies say more.</p>
    </div>
  )
}
