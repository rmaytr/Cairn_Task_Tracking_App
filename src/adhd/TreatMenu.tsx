import { useState } from 'react'
import { Icon } from '../components/Icon'
import { useStore } from '../store/useStore'
import { MAX_TREAT_LENGTH, MAX_TREATS } from './types'
import { addTreat, moveTreat, removeTreat, renameTreat, resetTreats } from './unstuck/treats'
import './unstuck/unstuck.css'

interface RowProps {
  text: string
  index: number
  last: boolean
  onRename: (text: string) => void
  onMove: (by: -1 | 1) => void
  onRemove: () => void
}

function TreatRow({ text, index, last, onRename, onMove, onRemove }: RowProps) {
  const [draft, setDraft] = useState(text)
  const [seen, setSeen] = useState(text)
  if (text !== seen) {
    setSeen(text)
    setDraft(text)
  }
  const commit = (): void => (draft.trim() ? onRename(draft) : setDraft(text))
  return (
    <li className="treats__row">
      <input
        className="field"
        aria-label={`Treat ${index + 1}`}
        value={draft}
        maxLength={MAX_TREAT_LENGTH}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
      <button type="button" className="icon-btn" aria-label={`Move “${text}” up`} disabled={index === 0} onClick={() => onMove(-1)}>
        <Icon name="arrowUp" size={16} />
      </button>
      <button type="button" className="icon-btn" aria-label={`Move “${text}” down`} disabled={last} onClick={() => onMove(1)}>
        <Icon name="arrowDown" size={16} />
      </button>
      <button type="button" className="icon-btn" aria-label={`Remove “${text}”`} onClick={onRemove}>
        <Icon name="trash" size={16} />
      </button>
    </li>
  )
}

/** #adhd/treats: the user's own list of small rewards, offered after a Focus room block. */
export function TreatMenu() {
  const treats = useStore((s) => s.prefs.adhd.treats)
  const setAdhd = useStore((s) => s.setAdhd)
  const [text, setText] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)
  const full = treats.length >= MAX_TREATS
  const set = (next: string[]): void => setAdhd({ treats: next })

  return (
    <div className="treats">
      <p className="stuck__lede">
        Waiting for a reward is often harder with ADHD, so small rewards soon after the effort may be easier to work for.
        <small className="stuck__src"> Marx et al. 2021</small>
      </p>
      <form
        className="stuck__form"
        onSubmit={(e) => {
          e.preventDefault()
          set(addTreat(treats, text))
          setText('')
        }}
      >
        <input
          className="field"
          aria-label="New treat"
          placeholder={full ? 'Your menu is full' : 'Add a treat'}
          value={text}
          maxLength={MAX_TREAT_LENGTH}
          disabled={full}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className="btn" disabled={full || !text.trim()}>
          <Icon name="plus" size={16} /> Add
        </button>
      </form>
      {treats.length === 0 && <p className="stuck__tip">Your menu is empty. Add one above, or reset to the starter list.</p>}
      <ul className="treats__list" aria-label="Your treats">
        {treats.map((t, i) => (
          <TreatRow
            key={`${i}-${t}`}
            text={t}
            index={i}
            last={i === treats.length - 1}
            onRename={(v) => set(renameTreat(treats, i, v))}
            onMove={(by) => set(moveTreat(treats, i, by))}
            onRemove={() => set(removeTreat(treats, i))}
          />
        ))}
      </ul>
      <p className="stuck__tip num">
        {treats.length} of {MAX_TREATS}
      </p>
      {confirmReset ? (
        <div className="stuck__row" role="alert">
          <span>Replace your list with the starter treats?</span>
          <button type="button" className="btn btn--danger btn--sm" onClick={() => { set(resetTreats()); setConfirmReset(false) }}>
            Yes, reset
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirmReset(false)}>
            Keep mine
          </button>
        </div>
      ) : (
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirmReset(true)}>
          Reset to defaults
        </button>
      )}
    </div>
  )
}
