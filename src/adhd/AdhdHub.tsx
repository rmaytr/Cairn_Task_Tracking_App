import { Icon, type IconName } from '../components/Icon'
import { useNow } from '../hooks'
import { useStore } from '../store/useStore'
import { FactCard } from './learn/FactCard'
import { factOfDay } from './learn/facts'
import { ToolCards } from './learn/ToolCards'
import { useOpenTool } from './learn/useOpenTool'
import { YourPatterns } from './learn/YourPatterns'
import type { AdhdTool } from './types'

/** "Right now I need to…": the feeling first, the tool second. */
const INTENTS: readonly { label: string; icon: IconName; tool: AdhdTool }[] = [
  { label: 'Start something', icon: 'play', tool: 'room' },
  { label: 'Get unstuck', icon: 'lifebuoy', tool: 'unstuck' },
  { label: 'Quiet my head', icon: 'headphones', tool: 'sounds' },
  { label: 'Take a break', icon: 'walk', tool: 'move' },
  { label: 'Reward myself', icon: 'gift', tool: 'treats' },
]

function TodaysCard() {
  const navigate = useStore((s) => s.navigate)
  const fact = factOfDay(useNow())
  return (
    <section className="panel hub__card" aria-labelledby="card-h">
      <div className="hub__panel-head">
        <h2 id="card-h">Today’s card</h2>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => navigate({ view: 'adhd', tool: 'learn' })}>
          More in What works <Icon name="arrowRight" size={14} />
        </button>
      </div>
      <FactCard fact={fact} />
    </section>
  )
}

/** #adhd: tools for the moment itself, a card from the research, and what your own blocks say. */
export function AdhdHub() {
  const openTool = useOpenTool()
  return (
    <div className="hub">
      <header className="hub__head">
        <h1 id="adhd-title" className="hub__title display">
          ADHD toolkit
        </h1>
        <p className="hub__lede">Tools for the moments a list can’t help with: starting, staying, sensing time.</p>
      </header>

      <div className="hub__now" role="group" aria-labelledby="now-label">
        <span id="now-label" className="hub__now-label">
          Right now I need to…
        </span>
        <ul className="hub__intents">
          {INTENTS.map((i) => (
            <li key={i.label}>
              <button type="button" className="intent" onClick={() => openTool(i.tool)}>
                <Icon name={i.icon} size={16} /> {i.label}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <ToolCards />

      <div className="hub__more">
        <TodaysCard />
        <YourPatterns />
      </div>

      <p className="hub__foot">Cairn isn’t medical advice. Everyone’s ADHD is different; keep what helps you.</p>
    </div>
  )
}
