# Swing-Stack

Rails 8.1 API + React dashboard for golf launch monitor telemetry.

## Writing style (README, docs, commit messages, code comments)

- Short sentences. Simple English.
- Be concise. Cut filler words.
- No em dashes. Use commas, periods, or parentheses.
- No emoji.
- No AI-sounding filler ("delve", "seamless", "robust", "leverage").
- Prefer plain statements over marketing tone.

## Conventions

- CI must pass. Before pushing, run everything CI runs: `bundle exec rspec`, `bin/rubocop`, `bin/brakeman`, `bin/bundler-audit`, and from `web/`: `npm run lint` and `npm run build`.
- N+1 queries: Bullet raises in test. Any endpoint that serializes a collection must eager-load its associations (`includes`) or aggregate in SQL.
- Frontend lives in `web/` (Vite + React + TS). E2E tests: `npx playwright test` from `web/`. They need a seeded dev DB, so they run locally, not in CI.
- Test ids: kebab-case `data-testid` on chart marks and stat values. Use role-based locators for buttons and forms.
- `data/` and `docs/personal/` are gitignored. Never commit launch monitor exports (they contain player names and emails).
- Never add co-author lines to commits.
