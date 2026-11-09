# Cairn: the ADHD toolkit (#adhd)

Date: 2026-11-09. Owner: Rodion. Status: in progress on branch `adhd-section`.

## Why

Cairn already does the basics that research supports for ADHD: if-then plans (`task.plan`), small
steps, Lock in, a timer, Fresh start, no red overdue walls. What it lacks is a place that helps with
the moment itself: starting, staying, sensing time, rewarding yourself, and learning what works for
*you*. A research brief (Barkley's point-of-performance model, Gollwitzer & Sheeran 2006 on if-then
plans, the 2024 JAACAP noise meta-analysis by Nigg et al., Buehler 1994 on the planning fallacy,
Dai/Milkman 2014 fresh starts, Silverman & Barasch 2023 on broken streaks, Masicampo & Baumeister
2011 on plans quieting open loops, acute-exercise meta-analyses) shaped what follows.

What the evidence says plainly, and the app must respect:
- Running tasks in parallel on split screens has no support, and switching costs more with ADHD. So
  our "several screens at once" idea is **one task, many supports on one screen** (the Focus room),
  not two tasks at once.
- Noise helps some people a little and hurts others a little (g≈0.25 vs −0.21). There are no studies
  on brown noise. So sound is opt-in, with a personal "with vs without" test.
- Simulated body doubling is the weakest evidence of all, so it ships as an experiment.
- No streak loss, no shame copy, no medical claims, no "dopamine" pseudo-science.

## What we're building

| Tool | Route | What it does | Evidence |
|---|---|---|---|
| **Focus room** | `#adhd/room` | One screen with everything for one task: next step, a guess-then-timer, focus sound, a quiet companion that checks in, a "Park it" pad for intrusive thoughts (adds them to Later without leaving), a soft hyperfocus exit card, and an end-of-block rating, treat and movement break. | Point of performance (theory), time visibility, Masicampo 2011 (park it), weak (companion) |
| **Focus sounds** | `#adhd/sounds` | White, pink, brown noise and rain made with Web Audio (no files, works offline), volume, fades, plays across views. Shows your own focus ratings with vs without sound. | Nigg 2024 (small, mixed) |
| **Time sense** | `#adhd/time` | Guess before a block; Cairn learns your personal ratio ("you usually take 1.4× your guess"), pads future guesses, and shows last/best time for repeated tasks ("ghost pace"). | Buehler 1994; Marx 2022 |
| **I'm stuck** | `#adhd/unstuck` | Asks why (too big, don't know where to start, boring, it feels bad, too many choices, low energy) and gives one move that fits, ending in an action in the app. | CBT for adult ADHD (Safren 2010, Solanto 2010) |
| **Reward menu** | `#adhd/treats` | Your own list of small rewards; offered right after a block. | Delay aversion (Marx 2021) |
| **Move break** | `#adhd/move` | A 90-second guided movement break. | Acute exercise meta-analysis (small) |
| **What works** | `#adhd/learn` | 17 short research cards with sources, each with "Helps me / Want to try / Not for me" and a "Try it" link; your playbook and your own patterns (best time of day, sound vs none, guess ratio) at the top. | Various, labelled by strength |

## How we run it

1. **Foundation (done, one commit):** route `#adhd[/<tool>]`, nav entries (sidebar, phone More sheet,
   palette, key `4`), `prefs.adhd` schema (sound, companion, sessions, treats, playbook) with store
   actions `setAdhd`, `logSession`, `rateSession`, the `calibration.ts` model with tests, icons, the
   `AdhdView` router and stub files for each tool. Playwright reads `E2E_PORT`.
2. **Four agents in parallel worktrees, each owning only its files:**
   - A, Focus sounds (Opus): `src/adhd/sound/*`, `SoundLab.tsx`.
   - B, Focus room + Time sense (Opus): `FocusRoom.tsx`, `TimeSense.tsx`, `src/adhd/room/*`.
   - C, I'm stuck + Reward menu + Move break (Sonnet): `Unstuck.tsx`, `TreatMenu.tsx`,
     `TreatPicker.tsx`, `MovementSnack.tsx`, `src/adhd/unstuck/*`.
   - D, Hub + What works (Opus): `AdhdHub.tsx`, `WhatWorks.tsx`, `src/adhd/learn/*`.
3. Merge A → C → B → D, then `tsc -b`, `oxlint`, `vitest`, `playwright`.
4. Review in parallel: code quality and React, accessibility, and copy/evidence accuracy. Fix
   CRITICAL and HIGH.
5. Browser check on desktop and phone width in two themes, then docs.

## Out of scope
Medication or routine reminders (a PWA without push can't fire them reliably), real co-working with
other people, accounts or sync for toolkit data (it stays on the device).
