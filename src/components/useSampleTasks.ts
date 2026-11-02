import { parseImport } from '../lib/import'
import { SAMPLE_TEXT } from '../model/defaults'
import { useStore } from '../store/useStore'
import { planImport } from './importPlan'

/** Adds the sample tasks (dates relative to today) as one undoable change. */
export function useLoadSample(): () => void {
  const addTasks = useStore((s) => s.addTasks)
  const areas = useStore((s) => s.areas)
  return () => {
    const { drafts } = parseImport(SAMPLE_TEXT, new Date())
    const { rows, newAreas } = planImport(drafts, areas)
    addTasks(rows.map((r) => ({ draft: r.draft, areaId: r.areaId })), { newAreas })
  }
}
