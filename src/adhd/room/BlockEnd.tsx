import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { useStore } from '../../store/useStore'
import { MovementSnack } from '../MovementSnack'
import { TreatPicker } from '../TreatPicker'
import type { Ended } from './block'
import { guessText, summaryText } from './logic'

const RATINGS = [
  { value: 1, label: 'Scattered' },
  { value: 2, label: 'Drifty' },
  { value: 3, label: 'Okay' },
  { value: 4, label: 'Focused' },
  { value: 5, label: 'Locked in' },
] as const

interface BlockEndProps {
  ended: Ended
  onAnother: () => void
  onDoneForNow: () => void
}

/** After a block: what you did, how it compared with your guess, how focus felt, a treat and a break. */
export function BlockEnd({ ended, onAnother, onDoneForNow }: BlockEndProps) {
  const rateSession = useStore((s) => s.rateSession)
  const setDone = useStore((s) => s.setDone)
  const rating = useStore((s) => s.prefs.adhd.sessions.find((x) => x.id === ended.sessionId)?.rating ?? null)
  const taskOpen = useStore((s) => s.tasks.some((t) => t.id === ended.taskId && !t.done))
  const [treat, setTreat] = useState(true)
  const [move, setMove] = useState(ended.moveFirst)
  const heading = useRef<HTMLHeadingElement>(null)
  const counted = ended.sessionId !== null
  const compare = counted ? guessText(ended.guessMin, ended.minutes) : null

  // The screen changed under the button that was pressed; move focus to what it says now.
  useEffect(() => {
    heading.current?.focus()
  }, [])

  return (
    <div className="room-end">
      <h2 className="room-end__title display" ref={heading} tabIndex={-1}>
        {counted ? summaryText(ended.minutes, ended.title, ended.stepsDone) : 'That one was too short to count. That’s fine.'}
      </h2>
      {compare && <p className="room-end__compare">{compare}</p>}

      {counted && (
        <fieldset className="room-rate">
          <legend className="room-panel__title">How was your focus?</legend>
          <div className="room-rate__opts">
            {RATINGS.map((r) => (
              <label key={r.value} className="room-rate__opt">
                <input
                  type="radio"
                  name="focus-rating"
                  className="visually-hidden"
                  value={r.value}
                  checked={rating === r.value}
                  onChange={() => ended.sessionId && rateSession(ended.sessionId, r.value)}
                />
                <span className="num" aria-hidden="true">
                  {r.value}
                </span>
                {r.label}
              </label>
            ))}
          </div>
          <p className="room-panel__hint">{rating === null ? 'Optional. It helps Cairn learn what works for you.' : 'Thanks. Saved.'}</p>
        </fieldset>
      )}

      <div className="room-end__extras">
        <section className="room-panel" aria-labelledby="treat-h">
          <h3 className="room-panel__title" id="treat-h">
            <Icon name="gift" size={16} /> A small treat
          </h3>
          {treat ? <TreatPicker onDone={() => setTreat(false)} /> : <p className="room-panel__hint">Enjoy it.</p>}
        </section>
        <section className="room-panel" aria-labelledby="move-h">
          <h3 className="room-panel__title" id="move-h">
            <Icon name="walk" size={16} /> Move break
          </h3>
          {move ? (
            <MovementSnack onDone={() => setMove(false)} />
          ) : (
            <button type="button" className="btn" onClick={() => setMove(true)}>
              Ninety seconds of moving
            </button>
          )}
        </section>
      </div>

      <div className="room-end__actions">
        <button type="button" className="btn btn--primary btn--lg" onClick={onAnother}>
          <Icon name="play" size={18} /> Another block
        </button>
        <button type="button" className="btn btn--lg" onClick={onDoneForNow}>
          Done for now
        </button>
        {taskOpen && (
          <button type="button" className="btn btn--ghost btn--lg" onClick={() => setDone(ended.taskId, true)}>
            <Icon name="check" size={18} /> Mark “{ended.title}” done
          </button>
        )}
      </div>
    </div>
  )
}
