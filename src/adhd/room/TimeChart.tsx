import type { FocusSession } from '../types'

const SHOWN = 12
const BAR = 10
const GAP = 3
const PAIR = BAR * 2 + GAP + 14
const HEIGHT = 120

const day = (at: number): string => new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

/** Recent guessed blocks as paired bars (guess outlined, actual filled), with the same numbers as a table. */
export function TimeChart({ sessions }: { sessions: readonly FocusSession[] }) {
  const rows = sessions.filter((s) => s.guessMin !== null && s.actualMin >= 1).slice(-SHOWN)
  if (rows.length === 0) return null
  const max = Math.max(...rows.flatMap((s) => [s.guessMin ?? 0, s.actualMin]))
  const h = (min: number): number => Math.max(2, (min / max) * (HEIGHT - 4))
  const over = rows.filter((s) => s.actualMin > (s.guessMin ?? 0)).length

  return (
    <figure className="ts-chart">
      <svg
        className="ts-chart__svg"
        viewBox={`0 0 ${rows.length * PAIR} ${HEIGHT}`}
        role="img"
        aria-label={`Your last ${rows.length} guessed blocks: ${over} took longer than the guess. The table below has the numbers.`}
      >
        {rows.map((s, i) => {
          const x = i * PAIR + 7
          const guess = s.guessMin ?? 0
          return (
            <g key={s.id}>
              <title>{`${s.title}: guessed ${guess} min, took ${s.actualMin} min`}</title>
              <rect className="ts-chart__guess" x={x} y={HEIGHT - h(guess)} width={BAR} height={h(guess)} rx="2" />
              <rect className="ts-chart__actual" x={x + BAR + GAP} y={HEIGHT - h(s.actualMin)} width={BAR} height={h(s.actualMin)} rx="2" />
            </g>
          )
        })}
      </svg>
      <figcaption className="ts-chart__legend">
        <span>
          <i className="ts-chart__key ts-chart__key--guess" aria-hidden="true" /> Your guess
        </span>
        <span>
          <i className="ts-chart__key ts-chart__key--actual" aria-hidden="true" /> What it took
        </span>
        <span className="ts-chart__note">Oldest on the left</span>
      </figcaption>
      <details className="ts-chart__table">
        <summary>Show as a table</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col">Task</th>
              <th scope="col">Guess</th>
              <th scope="col">Took</th>
            </tr>
          </thead>
          <tbody>
            {[...rows].reverse().map((s) => (
              <tr key={s.id}>
                <td>{day(s.at)}</td>
                <td>{s.title}</td>
                <td className="num">{s.guessMin} min</td>
                <td className="num">{s.actualMin} min</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}
