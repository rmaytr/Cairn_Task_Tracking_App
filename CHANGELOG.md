# Changelog

All notable changes, newest first. The project follows [Conventional Commits](https://www.conventionalcommits.org/).

## 5.0 — Make it yours

- Seven themes: Stone, Notes (warm paper), Moss, Contrast, Night, Dusk, Ink; Match system; three
  text sizes. Every theme is contrast-tested (text 4.5:1, controls and focus 3:1).
- Brain dump: the capture box grows; paste or type a list and each line becomes a task (one Undo).
  One sentence with several things offers *Split*. Near-duplicates are pointed out. "every Monday"
  repeats, "15 min" sets the size. The assistant sorts up to 12 lines per paste.
- Drag to reorder (mouse, touch long-press, Alt+↑/↓, or *Move up/down* in the ⋯ menu) with a saved
  *My order* sort; drag between Today / This week / Later on an area page; reorder steps.
- ⌘K / Ctrl K command palette that guesses what you mean: "done laundry", "essay friday",
  "move essay to Classes", a search opens the task, anything else adds it. `?` shows shortcuts.
- Lock in: 5/15/25-minute timer that keeps running across views and adds the time to the task;
  *Quick wins* / *Big push* filter.
- Today: *Fresh start* for a pile of overdue tasks, a *Done today* list, optional finish sound and
  haptics, and a nudge to make a task smaller after three snoozes.

## 4.1 — Quick actions

- ⋯ menu (and right-click) on every area: add a task there, rename in place, recolour, move up or
  down, delete with a choice of where its tasks go.
- ⋯ menu (and right-click or the menu key) on every task: dates with their actual day, snooze,
  priority, Lock in, move to another area, delete.
- Drag a task onto an area or onto *Today* in the sidebar.
- Phones: swipe right to finish a task, left to snooze it.
- Snooze: one day later, or one step out for tasks without a date.

## 4.0 — Design system

- New "editorial greeting" look: Instrument Sans and Instrument Serif, ink and near-black chrome,
  one teal data colour, a tinted frame around a white sheet, no resting shadows.
- Today rebuilt on a 12-column grid: the greeting with today's one finding, a count strip, Up next
  beside *This week's cairn*, Today and This week panels.
- Feedback motion: sliding nav highlight, press and check animations, rows that slide out when done,
  screen cross-fades.

## 3.0 — Calmer and easier to read

- Dates always show weekday and day ("Fri, Oct 23"), coloured by how close they are, with a calendar
  picker and quick picks.
- The task panel shows only title, date, priority, steps and a note. Repeat, waiting and dependencies
  appear when used.
- One Sort menu (smart, due date, priority, reverse) replaces five filter chips.
- **Lock in** replaces Focus: one task, one step, and why it's first.

## 2.1 — Cheaper, lighter assistant

- The assistant now uses Claude Haiku 5.5 (about 40× cheaper than Opus).
- The AI SDK is loaded only when needed, cutting the main bundle by a third.

## 2.0 — Cairn

- Renamed from *Nearer*. New Today home screen, area pages and one-box capture.
- High, Normal and Low priority; tasks can start after other tasks; a dependency-aware planner.
- Deadline reminders (evening before, morning of, overdue).
- Optional Claude assistant (your own key, or invite codes through a Cloudflare Worker).
- Hardening after review: malformed links, deleted areas, reminder delivery, focus handling,
  dependency loops, invite-code brute forcing.

## 1.1 — Map and sync groundwork

- Mind-map view and custom areas.
- End-to-end encrypted sync on Supabase (ready to enable), privacy policy.
- Task panel, quick find, list filters.

## 1.0 — Nearer

- Local-first radar planner, natural-language capture, importers for text, Markdown, JSON and CSV,
  focus timer, weekly reset, installable PWA.
