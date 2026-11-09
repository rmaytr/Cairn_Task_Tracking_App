import { useCallback } from 'react'
import { parseCapture } from '../lib/capture'
import { resolveArea } from '../lib/classify'
import { horizonForDue } from '../lib/dates'
import type { Area, Effort, Repeat } from '../model/types'
import { useStore, type DraftWithArea } from '../store/useStore'
import { enrichWithAssistant } from './enrich'

export interface CapturePreview {
  title: string
  areaId: string
  guessed: boolean
  due: string | null
  high: boolean
  repeat?: Repeat
  effort?: Effort
}

/** What a typed line will become, without saving it (for the live preview under the input). */
export function previewCapture(text: string, forcedAreaId: string | null, areas: Area[]): CapturePreview | null {
  if (!text.trim()) return null
  const { draft } = parseCapture(text, areas, new Date())
  const resolved = resolveArea(draft.area, draft.title, areas)
  const areaId = forcedAreaId && areas.some((a) => a.id === forcedAreaId) ? forcedAreaId : resolved.areaId
  return {
    title: draft.title,
    areaId,
    guessed: !forcedAreaId && resolved.guessed,
    due: draft.due ?? null,
    high: Boolean(draft.high),
    ...(draft.repeat && { repeat: draft.repeat }),
    ...(draft.effort && { effort: draft.effort }),
  }
}

/** Parses brain-dump lines into drafts for `addTasks`, placed like a single capture would be; `text` is the line. */
export function captureItems(
  lines: string[],
  forcedAreaId: string | null,
  areas: Area[],
  now: Date,
): (DraftWithArea & { text: string })[] {
  return lines.flatMap((line) => {
    const preview = previewCapture(line, forcedAreaId, areas)
    if (!preview || !preview.title.trim()) return []
    const { draft } = parseCapture(line, areas, now)
    // addTasks falls back to "later" (right for imports); a capture without a date is for this week.
    const horizon = draft.horizon ?? horizonForDue(draft.due ?? null, now) ?? 'week'
    return [{ draft: { ...draft, area: undefined, horizon }, areaId: preview.areaId, text: line }]
  })
}

/**
 * One way to add a task everywhere: parse the line locally (area, date, priority), save it
 * immediately, then — if the assistant is on — let it fill in steps, dates and order in the
 * background. Capture never asks the user a question.
 */
export function useAddTask(): (text: string, forcedAreaId?: string | null) => string | null {
  const addTask = useStore((s) => s.addTask)
  return useCallback(
    (text: string, forcedAreaId: string | null = null) => {
      const { areas } = useStore.getState()
      const preview = previewCapture(text, forcedAreaId, areas)
      if (!preview || !preview.title.trim()) return null
      const { draft } = parseCapture(text, areas, new Date())
      const id = addTask({ ...draft, area: undefined }, preview.areaId, 'week')
      void enrichWithAssistant(id, text, forcedAreaId !== null)
      return id
    },
    [addTask],
  )
}

/** One at a time, so a long dump doesn't fire a burst of assistant requests. */
/** The shared beta proxy allows ~150 requests a day per visitor, so one paste can't spend it all. */
export const MAX_DUMP_SORTS = 12

async function enrichInOrder(items: { id: string; text: string }[], areaLocked: boolean): Promise<void> {
  // Lines past the cap keep their local parse (area, date, priority); they just aren't AI-sorted.
  for (const { id, text } of items.slice(0, MAX_DUMP_SORTS)) {
    // One error toast is enough: after a failure (offline, daily limit) the rest keep their local parse.
    if (!(await enrichWithAssistant(id, text, areaLocked))) return
  }
}

/**
 * Adds a brain dump (one task per line) with one Undo ("Added N tasks"), then lets the
 * assistant, if on, sort each one. Returns the new ids in line order.
 */
export function useAddTasks(): (lines: string[], forcedAreaId?: string | null) => string[] {
  const addTasks = useStore((s) => s.addTasks)
  return useCallback(
    (lines: string[], forcedAreaId: string | null = null) => {
      const { areas } = useStore.getState()
      const items = captureItems(lines, forcedAreaId, areas, new Date())
      if (items.length === 0) return []
      const count = addTasks(items.map(({ draft, areaId }) => ({ draft, areaId })))
      // addTasks appends in order, so the new tasks are the last `count`.
      const ids = useStore.getState().tasks.slice(-count).map((t) => t.id)
      void enrichInOrder(ids.map((id, i) => ({ id, text: items[i]?.text ?? '' })), forcedAreaId !== null)
      return ids
    },
    [addTasks],
  )
}
