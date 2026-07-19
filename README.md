# Swing-Stack

Store your golf launch monitor data. See it as charts. Query it from an API.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/dashboard-dark.png">
  <img alt="Swing-Stack dashboard: dispersion fan, ball flight trajectories, carry gapping, and club averages" src="docs/screenshots/dashboard-light.png">
</picture>

*The dashboard follows your system theme. Light and dark are both first class.*

## What you get

- **Dispersion fan.** Top-down view of every shot from the tee, with a 1-sigma ellipse per club.
- **Ball flight.** Side view of every recorded trajectory. Hover to isolate a shot.
- **Gapping.** Carry per club: every shot, the mean, and the spread.
- **Club averages.** Speed, smash, spin, apex, and dispersion, computed in the database.
- **An API for everything.** The dashboard is just a client. Scripts and AI agents get their own scoped keys.

## Run it

```sh
# API (Rails 8.1 + PostgreSQL)
bundle install
bin/rails db:prepare db:seed
bin/rails server

# Dashboard (React + Vite)
cd web
npm install
npm run dev        # http://localhost:5173
```

Drop your TrackMan report exports into `data/` and re-run `bin/rails db:seed`.
Re-seeding never duplicates shots.

`docker compose up --build` starts the API and PostgreSQL in one command.

## How it works

```mermaid
flowchart LR
    A[TrackMan export] -->|POST /api/v1/imports| B[Import batch]
    B -->|background job| C[(PostgreSQL)]
    C --> D[React dashboard]
    C --> E[AI agents and scripts]
```

Imports return `202 Accepted` right away. A background job parses the export
and upserts sessions and shots using TrackMan's own UUIDs, so importing the
same file twice changes nothing.

## Design notes

- **Two auth lanes.** People sign in with short-lived JWTs and rotating refresh
  tokens. Machines get scoped API keys (`telemetry:read`, `telemetry:write`)
  that can never mint new credentials. Different clients fail differently, so
  they authenticate differently.
- **Clubs from loft.** Exports do not name the club. The club head's static
  loft is a stable fingerprint, so shots group themselves and you attach labels
  like "7 Iron" once.
- **Analytics in the database.** Per-club averages and dispersion come from one
  grouped SQL query, not application code.
- **UUID keys and rate limits.** No guessable IDs, and Rack::Attack throttles
  every lane, including login attempts.

## API

| Endpoint | Purpose |
|---|---|
| `POST /api/v1/auth/login` | Sign in, get tokens |
| `POST /api/v1/api_tokens` | Create a scoped agent key |
| `POST /api/v1/imports` | Upload an export (async) |
| `GET /api/v1/shots` | Shot telemetry, 30+ metrics each |
| `GET /api/v1/sessions` | Practice sessions |
| `GET /api/v1/clubs` | Clubs and labels |
| `GET /api/v1/stats/clubs` | Per-club averages and dispersion |

Humans send `Authorization: Bearer <jwt>`. Agents send `X-Api-Key`.

## Tests

```sh
bundle exec rspec          # API specs against a real 52-shot export fixture
cd web && npx playwright test   # boots the full stack, tests the UI end to end
```

Playwright agent definitions (planner, generator, healer) for Claude Code live
in `.claude/agents/`. Chart marks carry `data-testid` attributes so agents and
tests can find them.

## Privacy

`data/` is gitignored. Launch monitor exports contain player names and emails,
so they never leave your machine. The test fixture is sanitized.

## Scope

Personal project and portfolio piece. I use it for my own range sessions.
Bug reports are welcome. Feature requests may not be implemented.
