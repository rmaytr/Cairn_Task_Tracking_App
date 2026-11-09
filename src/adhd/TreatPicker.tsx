import { useEffect, useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import { useStore } from '../store/useStore'
import { rotateTreats } from './unstuck/treats'
import './unstuck/unstuck.css'

export interface TreatPickerProps {
  /** Called when the user picks a treat or skips. */
  onDone: () => void
}

/**
 * "Pick a treat" after a finished block: three choices from the reward menu. They rotate by
 * how many blocks you've done (in menu order, never random), so the whole menu gets a turn.
 */
export function TreatPicker({ onDone }: TreatPickerProps) {
  const treats = useStore((s) => s.prefs.adhd.treats)
  const blocks = useStore((s) => s.prefs.adhd.sessions.length)
  const [picked, setPicked] = useState<string | null>(null)
  const options = rotateTreats(treats, blocks * 3)
  const done = useRef<HTMLButtonElement>(null)

  // The picked button is gone; land on the Done button that replaced it.
  useEffect(() => {
    if (picked) done.current?.focus()
  }, [picked])

  if (picked) {
    return (
      <div className="treatpick" role="status">
        <p className="treatpick__title">Enjoy it: {picked}</p>
        <p className="treatpick__note">Back in 10 minutes? No rush.</p>
        <button type="button" className="btn btn--primary btn--sm" ref={done} onClick={onDone}>
          Done
        </button>
      </div>
    )
  }
  return (
    <div className="treatpick" role="group" aria-label="Pick a treat">
      <p className="treatpick__title">
        <Icon name="gift" size={16} /> You earned a small treat
      </p>
      {options.length === 0 ? (
        <p className="treatpick__note">Your reward menu is empty. You can add treats from the toolkit.</p>
      ) : (
        <ul className="stuck__choices">
          {options.map((t) => (
            <li key={t}>
              <button type="button" className="stuck__choice" onClick={() => setPicked(t)}>
                {t}
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="btn btn--ghost btn--sm" onClick={onDone}>
        Skip
      </button>
    </div>
  )
}
