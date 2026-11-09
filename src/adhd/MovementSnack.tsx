// STUB: replaced by the Unstuck workstream.
export interface MovementSnackProps {
  /** Called when the break ends or is skipped. */
  onDone: () => void
}

/** A ~90 second guided movement break. */
export function MovementSnack({ onDone }: MovementSnackProps) {
  return (
    <button type="button" className="btn" onClick={onDone}>
      Done
    </button>
  )
}
