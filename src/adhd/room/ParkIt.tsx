import { useState } from 'react'
import { Icon } from '../../components/Icon'
import { parkThought, type Parked } from './block'

/**
 * "Park it": write down a thought that pops up and keep going. It becomes a task for Later.
 * Writing a plan for an open loop quiets it (Masicampo & Baumeister, 2011).
 */
export function ParkIt({ parked }: { parked: readonly Parked[] }) {
  const [text, setText] = useState('')
  const last = parked.at(-1)

  return (
    <div className="room-park">
      <h2 className="room-panel__title" id="park-h">
        Park it
      </h2>
      <p className="room-panel__hint">Something popped into your head? Write it here and get back to it. It goes to Later.</p>
      <form
        className="room-park__form"
        onSubmit={(e) => {
          e.preventDefault()
          if (parkThought(text)) setText('')
        }}
      >
        <input
          className="field"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. reply to Sam"
          aria-labelledby="park-h"
          maxLength={300}
          enterKeyHint="done"
        />
        <button type="submit" className="btn" disabled={!text.trim()}>
          Park
        </button>
      </form>
      {parked.length > 0 && (
        <ul className="room-park__list" aria-label="Parked this block">
          {parked.map((p) => (
            <li key={p.id}>
              <Icon name="check" size={14} /> {p.title}
            </li>
          ))}
        </ul>
      )}
      <p className="room-panel__hint" aria-live="polite">
        {last ? `Parked “${last.title}” in Later. You can deal with these later.` : ''}
      </p>
    </div>
  )
}
