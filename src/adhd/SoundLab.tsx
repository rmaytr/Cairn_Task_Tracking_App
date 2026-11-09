import { Icon } from '../components/Icon'
import { useStore } from '../store/useStore'
import { setStopAfter } from './sound/noise'
import { StopGlyph } from './sound/SoundToggle'
import { SoundVisual } from './sound/SoundVisual'
import { SOUND_INFO, statusText, useSoundControls } from './sound/useSoundControls'
import { VolumeSlider } from './sound/VolumeSlider'
import { soundComparison } from './stats'
import { NOISE_KINDS } from './types'
import './SoundLab.css'

const STOP_AFTER = [0, 15, 30, 60] as const

const clock = (ms: number): string => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

function Evidence() {
  return (
    <section className="slab__panel" aria-labelledby="slab-evidence">
      <h2 id="slab-evidence" className="slab__h2">
        What the research says
      </h2>
      <p>In studies of young people with ADHD, white or pink noise gave a small boost on short tasks.</p>
      <p>People without ADHD did slightly worse with it. No good studies have tested brown noise yet.</p>
      <p>So the honest answer is: try it and see. Keep it quiet, just loud enough to cover the room.</p>
      <p className="slab__source">Nigg et al., 2024, Journal of the American Academy of Child and Adolescent Psychiatry (a meta-analysis).</p>
    </section>
  )
}

function YourTest() {
  const sessions = useStore((s) => s.prefs.adhd.sessions)
  const { withSound, silent } = soundComparison(sessions)
  const blocks = (n: number) => `${n} ${n === 1 ? 'block' : 'blocks'}`
  return (
    <section className="slab__panel" aria-labelledby="slab-test">
      <h2 id="slab-test" className="slab__h2">
        Your test
      </h2>
      {withSound && silent ? (
        <>
          <p className="slab__result num">
            Rated focus with sound {withSound.mean} ({blocks(withSound.n)}) vs without {silent.mean} ({blocks(silent.n)}).
          </p>
          <p>
            {Math.abs(withSound.mean - silent.mean) < 0.5
              ? "That's close. Keep trying both for a while."
              : `So far, ${withSound.mean > silent.mean ? 'sound' : 'quiet'} seems to suit you better.`}
          </p>
        </>
      ) : (
        <p>Rate a few Focus room blocks with and without sound and Cairn will show which works better for you.</p>
      )}
      <button type="button" className="btn" onClick={() => useStore.getState().navigate({ view: 'adhd', tool: 'room' })}>
        <Icon name="door" size={16} /> Open the Focus room
      </button>
    </section>
  )
}

/** #adhd/sounds: pick a sound, play it, and see whether it helps you. */
export function SoundLab() {
  const sound = useSoundControls()
  const info = SOUND_INFO[sound.kind]

  return (
    <div className="slab">
      <p className="slab__intro">
        A steady sound can cover a noisy room and help some people stay with one thing. It keeps playing while you use the rest of Cairn.
      </p>
      {!sound.available && <p className="slab__unavailable">Sound isn't available on this browser.</p>}

      <fieldset className="slab__kinds">
        <legend className="visually-hidden">Sound</legend>
        {NOISE_KINDS.map((kind) => (
          <label key={kind} className="slab__card">
            <input
              type="radio"
              name="focus-sound"
              className="visually-hidden"
              value={kind}
              checked={sound.kind === kind}
              onChange={() => sound.pickKind(kind)}
            />
            <SoundVisual kind={kind} active={sound.playing && sound.kind === kind} />
            <span className="slab__card-name">{SOUND_INFO[kind].label}</span>
            <span className="slab__card-blurb">{SOUND_INFO[kind].blurb}</span>
          </label>
        ))}
      </fieldset>

      <div className="slab__controls">
        <button type="button" className="btn btn--primary btn--lg slab__play" disabled={!sound.available} onClick={sound.toggle}>
          {sound.playing ? <StopGlyph /> : <Icon name="play" size={18} />}
          {sound.playing ? 'Stop sound' : `Play ${info.name}`}
        </button>
        <VolumeSlider value={sound.volume} onChange={sound.changeVolume} />
        <fieldset className="slab__timer">
          <legend className="slab__timer-legend">Stop after</legend>
          <div className="slab__seg">
            {STOP_AFTER.map((min) => (
              <label key={min}>
                <input
                  type="radio"
                  name="stop-after"
                  className="visually-hidden"
                  checked={sound.stopAfterMin === min}
                  onChange={() => setStopAfter(min)}
                />
                <span>{min ? `${min} min` : 'Off'}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <p className="slab__status" aria-live="polite">
        {sound.available && statusText(sound)}
        {sound.stopAt !== null && ` Stops at ${clock(sound.stopAt)}.`}
      </p>

      <div className="slab__panels">
        <Evidence />
        <YourTest />
      </div>
    </div>
  )
}
