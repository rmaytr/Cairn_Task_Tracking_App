import { useMemo, type ReactNode } from 'react'
import { useNow } from '../../hooks'
import { doneThisWeek } from '../../model/derive'
import { useStore } from '../../store/useStore'
import { guessRatio } from '../calibration'
import { soundComparison } from '../stats'
import { BAND_LABEL, bestTime, formatMinutes, guessLine, MIN_BLOCKS, soundVerdict, weekFocus } from './patterns'

const blocks = (n: number): string => `${n} ${n === 1 ? 'block' : 'blocks'}`

function Tile({ label, value, children, quiet = false }: { label: string; value: string; children: ReactNode; quiet?: boolean }) {
  return (
    <div className="pattern">
      <dt>{label}</dt>
      <dd className={`pattern__value num${quiet ? ' is-quiet' : ''}`}>{value}</dd>
      <dd className="pattern__sub">{children}</dd>
    </div>
  )
}

const SOUND_VALUE = { sound: 'With sound', silent: 'In silence', same: 'About even' } as const

/** What your own blocks say, worked out on this device. Renders nothing until there is data. */
export function YourPatterns() {
  const sessions = useStore((s) => s.prefs.adhd.sessions)
  const tasks = useStore((s) => s.tasks)
  const now = useNow()
  const p = useMemo(() => {
    const cmp = soundComparison(sessions)
    return {
      week: weekFocus(sessions, now),
      done: doneThisWeek(tasks, now),
      time: bestTime(sessions),
      ratio: guessRatio(sessions),
      cmp,
      sound: soundVerdict(cmp),
    }
  }, [sessions, tasks, now])

  const hasBlocks = p.time.n > 0
  if (!hasBlocks && p.done === 0) return null
  const { week, done, time, ratio, cmp, sound } = p

  return (
    <section className="panel hub__patterns" aria-labelledby="patterns-h">
      <div className="hub__panel-head">
        <h2 id="patterns-h">Your patterns</h2>
        <span className="hub__panel-note">Worked out on this device</span>
      </div>
      <dl className="patterns">
        {hasBlocks && (
          <Tile label="Focused this week" value={formatMinutes(week.minutes)} quiet={week.blocks === 0}>
            {week.blocks === 0 ? 'No blocks yet this week' : `Based on ${blocks(week.blocks)}`}
          </Tile>
        )}
        <Tile label="Finished this week" value={String(done)} quiet={done === 0}>
          {done === 1 ? 'task since Monday' : 'tasks since Monday'}
        </Tile>
        {hasBlocks && (
          <Tile label="Best time to focus" value={time.best ? BAND_LABEL[time.best.band] : 'Early days'} quiet={!time.best}>
            {time.best
              ? `${time.best.by === 'rating' ? 'Highest focus rating' : 'Most minutes'}, based on ${blocks(time.best.n)}`
              : `Based on ${blocks(time.n)}. A pattern shows after ${MIN_BLOCKS}.`}
          </Tile>
        )}
        {ratio && (
          <Tile label="Your guesses" value={`${ratio.ratio}×`}>
            {guessLine(ratio.ratio)} Based on {blocks(ratio.n)}.
          </Tile>
        )}
        {sound && cmp.withSound && cmp.silent && (
          <Tile label="You focus best" value={SOUND_VALUE[sound]}>
            Focus {cmp.withSound.mean}/5 with sound, {cmp.silent.mean}/5 without. Based on {blocks(cmp.withSound.n + cmp.silent.n)}.
          </Tile>
        )}
      </dl>
    </section>
  )
}
