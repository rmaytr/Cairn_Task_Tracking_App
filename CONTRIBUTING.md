# Contributing

Thanks for taking an interest in Cairn. Bug reports, ideas and pull requests are welcome.

## Set up

```bash
git clone https://github.com/rmaytr/Cairn_Task_Tracking_App.git
cd Cairn_Task_Tracking_App
npm install
npm run dev     # http://localhost:5173  (add ?sample to start with sample tasks)
```

Node.js 20.19 or newer is required. No accounts or keys are needed. Sync and the assistant are
optional (see [docs/DEPLOY.md](docs/DEPLOY.md)).

## Before you open a pull request

```bash
npm run typecheck
npm run lint
npm test
npm run test:e2e   # builds the app and runs Playwright
```

All four must pass; CI runs the first three on every push.

## Conventions

- **TypeScript strict.** No `any`; validate anything from outside the app (storage, imports, network)
  with a Zod schema.
- **Logic stays pure.** Parsing, planning, reminders and similar rules live in `src/lib`, `src/plan`,
  `src/reminders` or `src/model` as plain functions with unit tests. Components call store actions.
- **Immutable updates.** Store actions return new objects; destructive actions go through `withUndo`.
- **Styling** uses the tokens in `src/index.css` (`--ink`, `--panel`, `--primary`…). No hard-coded
  colours, no resting shadows, and motion only on `transform` and `opacity`, with a reduced-motion
  fallback.
- **Accessibility:** real buttons and links, labels on icon buttons, keyboard paths for every gesture.
- **Copy:** short, plain, sentence case. Name things the way a student would.
- **Commits** follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`,
  `docs:`, `test:`, `refactor:`, `perf:`, `chore:`).

## Reporting a security problem

Please don't open a public issue. See [SECURITY.md](SECURITY.md).
