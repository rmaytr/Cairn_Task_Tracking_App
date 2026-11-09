/** The ~90 second move break: six short moves. */

export interface Move {
  id: 'shoulders' | 'reach' | 'march' | 'neck' | 'hands' | 'breath'
  title: string
  how: string
  seated: string
  seconds: number
}

export const MOVES: readonly Move[] = [
  { id: 'shoulders', title: 'Shoulder rolls', how: 'Roll both shoulders up, back and down, slowly.', seated: 'Same, sitting tall.', seconds: 15 },
  { id: 'reach', title: 'Reach up', how: 'Stand and reach both hands to the ceiling. Breathe in.', seated: 'Reach up from your chair.', seconds: 15 },
  { id: 'march', title: 'March in place', how: 'Lift your knees and swing your arms.', seated: 'Tap your heels and swing your arms.', seconds: 15 },
  { id: 'neck', title: 'Neck side stretch', how: 'Tilt your ear toward one shoulder, then the other.', seated: 'Same, sitting. Keep your shoulders low.', seconds: 15 },
  { id: 'hands', title: 'Shake out your hands', how: 'Let your hands go loose and shake them out.', seated: 'Same, sitting.', seconds: 10 },
  { id: 'breath', title: 'Five slow breaths', how: 'In through the nose for four, out for six.', seated: 'Same, sitting.', seconds: 20 },
]

/** Shown while the next move is about to start. */
export const totalSeconds = (moves: readonly Move[] = MOVES): number => moves.reduce((n, m) => n + m.seconds, 0)
