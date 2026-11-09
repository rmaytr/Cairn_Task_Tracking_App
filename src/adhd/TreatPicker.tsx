// STUB: replaced by the Unstuck workstream.
export interface TreatPickerProps {
  /** Called when the user picks a treat or skips. */
  onDone: () => void
}

/** "Pick a treat" after a finished block: a few choices from the reward menu. */
export function TreatPicker({ onDone }: TreatPickerProps) {
  return (
    <button type="button" className="btn" onClick={onDone}>
      Done
    </button>
  )
}
