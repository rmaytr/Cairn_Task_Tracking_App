import { useId } from 'react'
import { Icon } from '../../components/Icon'
import { NOISE_KINDS, type NoiseKind } from '../types'
import { SOUND_INFO, statusText, useSoundControls } from './useSoundControls'
import { VolumeSlider } from './VolumeSlider'
import './sound.css'

/** A filled square; the icon set has no stop glyph. */
export const StopGlyph = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
    <rect x="2" y="2" width="10" height="10" rx="2" fill="currentColor" />
  </svg>
)

/** Compact play/stop + kind + volume for the Focus room. Fits a ~280px card. */
export function SoundToggle() {
  const sound = useSoundControls()
  const selectId = useId()
  const info = SOUND_INFO[sound.kind]

  if (!sound.available) return <p className="snd-note">Sound isn't available on this browser.</p>

  return (
    <div className="stoggle" role="group" aria-label="Focus sound">
      <button
        type="button"
        className={sound.playing ? 'stoggle__play is-on' : 'stoggle__play'}
        aria-label={sound.playing ? 'Stop sound' : `Play ${info.name}`}
        onClick={sound.toggle}
      >
        {sound.playing ? <StopGlyph /> : <Icon name="play" size={16} />}
      </button>
      <label className="visually-hidden" htmlFor={selectId}>
        Sound
      </label>
      <select
        id={selectId}
        className="field stoggle__kind"
        value={sound.kind}
        onChange={(e) => sound.pickKind(e.target.value as NoiseKind)}
      >
        {NOISE_KINDS.map((kind) => (
          <option key={kind} value={kind}>
            {SOUND_INFO[kind].label}
          </option>
        ))}
      </select>
      <VolumeSlider value={sound.volume} onChange={sound.changeVolume} compact />
      <span className="visually-hidden" aria-live="polite">
        {statusText(sound)}
      </span>
    </div>
  )
}
