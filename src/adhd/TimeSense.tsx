import { useEffect, useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import { useStore } from '../store/useStore'
import { guessRatio, MIN_GUESSES, suggestMinutes } from './calibration'
import { ratioHeadline, repeatedTasks } from './room/logic'
import { TimeChart } from './room/TimeChart'
import './room/panels.css'
import './room/timesense.css'

const MAX_GUESS = 600

/** #adhd/time: how your guesses compare with the clock, a padded-guess calculator, and your ghost paces. */
export function TimeSense() {
  const sessions = useStore((s) => s.prefs.adhd.sessions)
  const setAdhd = useStore((s) => s.setAdhd)
  const navigate = useStore((s) => s.navigate)
  const [guess, setGuess] = useState('')
  const [confirming, setConfirming] = useState(false)
  const resetButton = useRef<HTMLButtonElement>(null)
  const wasConfirming = useRef(false)
  const ratio = guessRatio(sessions)
  const guessed = sessions.filter((s) => s.guessMin !== null && s.guessMin > 0 && s.actualMin >= 1).length
  const repeats = repeatedTasks(sessions)
  const n = Math.round(Number(guess))
  const valid = guess !== '' && n >= 1 && n <= MAX_GUESS

  // Leaving the confirm step removes the focused button: go back to Reset, or to the page title once
  // the history (and the whole reset section) is gone.
  useEffect(() => {
    if (wasConfirming.current && !confirming) (resetButton.current ?? document.getElementById('adhd-tool-title'))?.focus()
    wasConfirming.current = confirming
  }, [confirming])

  return (
    <div className="ts">
      <section className="room-panel ts-hero" aria-labelledby="ts-big">
        {ratio ? (
          <>
            <p className="ts-hero__big display" id="ts-big">
              {ratioHeadline(ratio)}
            </p>
            <p className="room-panel__hint">From your last {ratio.n} guessed blocks. Cairn pads your next guesses with it.</p>
          </>
        ) : (
          <>
            <p className="ts-hero__big display" id="ts-big">
              Make {MIN_GUESSES} guesses first
            </p>
            <p className="room-panel__hint">
              Before a block in the Focus room, guess how long it will take. After {MIN_GUESSES}, Cairn shows how your guesses
              compare with the clock. {guessed > 0 && `${guessed} of ${MIN_GUESSES} so far.`}
            </p>
            <button type="button" className="btn btn--primary" onClick={() => navigate({ view: 'adhd', tool: 'room' })}>
              <Icon name="door" size={16} /> Open the Focus room
            </button>
          </>
        )}
        <TimeChart sessions={sessions} />
      </section>

      <div className="room-grid">
        <section className="room-panel" aria-labelledby="pad-h">
          <h2 className="room-panel__title" id="pad-h">
            Pad my guess
          </h2>
          <label className="ts-pad">
            <span>My guess, in minutes</span>
            <input
              className="field num"
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_GUESS}
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
            />
          </label>
          <p className="ts-pad__out" aria-live="polite">
            {!valid
              ? ''
              : ratio
                ? `Plan for about ${suggestMinutes(n, ratio)} min.`
                : `Plan for ${suggestMinutes(n, null)} min for now. After ${MIN_GUESSES} guessed blocks, this pads it for you.`}
          </p>
        </section>

        <section className="room-panel" aria-labelledby="ghost-h">
          <h2 className="room-panel__title" id="ghost-h">
            Your ghost pace
          </h2>
          {repeats.length === 0 ? (
            <p className="room-panel__hint">Do the same task in two blocks and your last and best times show here, to race gently.</p>
          ) : (
            <ul className="ts-ghosts">
              {repeats.map((r) => (
                <li key={r.title}>
                  <span className="ts-ghosts__title">{r.title}</span>
                  <span className="num">
                    last {r.last} min · best {r.best} min · {r.n} blocks
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="room-panel ts-why" aria-labelledby="why-h">
        <h2 className="room-panel__title" id="why-h">
          Why guess?
        </h2>
        <p>
          Most people underestimate how long tasks take, even ones they have done before. Looking back at how long similar
          tasks really took can make the next guess more realistic (
          <a href="https://doi.org/10.1037/0022-3514.67.3.366" target="_blank" rel="noreferrer">
            Buehler and others, 1994
          </a>
          ). Research also links ADHD with differences in sensing time (Marx and others, 2022), so a clock you can see and
          your own numbers may help.
        </p>
      </section>

      {sessions.length > 0 && (
        <section className="ts-reset" aria-label="Reset">
          {confirming ? (
            <div className="ts-reset__confirm" role="group" aria-label="Reset my history">
              <p>
                This removes all {sessions.length} blocks from this device, with their guesses and focus ratings. It can’t be
                undone.
              </p>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setAdhd({ sessions: [] })
                  setConfirming(false)
                }}
              >
                Clear my history
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => setConfirming(false)} autoFocus>
                Keep it
              </button>
            </div>
          ) : (
            <button type="button" className="btn btn--ghost btn--sm" ref={resetButton} onClick={() => setConfirming(true)}>
              Reset my history
            </button>
          )}
        </section>
      )}
    </div>
  )
}
