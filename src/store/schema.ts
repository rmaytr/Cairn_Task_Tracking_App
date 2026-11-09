import { z } from 'zod'
import { DEFAULT_AREAS } from '../model/defaults'
import { AREA_COLORS, HORIZONS, REPEATS, type Area, type Task, type Tombstone } from '../model/types'
import { openProxy } from '../assist/config'
import { TEXT_SIZES, THEME_PREFS } from '../model/themes'

/** Themes used to be just light/dark; those map to Stone and Night. */
const LEGACY_THEMES: Record<string, string> = { light: 'stone', dark: 'night' }

/** Orders the Tasks list offers; 'manual' is "My order" (task.rank). */
export const LIST_SORTS = ['smart', 'due', 'priority', 'manual'] as const

const stepSchema = z.object({ id: z.string(), title: z.string(), done: z.boolean() })

// Loose: an older client must keep fields a newer one added, not strip them and sync that away.
export const taskSchema = z.looseObject({
  id: z.string(),
  title: z.string(),
  notes: z.string().catch(''),
  areaId: z.string(),
  horizon: z.enum(HORIZONS).catch('later'),
  due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().catch(null),
  high: z.boolean().catch(false),
  effort: z.enum(['s', 'm', 'l']).catch('m'),
  waiting: z.string().nullable().catch(null),
  plan: z.string().nullable().catch(null),
  steps: z.array(stepSchema).catch([]),
  done: z.boolean().catch(false),
  doneAt: z.number().nullable().catch(null),
  createdAt: z.number(),
  updatedAt: z.number(),
  spentMinutes: z.number().nonnegative().catch(0),
  repeat: z.enum(REPEATS).optional().catch(undefined),
  repeatOf: z.string().optional().catch(undefined),
  low: z.boolean().optional().catch(undefined),
  after: z.array(z.string()).optional().catch(undefined).transform((ids) => ids?.slice(0, 50)),
  snoozes: z.number().int().nonnegative().optional().catch(undefined),
  repeatAnchor: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  rank: z.number().optional().catch(undefined),
})

export const areaSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.enum(AREA_COLORS).catch('indigo'),
  updatedAt: z.number().optional().catch(undefined),
})

export const tombstoneSchema = z.object({ id: z.string(), kind: z.enum(['task', 'area']), at: z.number() })

export const prefsSchema = z.object({
  theme: z.preprocess((v) => (typeof v === 'string' ? (LEGACY_THEMES[v] ?? v) : v), z.enum(THEME_PREFS)).catch('system'),
  textSize: z.enum(TEXT_SIZES).catch('default'),
  onboarded: z.boolean().catch(false),
  /** Areas used to be hidden by clicking them; nothing can unhide them now, so old values are dropped. */
  hiddenAreas: z.array(z.string()).catch([]).transform((): string[] => []),
  lastResetAt: z.number().nullable().catch(null),
  /** Single-key shortcuts can be switched off (WCAG 2.1.4). */
  shortcuts: z.boolean().catch(true),
  /** One-time hints the user has dismissed. */
  seenTips: z.array(z.string()).catch([]),
  /** Deadline reminders: system notifications (if permitted) at these local hours. */
  reminders: z
    .object({ enabled: z.boolean(), morningHour: z.number().int().min(0).max(23), eveningHour: z.number().int().min(0).max(23) })
    .catch({ enabled: true, morningHour: 9, eveningHour: 18 }),
  /** Reminder keys already shown, so each fires once. */
  firedReminders: z.array(z.string()).catch([]).transform((keys) => keys.slice(-1000)),
  /** AI assistant: off, the shared proxy, or the user's own API key (stored separately, never synced). */
  ai: z.enum(['off', 'proxy', 'byok']).catch(openProxy ? 'proxy' : 'off'),
  /** Finishing feedback: a soft tock sound (off by default) and a short haptic tick. */
  feedback: z.object({ sound: z.boolean(), haptics: z.boolean() }).catch({ sound: false, haptics: true }),
  /** "Plan my day" order from the assistant, used on the day it was made. */
  dayPlan: z
    .object({ date: z.string(), ids: z.array(z.string()).max(200), summary: z.string().max(300) })
    .nullable()
    .catch(null),
  /** Sort of the Tasks list, kept across navigation and reloads. */
  listSort: z
    .object({ sort: z.enum(LIST_SORTS), reverse: z.boolean() })
    .catch({ sort: 'smart', reverse: false }),
})

export type Prefs = z.infer<typeof prefsSchema>

export const DEFAULT_PREFS: Prefs = {
  theme: 'system',
  textSize: 'default',
  onboarded: false,
  hiddenAreas: [],
  lastResetAt: null,
  shortcuts: true,
  seenTips: [],
  reminders: { enabled: true, morningHour: 9, eveningHour: 18 },
  firedReminders: [],
  ai: openProxy ? 'proxy' : 'off',
  feedback: { sound: false, haptics: true },
  dayPlan: null,
  listSort: { sort: 'smart', reverse: false },
}

export interface PersistedState {
  areas: Area[]
  tasks: Task[]
  /** Deletions remembered for sync merges. */
  tombstones: Tombstone[]
  prefs: Prefs
}

/**
 * Validates whatever came out of IndexedDB. Bad tasks are dropped individually so a
 * single corrupt record never wipes the rest; tasks pointing at a missing area are
 * re-homed to the first area.
 */
export function sanitizePersisted(raw: unknown): PersistedState {
  const obj = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const areas = parseList(obj.areas, areaSchema)
  const safeAreas = areas.length > 0 ? areas : DEFAULT_AREAS.map((a) => ({ ...a }))
  const areaIds = new Set(safeAreas.map((a) => a.id))
  const tasks = parseList(obj.tasks, taskSchema).map((t) =>
    areaIds.has(t.areaId) ? t : { ...t, areaId: safeAreas[0].id },
  )
  const prefs = prefsSchema.safeParse(obj.prefs)
  const tombstones = parseList(obj.tombstones, tombstoneSchema)
  return { areas: safeAreas, tasks, tombstones, prefs: prefs.success ? prefs.data : DEFAULT_PREFS }
}

function parseList<T>(value: unknown, schema: z.ZodType<T>): T[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const parsed = schema.safeParse(item)
    return parsed.success ? [parsed.data] : []
  })
}
