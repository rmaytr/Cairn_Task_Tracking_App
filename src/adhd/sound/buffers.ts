/** Pure noise generators for Focus sounds. No Web Audio here, so they run (and are tested) anywhere. */
import type { NoiseKind } from '../types'

/** Loop length and the overlap blended across the seam so the loop has no click. */
export const LOOP_SECONDS = 6
export const SEAM_SECONDS = 0.25

/** Target loudness (RMS) per kind: white is bright, so it sits lower; brown is dark, so a bit higher. */
const LEVEL: Record<NoiseKind, number> = { white: 0.14, pink: 0.2, brown: 0.21, rain: 0.2 }

type Random = () => number
const white = (rand: Random): number => rand() * 2 - 1

/** One-pole low-pass coefficient for a cutoff in Hz. */
const pole = (hz: number, rate: number): number => Math.exp((-2 * Math.PI * hz) / rate)

function whiteNoise(n: number, rand: Random): Float32Array {
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = white(rand)
  return out
}

/** Paul Kellet's refined pink filter: -3 dB/octave within 0.05 dB above 9 Hz. */
function pinkNoise(n: number, rand: Random): Float32Array {
  const out = new Float32Array(n)
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
  for (let i = 0; i < n; i++) {
    const w = white(rand)
    b0 = 0.99886 * b0 + w * 0.0555179
    b1 = 0.99332 * b1 + w * 0.0750759
    b2 = 0.969 * b2 + w * 0.153852
    b3 = 0.8665 * b3 + w * 0.3104856
    b4 = 0.55 * b4 + w * 0.5329522
    b5 = -0.7616 * b5 - w * 0.016898
    out[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362
    b6 = w * 0.115926
  }
  return out
}

/** Leaky integrator: -6 dB/octave, and the leak keeps it from drifting off. */
function brownNoise(n: number, rand: Random): Float32Array {
  const out = new Float32Array(n)
  let last = 0
  for (let i = 0; i < n; i++) {
    last = (last + 0.02 * white(rand)) / 1.02
    out[i] = last
  }
  return out
}

/** A soft band of noise (the shower) plus short bright taps (drops), breathing once per loop. */
function rainNoise(n: number, rate: number, rand: Random, loopLength: number): Float32Array {
  const out = new Float32Array(n)
  const bedLow = pole(3200, rate)
  const bedHigh = pole(280, rate)
  const tapLow = pole(1800, rate)
  const tapDecay = Math.exp(-1 / (0.006 * rate))
  const dropsPerSample = 45 / rate
  let lp = 0, rumble = 0, tapLp = 0, env = 0
  for (let i = 0; i < n; i++) {
    lp = bedLow * lp + (1 - bedLow) * white(rand)
    rumble = bedHigh * rumble + (1 - bedHigh) * lp
    const bed = (lp - rumble) * (0.85 + 0.15 * Math.sin((2 * Math.PI * i) / loopLength))
    if (rand() < dropsPerSample) env += 0.2 + 0.8 * rand() ** 3 // mostly small drops, a few bigger ones
    env *= tapDecay
    const w = white(rand)
    tapLp = tapLow * tapLp + (1 - tapLow) * w
    out[i] = bed * 2.2 + env * (w - tapLp) * 0.9
  }
  return out
}

/** Blends the extra tail into the head (equal power), so sample n-1 runs smoothly into sample 0. */
function loopSeam(raw: Float32Array, n: number, seam: number): Float32Array {
  const out = raw.slice(0, n)
  for (let i = 0; i < seam; i++) {
    const t = ((i + 0.5) / seam) * (Math.PI / 2)
    out[i] = raw[i] * Math.sin(t) + raw[n + i] * Math.cos(t)
  }
  return out
}

/** Removes any DC offset, scales to the kind's loudness and clamps into [-1, 1]. In place. */
function normalize(data: Float32Array, rms: number): Float32Array {
  const mean = data.reduce((a, b) => a + b, 0) / data.length
  let sq = 0
  for (let i = 0; i < data.length; i++) {
    data[i] -= mean
    sq += data[i] * data[i]
  }
  const scale = sq > 0 ? rms / Math.sqrt(sq / data.length) : 0
  for (let i = 0; i < data.length; i++) data[i] = Math.max(-1, Math.min(1, data[i] * scale))
  return data
}

/** One channel of seamlessly looping noise: LOOP_SECONDS long, finite, within [-1, 1]. */
export function makeNoise(kind: NoiseKind, sampleRate: number, rand: Random = Math.random, seconds = LOOP_SECONDS): Float32Array {
  const n = Math.max(1, Math.round(seconds * sampleRate))
  const seam = Math.min(n, Math.round(SEAM_SECONDS * sampleRate))
  const total = n + seam
  const raw =
    kind === 'white' ? whiteNoise(total, rand)
    : kind === 'pink' ? pinkNoise(total, rand)
    : kind === 'brown' ? brownNoise(total, rand)
    : rainNoise(total, sampleRate, rand, n)
  return normalize(loopSeam(raw, n, seam), LEVEL[kind])
}

/** Volume is a 0..1 fraction; anything else (NaN, out of range) is pulled back in. */
export const clampVolume = (v: number): number => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0)

/** Slider position to gain: squared, so the low end of the slider is usable (loudness is not linear). */
export const volumeToGain = (v: number): number => clampVolume(v) ** 2
