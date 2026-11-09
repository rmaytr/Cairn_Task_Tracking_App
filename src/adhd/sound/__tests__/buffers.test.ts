import { describe, expect, it } from 'vitest'
import { NOISE_KINDS, type NoiseKind } from '../../types'
import { clampVolume, LOOP_SECONDS, makeNoise, volumeToGain } from '../buffers'

const RATE = 8000

/** Deterministic PRNG (mulberry32) so the spectral checks never flake. */
function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const variance = (x: ArrayLike<number>): number => {
  let m = 0
  for (let i = 0; i < x.length; i++) m += x[i]
  m /= x.length
  let v = 0
  for (let i = 0; i < x.length; i++) v += (x[i] - m) ** 2
  return v / x.length
}

/** High-frequency share: variance of the first difference over the signal's. White ≈ 2, darker noise is lower. */
const brightness = (x: Float32Array): number => {
  const d = new Float32Array(x.length - 1)
  for (let i = 1; i < x.length; i++) d[i - 1] = x[i] - x[i - 1]
  return variance(d) / variance(x)
}

const noise = (kind: NoiseKind): Float32Array => makeNoise(kind, RATE, seeded(7))

describe('makeNoise', () => {
  it.each(NOISE_KINDS)('%s is LOOP_SECONDS long, finite, within [-1, 1] and not silent', (kind) => {
    const x = noise(kind)
    expect(x.length).toBe(LOOP_SECONDS * RATE)
    expect(x.every((v) => Number.isFinite(v) && v >= -1 && v <= 1)).toBe(true)
    expect(Math.sqrt(variance(x))).toBeGreaterThan(0.1)
  })

  it('tilts darker from white to pink to brown', () => {
    const [w, p, b] = (['white', 'pink', 'brown'] as const).map((k) => brightness(noise(k)))
    expect(w).toBeGreaterThan(1.8)
    expect(p).toBeLessThan(w * 0.6)
    expect(b).toBeLessThan(p * 0.2)
  })

  it('brown has no DC drift and is normalised so it is not too quiet', () => {
    const x = noise('brown')
    const mean = x.reduce((a, v) => a + v, 0) / x.length
    expect(Math.abs(mean)).toBeLessThan(0.01)
    expect(Math.sqrt(variance(x))).toBeGreaterThan(0.18)
  })

  it('loops without a click: the jump across the seam looks like any other step', () => {
    for (const kind of ['brown', 'pink', 'rain'] as const) {
      const x = noise(kind)
      const steps = Array.from({ length: x.length - 1 }, (_, i) => Math.abs(x[i + 1] - x[i])).sort((a, b) => a - b)
      const p99 = steps[Math.floor(steps.length * 0.99)]
      expect(Math.abs(x[0] - x[x.length - 1])).toBeLessThan(p99)
    }
  })
})

describe('volume', () => {
  it('clamps to 0..1 and treats NaN as silent', () => {
    expect(clampVolume(-1)).toBe(0)
    expect(clampVolume(2)).toBe(1)
    expect(clampVolume(Number.NaN)).toBe(0)
    expect(clampVolume(0.35)).toBe(0.35)
  })

  it('maps the slider to a squared gain', () => {
    expect(volumeToGain(0.5)).toBe(0.25)
    expect(volumeToGain(5)).toBe(1)
  })
})
