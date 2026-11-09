# Cairn v3: themes, brain dump, drag, palette, ADHD helpers

Date: 2026-11-09. Owner: Rodion. Status: shipped on branch v3-features.

## What shipped

- Seven themes (Stone, Notes, Moss, Contrast, Night, Dusk, Ink), a Match system default, and text sizes.
- Brain-dump capture: multi-line capture box, list preview with a per-line ×, Split suggestion,
  near-duplicate hint, repeat and effort words. The AI sorter handles up to 12 lines per paste.
- Drag to reorder with a persistent "My order" sort, drag between "when" groups on area pages,
  Alt+↑/↓, Move up/down in the task menu, and drag reorder for steps.
- Command palette (⌘K / Ctrl+K) that guesses intent, with Undo, and a "?" shortcuts sheet.
- Lock-in timer (5, 15 or 25 minutes) that survives navigation and credits time to the task.
  Quick wins and Big push filters for Lock in start.
- Home "Fresh start" for overdue tasks and a "Done today" list.
- Optional finish sound and haptics, set in Settings.
- "Snoozed 3 times" nudge that offers "Make it smaller".

## Why

Cairn already does capture, one next step (Lock in), reminders and an AI sorter. Walking the app
next to Things 3, Todoist, TickTick, Apple Notes, Tiimo, Goblin.tools, Sunsama, Amazing Marvin,
Llama Life and Linear showed five gaps that matter most for people who get overwhelmed:

1. It looks one way. People who live in an app want it to feel like theirs (Notes' warm paper,
   a dark plum for evenings, a plain high-contrast mode).
2. Capture is one line at a time. A brain dump (paste a list, or type a messy paragraph) is the
   moment ADHD users most need the app, and it is the one we handle worst.
3. Rows can be dropped on the sidebar but not reordered, moved between "when" groups, or dragged
   on a phone.
4. The app doesn't guess. ⌘K only finds tasks; typing "call mom tomorrow" or "done laundry" there
   should just do it.
5. Time blindness and overdue guilt: no timer in Lock in, no "fresh start" for a pile of overdue
   tasks, no record of what you did today, no small reward for finishing.

## What we're building (five parallel workstreams)

| # | Workstream | Model | Main files (owner) |
|---|------------|-------|--------------------|
| 1 | Themes and appearance | Opus | `src/themes.css` (new), `index.css` tokens, `appEffects.useTheme`, Settings → Appearance |
| 2 | Brain-dump capture and smart guessing | Opus | `Capture.tsx/.css`, `lib/brainDump.ts` (new), `assist/useAddTask.ts`, `lib/capture.ts` |
| 3 | Drag and drop everywhere | Opus | `ListView`, `TaskRow`, `StepList`, `lib/reorder.ts` (new), task `rank` |
| 4 | Command palette that guesses intent | Sonnet | `QuickFind` → palette, `lib/intent.ts` (new), shortcuts sheet |
| 5 | ADHD helpers | Sonnet | `LockInView` timer, Home "fresh start" + "done today", feedback (sound/haptics) |

### 1. Themes and appearance
- Theme picker in Settings with live mini previews: **Stone** (today's light), **Notes** (warm
  cream paper, golden accent, warm ink), **Moss** (calm green), **Night** (today's dark),
  **Dusk** (plum dark), **Ink** (true black for OLED), **Contrast** (high contrast). "Match
  system" stays the default (Stone by day, Night by night).
- Every theme is a token block (`[data-theme='notes']`), so components don't change. Each passes
  WCAG AA for text (4.5:1) and UI (3:1); area colors get per-theme text variants.
- Browser chrome color (`theme-color`) follows the theme.
- Text size: Default / Large / Larger (scales the root size).

### 2. Brain-dump capture
- The capture box grows into a textarea (1 → ~8 lines). Enter adds; Shift+Enter starts a new line.
- Paste or type several lines (bullets, numbers, `- [ ]`, semicolons) → a preview list of N tasks,
  each with its guessed area/date/priority chip and a × to drop it. Enter adds them all with one
  Undo.
- One long sentence with several things ("call mom, buy milk and finish the essay") shows
  "Looks like 3 tasks · Split" so splitting is one click without the assistant; with the
  assistant on, each item still goes through the AI sorter, which can split further.
- Guessing while you type: "You already have ‘Call the bank’ · Open" for near-duplicates;
  `every Monday` → repeats weekly; `15 min`, `2h` → effort.

### 3. Drag and drop
- New sort "My order". Dragging a row by its handle (mouse) or a long press (touch) reorders it;
  dragging in another sort switches to My order and keeps what you saw. Order persists (`rank`).
- On an area page, drag between "Today / This week / Later" groups to change when.
- Keyboard: Alt+↑/↓ moves the focused row (and steps). Screen-reader announcements.
- Steps in a task reorder by drag too. Existing drop-on-sidebar keeps working.

### 4. Command palette
- ⌘K / Ctrl+K opens one box for everything: tasks, places (Today, areas, Lock in), and actions
  (New task, New area, Import, Settings, Weekly reset, Theme, Shortcuts).
- It guesses what you mean: "done laundry" → mark "Do laundry" done; "snooze essay"; "move essay
  to Classes"; "essay tomorrow" → reschedule; anything else → "Add ‘…’ as a task". The best guess
  sits on top and Enter does it, with Undo.
- `?` opens a shortcuts sheet.

### 5. ADHD helpers
- Lock in timer: 5 / 15 / 25 minutes, a calm ring with "until 3:40", pause, an optional soft chime;
  time is added to the task.
- Lock in start: "Any", "Quick wins" (≤20 min), "Big push" filter by effort.
- Home "Fresh start": when 2+ tasks are overdue, one card offers Move all to today / Spread over
  this week / Not now (someday), with Undo. No red walls.
- Home "Done today" list under the cairn: what you finished today (the dopamine log).
- Finishing feedback: optional soft sound and phone haptic, both in Settings; respects reduced
  motion.
- Stuck nudge: a task snoozed 3+ times offers "Make it smaller" in its detail.

## How we run it

1. Each workstream runs in its own git worktree and branch (subagent), with tests first for new
   logic (`brainDump`, `intent`, `reorder`, theme contrast), then UI.
2. Each agent keeps edits to shared files (`store/schema.ts`, `store/useStore.ts`,
   `SettingsSections.tsx`, `appEffects.ts`) small and additive, so merging is mechanical.
3. Merge the five branches into `main` in order 1 → 5, resolve shared-file joins, run
   `tsc -b`, `oxlint`, `vitest`, `playwright`.
4. Review pass in parallel: code quality, React, accessibility, security (AI prompt and input
   limits), then fix CRITICAL/HIGH.
5. Browser check of every feature on desktop and phone width, light and dark themes; update docs.

## Out of scope this round
Energy tags (effort already covers "quick"), body-doubling, calendar sync, shared lists.
