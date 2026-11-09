import type { Task } from '../model/types'
import { localPlan, type ListOrder, type LockInPlan } from '../plan/lockin'

/** Open tasks in Lock in's "up next" order, with the plan behind it. */
export function upNext(tasks: readonly Task[], now: Date, order?: ListOrder): { plan: LockInPlan; ordered: Task[] } {
  const open = tasks.filter((t) => !t.done)
  const plan = localPlan(open, now, order)
  const ordered = plan.ids.map((id) => open.find((t) => t.id === id)).filter((t): t is Task => t !== undefined)
  return { plan, ordered }
}
