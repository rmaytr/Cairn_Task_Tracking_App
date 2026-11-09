// STUB: replaced by the hub workstream.
import { useStore } from '../store/useStore'
import { TOOLS } from './tools'

export function AdhdHub() {
  const navigate = useStore((s) => s.navigate)
  return (
    <ul>
      {TOOLS.map((t) => (
        <li key={t.id}>
          <button type="button" onClick={() => navigate({ view: 'adhd', tool: t.id })}>
            {t.label}
          </button>
        </li>
      ))}
    </ul>
  )
}
