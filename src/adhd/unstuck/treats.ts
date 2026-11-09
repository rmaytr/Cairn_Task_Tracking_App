import { DEFAULT_TREATS, MAX_TREAT_LENGTH, MAX_TREATS } from '../types'

/** Pure edits to the reward menu. Each returns a new list; invalid edits return the list unchanged. */

export const normalizeTreat = (text: string): string => text.trim().replace(/\s+/g, ' ').slice(0, MAX_TREAT_LENGTH)

export function addTreat(list: readonly string[], text: string): string[] {
  const t = normalizeTreat(text)
  if (!t || list.length >= MAX_TREATS || list.some((x) => x.toLowerCase() === t.toLowerCase())) return [...list]
  return [...list, t]
}

export function renameTreat(list: readonly string[], index: number, text: string): string[] {
  const t = normalizeTreat(text)
  if (!t || index < 0 || index >= list.length) return [...list]
  return list.map((x, i) => (i === index ? t : x))
}

export const removeTreat = (list: readonly string[], index: number): string[] => list.filter((_, i) => i !== index)

export function moveTreat(list: readonly string[], index: number, by: -1 | 1): string[] {
  const to = index + by
  if (index < 0 || index >= list.length || to < 0 || to >= list.length) return [...list]
  const next = [...list]
  ;[next[index], next[to]] = [next[to]!, next[index]!]
  return next
}

export const resetTreats = (): string[] => [...DEFAULT_TREATS]

/**
 * Treats to offer, in order and not random: the window starts at `offset` and wraps, so each
 * block shows the next three. Fewer than `count` treats are all shown.
 */
export function rotateTreats(list: readonly string[], offset: number, count = 3): string[] {
  if (list.length === 0) return []
  const n = Math.min(count, list.length)
  const start = ((offset % list.length) + list.length) % list.length
  return Array.from({ length: n }, (_, i) => list[(start + i) % list.length]!)
}
