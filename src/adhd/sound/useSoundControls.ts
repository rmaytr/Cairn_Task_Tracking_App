import { useStore } from '../../store/useStore'
import type { NoiseKind } from '../types'
import { clampVolume } from './buffers'
import { play, setKind, setVolume, soundAvailable, stop, useSound, type SoundState } from './noise'

/** Names for each kind: `label` for headings, `name` inside sentences ("Play pink noise"). */
export const SOUND_INFO: Record<NoiseKind, { label: string; name: string; blurb: string }> = {
  white: { label: 'White noise', name: 'white noise', blurb: 'An even hiss, like a fan on high.' },
  pink: { label: 'Pink noise', name: 'pink noise', blurb: 'Softer and deeper, like steady wind.' },
  brown: { label: 'Brown noise', name: 'brown noise', blurb: 'A low rumble, like a far-off waterfall.' },
  rain: { label: 'Rain', name: 'rain', blurb: 'A gentle shower on a window.' },
}

export interface SoundControls extends SoundState {
  volume: number
  available: boolean
  toggle: () => void
  pickKind: (kind: NoiseKind) => void
  changeVolume: (v: number) => void
}

function save(patch: Partial<{ kind: NoiseKind; volume: number }>): void {
  const { prefs, setAdhd } = useStore.getState()
  setAdhd({ sound: { ...prefs.adhd.sound, ...patch } })
}

/** The engine's live state plus the saved kind and volume, and actions that keep both in step. */
export function useSoundControls(): SoundControls {
  const saved = useStore((s) => s.prefs.adhd.sound)
  const engine = useSound()
  return {
    ...engine,
    kind: engine.playing ? engine.kind : saved.kind,
    volume: saved.volume,
    available: soundAvailable(),
    toggle: () => {
      if (engine.playing) return stop()
      setVolume(saved.volume)
      play(saved.kind)
    },
    pickKind: (kind) => {
      save({ kind })
      setKind(kind)
    },
    changeVolume: (v) => {
      const volume = clampVolume(v)
      save({ volume })
      setVolume(volume)
    },
  }
}

/** One short line for a polite live region. */
export const statusText = (s: Pick<SoundState, 'playing' | 'kind'>): string =>
  s.playing ? `Playing ${SOUND_INFO[s.kind].name}.` : 'Sound off.'
