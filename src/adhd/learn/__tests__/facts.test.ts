import { describe, expect, it } from 'vitest'
import { ADHD_TOOLS } from '../../types'
import { EVIDENCE_LABEL, factOfDay, FACTS, MAX_BODY_WORDS, TOPIC_LABEL } from '../facts'

describe('facts library', () => {
  it('has 17 cards with unique ids', () => {
    expect(FACTS).toHaveLength(17)
    expect(new Set(FACTS.map((f) => f.id)).size).toBe(FACTS.length)
  })

  it('keeps every body under the word limit', () => {
    for (const f of FACTS) expect(f.body.split(/\s+/).length, f.id).toBeLessThan(MAX_BODY_WORDS)
  })

  it('cites at least one source with a year on every card', () => {
    for (const f of FACTS) {
      expect(f.sources.length, f.id).toBeGreaterThan(0)
      for (const s of f.sources) expect(s.year, f.id).toMatch(/^\d{4}$/)
    }
  })

  it('links "Try it" only to real tools other than What works itself', () => {
    for (const f of FACTS) {
      if (!f.tryIt) continue
      expect(ADHD_TOOLS, f.id).toContain(f.tryIt.tool)
      expect(f.tryIt.tool, f.id).not.toBe('learn')
      expect(f.tryIt.label.length, f.id).toBeGreaterThan(0)
    }
  })

  it('labels every evidence level and topic', () => {
    for (const f of FACTS) {
      expect(EVIDENCE_LABEL[f.evidence], f.id).toBeTruthy()
      expect(TOPIC_LABEL[f.topic], f.id).toBeTruthy()
    }
  })
})

describe('factOfDay', () => {
  it('is the same all day and moves on at local midnight', () => {
    const morning = factOfDay(new Date(2026, 10, 9, 0, 1))
    expect(factOfDay(new Date(2026, 10, 9, 23, 59))).toBe(morning)
    const next = factOfDay(new Date(2026, 10, 10, 0, 1))
    expect(FACTS.indexOf(next)).toBe((FACTS.indexOf(morning) + 1) % FACTS.length)
  })

  it('cycles through every card', () => {
    const seen = new Set(Array.from({ length: FACTS.length }, (_, i) => factOfDay(new Date(2026, 0, 1 + i)).id))
    expect(seen.size).toBe(FACTS.length)
  })
})
