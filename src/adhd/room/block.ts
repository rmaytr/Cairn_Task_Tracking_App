/**
 * What the Focus room knows about the current block beyond the store's timer: your guess, the
 * first length (for the exit ramp), the steps done before it, and thoughts parked during it.
 * Kept in memory only, like the timer, so leaving the room and coming back picks it up again.
 */
import { create } from 'zustand'
import { parseCapture } from '../../lib/capture'
import { previewCapture } from '../../assist/useAddTask'
import { workedMinutes } from '../../model/timer'
import type { Task } from '../../model/types'
import { useStore } from '../../store/useStore'
import { currentSound } from '../sound/noise'

const MIN = 60_000
/** Session titles are capped like the schema caps them. */
const MAX_TITLE = 200

export interface Parked {
  id: string
  title: string
}

export interface Block {
  taskId: string
  guessMin: number | null
  /** Minutes the block was started with, before any "+5 min". */
  startMin: number
  /** Epoch ms the block started. */
  at: number
  /** Steps already done when it started, so the summary counts only this block's. */
  stepsDone: number
  parked: Parked[]
  /** "Keep going" on the exit ramp: don't ask again this block. */
  rampDismissed: boolean
  /** The last "N min left" notice already given (so a remount doesn't repeat it). */
  nudged: number | null
  /** Started in the room (not picked up from a Lock in timer), so it is logged even if ended elsewhere. */
  fromRoom: boolean
}

export interface Ended {
  taskId: string
  title: string
  minutes: number
  guessMin: number | null
  stepsDone: number
  /** The logged session, to rate; null when the block was too short to count. */
  sessionId: string | null
  /** Came from "Take a break": open the movement break straight away. */
  moveFirst: boolean
}

interface RoomState {
  block: Block | null
  ended: Ended | null
}

export const useRoom = create<RoomState>(() => ({ block: null, ended: null }))

const doneSteps = (task: Task | undefined): number => task?.steps.filter((s) => s.done).length ?? 0

/** Starts a block on `taskId` with the store timer, remembering the guess. */
export function beginBlock(taskId: string, minutes: number, guessMin: number | null, now = Date.now()): void {
  const { tasks, startFocusTimer } = useStore.getState()
  startFocusTimer(taskId, minutes, now)
  const block: Block = {
    taskId,
    guessMin,
    startMin: minutes,
    at: now,
    stepsDone: doneSteps(tasks.find((t) => t.id === taskId)),
    parked: [],
    rampDismissed: false,
    nudged: null,
    fromRoom: true,
  }
  useRoom.setState({ block, ended: null })
}

/** The block for the running timer; a timer started elsewhere (Lock in) gets one made up from it. */
export function ensureBlock(now = Date.now()): Block | null {
  const running = useStore.getState().focusTimer
  if (!running) return null
  const current = useRoom.getState().block
  if (current?.taskId === running.taskId) return current
  const task = useStore.getState().tasks.find((t) => t.id === running.taskId)
  const block: Block = {
    taskId: running.taskId,
    guessMin: null,
    startMin: running.timer.durationMs / MIN,
    at: now - workedMinutes(running.timer, now) * MIN,
    stepsDone: doneSteps(task),
    parked: [],
    rampDismissed: false,
    nudged: null,
    fromRoom: false,
  }
  useRoom.setState({ block })
  return block
}

export const patchBlock = (patch: Partial<Block>): void =>
  useRoom.setState((s) => (s.block ? { block: { ...s.block, ...patch } } : s))

/**
 * Parks an intruding thought as a task for Later (parsed like any capture: area, date,
 * priority), without leaving the room. Returns the new task's id.
 */
export function parkThought(text: string): string | null {
  const { areas, addTask } = useStore.getState()
  const preview = previewCapture(text, null, areas)
  if (!preview || !preview.title.trim()) return null
  const { draft } = parseCapture(text, areas, new Date())
  const id = addTask({ ...draft, area: undefined }, preview.areaId, 'later')
  const block = ensureBlock()
  if (block) patchBlock({ parked: [...block.parked, { id, title: preview.title }] })
  return id
}

type Running = NonNullable<ReturnType<typeof useStore.getState>['focusTimer']>

/** Logs a block of a minute or more (rating null) and returns its session id. */
function logBlock(running: Running, block: Block | null, title: string, now: number): string | null {
  const { prefs, logSession } = useStore.getState()
  const minutes = workedMinutes(running.timer, now)
  if (minutes < 1) return null
  return logSession({
    taskId: running.taskId,
    title: title.slice(0, MAX_TITLE),
    at: block?.at ?? now - minutes * MIN,
    guessMin: block?.guessMin ?? null,
    actualMin: minutes,
    sound: currentSound(),
    companion: prefs.adhd.companion,
    rating: null,
  })
}

/**
 * Ends the block: logs it (worked minutes read before the timer is cleared), then ends the
 * store timer once, which credits the task's spent minutes. Blocks under a minute aren't logged.
 */
export function finishBlock(options: { moveFirst?: boolean } = {}, now = Date.now()): void {
  const { focusTimer, tasks, endFocusTimer } = useStore.getState()
  if (!focusTimer) return
  const block = ensureBlock(now)
  const task = tasks.find((t) => t.id === focusTimer.taskId)
  const title = task?.title ?? 'your task'
  const minutes = workedMinutes(focusTimer.timer, now)
  const guessMin = block?.guessMin ?? null
  const sessionId = logBlock(focusTimer, block, title, now)
  // Clear the block first so the timer-ended listener below doesn't log it a second time.
  useRoom.setState({ block: null })
  endFocusTimer(now)
  const stepsDone = Math.max(0, doneSteps(task) - (block?.stepsDone ?? doneSteps(task)))
  useRoom.setState({
    block: null,
    ended: { taskId: focusTimer.taskId, title, minutes, guessMin, stepsDone, sessionId, moveFirst: Boolean(options.moveFirst) },
  })
}

// A timer ended anywhere else (Lock in, the timer bar, completing or deleting the task) ends the
// block too, so a later block on the same task doesn't reuse its guess, start or parked list.
// A block started here still gets logged; a deleted (or wiped) task's doesn't.
useStore.subscribe((s, prev) => {
  if (!prev.focusTimer || s.focusTimer) return
  const block = useRoom.getState().block
  if (!block) return
  useRoom.setState({ block: null })
  const task = s.tasks.find((t) => t.id === prev.focusTimer?.taskId)
  if (block.fromRoom && block.taskId === prev.focusTimer.taskId && task) logBlock(prev.focusTimer, block, task.title, Date.now())
})
