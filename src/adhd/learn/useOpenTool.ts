import { useStore } from '../../store/useStore'
import type { AdhdTool } from '../types'

/** Opens a toolkit page; the Focus room opens fresh, without a task carried over from last time. */
export function useOpenTool(): (tool: AdhdTool) => void {
  const navigate = useStore((s) => s.navigate)
  const openRoom = useStore((s) => s.openRoom)
  return (tool) => (tool === 'room' ? openRoom(null) : navigate({ view: 'adhd', tool }))
}
