import './sound.css'

interface VolumeSliderProps {
  /** 0..1 */
  value: number
  onChange: (value: number) => void
  /** Keep the word "Volume" for screen readers only. */
  compact?: boolean
}

/** Native range in 5% steps, so arrow keys work and the saved value stays a clean fraction. */
export function VolumeSlider({ value, onChange, compact = false }: VolumeSliderProps) {
  const pct = Math.round(value * 100)
  return (
    <label className={compact ? 'snd-volume snd-volume--compact' : 'snd-volume'}>
      <span className={compact ? 'visually-hidden' : 'snd-volume__label'}>Volume</span>
      <input
        type="range"
        className="snd-volume__range"
        min={0}
        max={100}
        step={5}
        value={pct}
        aria-valuetext={`${pct} percent`}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
      />
    </label>
  )
}
