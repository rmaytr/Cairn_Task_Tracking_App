import type { CSSProperties } from 'react'
import { useReducedMotion } from '../../hooks'
import type { NoiseKind } from '../types'
import './sound.css'

const BARS = 14
const range = (n: number) => Array.from({ length: n }, (_, i) => i)

/** Bar heights that hint at each spectrum: white is even and jagged, pink leans down, brown falls away. */
const HEIGHTS: Record<Exclude<NoiseKind, 'rain'>, number[]> = {
  white: [0.8, 0.55, 0.95, 0.6, 0.85, 0.5, 0.9, 0.65, 0.8, 0.55, 0.95, 0.6, 0.75, 0.85],
  pink: range(BARS).map((i) => 0.95 - i * 0.045 + (i % 2 ? -0.08 : 0.04)),
  brown: range(BARS).map((i) => 0.12 + 0.85 * Math.exp(-i / 5)),
}
const DROPS = [8, 22, 35, 49, 61, 74, 88, 15, 56, 81]

const vars = (v: Record<string, number>): CSSProperties => v as CSSProperties

/** A tiny picture of the sound. It moves only while that sound plays, and never with reduced motion. */
export function SoundVisual({ kind, active }: { kind: NoiseKind; active: boolean }) {
  const reduced = useReducedMotion()
  const animate = active && !reduced
  return (
    <span className="svis" data-kind={kind} data-active={animate} aria-hidden="true">
      {kind === 'rain'
        ? DROPS.map((x, i) => <span key={i} className="svis__drop" style={vars({ '--x': x, '--i': i, '--y': (i * 7) % 10 })} />)
        : HEIGHTS[kind].map((h, i) => <span key={i} className="svis__bar" style={vars({ '--h': h, '--i': i })} />)}
    </span>
  )
}
