import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { TEXT_SIZES, THEMES } from '../model/themes'

// Vitest runs from the project root.
const html = readFileSync('index.html', 'utf8')
const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? ''

/** Runs the pre-paint theme script against a saved appearance and returns the attributes it set. */
function run(saved: unknown, systemDark = false): { theme?: string; textSize?: string } {
  const dataset: { theme?: string; textSize?: string } = {}
  const env = {
    document: { documentElement: { dataset } },
    localStorage: { getItem: () => JSON.stringify(saved) },
    matchMedia: () => ({ matches: systemDark }),
  }
  new Function(...Object.keys(env), script)(...Object.values(env))
  return dataset
}

describe('index.html theme script', () => {
  it('stays attribute-less so vite.config can hash it for the CSP', () => {
    expect(script).not.toBe('')
  })

  it('applies every known theme and text size', () => {
    for (const t of THEMES) expect(run({ theme: t.id }).theme).toBe(t.id)
    for (const size of TEXT_SIZES) expect(run({ textSize: size }).textSize).toBe(size)
  })

  it('follows the system for "system" and ignores unknown or hostile values', () => {
    expect(run({ theme: 'system' }, true).theme).toBe('night')
    expect(run({ theme: '"><img src=x>', textSize: 'huge' })).toEqual({ theme: 'stone' })
    expect(run({ theme: ['night'], textSize: { length: 1 } })).toEqual({ theme: 'stone' })
  })
})
