/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { AREA_COLORS } from '../types'
import { THEMES, resolveTheme } from '../themes'
import { prefsSchema } from '../../store/schema'

/** Declarations of every `[data-theme='id']` block, by theme id. */
function themeBlocks(source: string): Map<string, Map<string, string>> {
  const blocks = new Map<string, Map<string, string>>()
  const text = source.replace(/\/\*[\s\S]*?\*\//g, '')
  for (const [, selector, body] of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const decls = new Map<string, string>()
    for (const [, name, value] of body.matchAll(/([\w-]+)\s*:\s*([^;]+);/g)) decls.set(name, value.trim())
    for (const [, id] of selector.matchAll(/\[data-theme='([\w-]+)'\]/g)) blocks.set(id, decls)
  }
  return blocks
}

/** Follows var(--x) inside the same block down to a hex value. */
function hex(decls: Map<string, string>, token: string): string {
  let value = decls.get(token)
  for (let i = 0; value?.startsWith('var(') && i < 5; i++) value = decls.get(value.slice(4, -1).trim())
  if (!value || !/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`${token} is not a 6-digit hex: ${value}`)
  return value
}

const luminance = (color: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(color.slice(i, i + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// The real stylesheet (vitest runs from the project root), so the test checks what ships.
const blocks = themeBlocks(readFileSync('src/themes.css', 'utf8'))
const required = [...(blocks.get('stone')?.keys() ?? [])]

// [text, background, minimum ratio]
const PAIRS: readonly [string, string, number][] = [
  ['--ink', '--canvas', 7],
  ['--ink-2', '--canvas', 4.5],
  ['--ink-3', '--canvas', 4.5],
  ['--ink-3', '--panel', 4.5],
  ['--ink-3', '--surface', 4.5],
  ['--on-action', '--action', 4.5],
  ['--on-primary', '--primary', 4.5],
  ['--primary', '--surface', 4.5],
  // Non-text contrast (WCAG 1.4.11): control borders and the focus ring.
  ['--field-border', '--canvas', 3],
  ['--field-border', '--surface', 3],
  ['--primary', '--canvas', 3],
  ['--primary-soft-ink', '--primary-soft', 4.5],
  ['--sun-ink', '--sun-soft', 4.5],
  ['--danger', '--surface', 4.5],
  ['--danger', '--danger-soft', 4.5],
  ...AREA_COLORS.map((c): [string, string, number] => [`--area-${c}-text`, '--surface', 4.5]),
]

describe('contrast helper', () => {
  it('matches the WCAG reference values', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 2)
  })
})

describe('themes.css', () => {
  it('has a block for every theme in the model', () => {
    expect([...blocks.keys()].sort()).toEqual(THEMES.map((t) => t.id).sort())
    expect(required.length).toBeGreaterThan(40)
  })

  describe.each(THEMES.map((t) => [t.id, t] as const))('%s', (id, theme) => {
    const decls = blocks.get(id) ?? new Map<string, string>()

    it('defines every token Stone defines', () => {
      expect(required.filter((token) => !decls.has(token))).toEqual([])
    })

    it('declares its light/dark color scheme', () => {
      expect(decls.get('color-scheme')).toBe(theme.dark ? 'dark' : 'light')
    })

    it('paints the browser chrome with its frame color', () => {
      expect(hex(decls, '--chrome').toLowerCase()).toBe(theme.color.toLowerCase())
    })

    it.each(PAIRS)('%s on %s is at least %s:1', (fg, bg, min) => {
      expect(contrast(hex(decls, fg), hex(decls, bg))).toBeGreaterThanOrEqual(min)
    })
  })
})

describe('resolveTheme', () => {
  it('follows the device for "system"', () => {
    expect(resolveTheme('system', false)).toBe('stone')
    expect(resolveTheme('system', true)).toBe('night')
  })

  it('keeps an explicit choice whatever the device says', () => {
    expect(resolveTheme('dusk', false)).toBe('dusk')
    expect(resolveTheme('notes', true)).toBe('notes')
  })
})

describe('stored theme preference', () => {
  const parse = (theme: unknown) => prefsSchema.parse({ theme }).theme

  it('maps the old light/dark values to Stone and Night', () => {
    expect(parse('light')).toBe('stone')
    expect(parse('dark')).toBe('night')
  })

  it('keeps known themes and falls back to system for anything else', () => {
    expect(parse('dusk')).toBe('dusk')
    expect(parse('sepia')).toBe('system')
    expect(parse(undefined)).toBe('system')
  })

  it('defaults text size to default and drops unknown sizes', () => {
    expect(prefsSchema.parse({}).textSize).toBe('default')
    expect(prefsSchema.parse({ textSize: 'huge' }).textSize).toBe('default')
    expect(prefsSchema.parse({ textSize: 'larger' }).textSize).toBe('larger')
  })
})