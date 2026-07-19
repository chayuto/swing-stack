# Swing-Stack

A decoupled, API-first system for ingesting, storing, and analyzing golf
launch monitor telemetry (TrackMan report exports today; the pipeline is
source-agnostic by design).

```
launch monitor export ──▶ POST /api/v1/imports ──▶ ImportBatch (raw JSON, jsonb)
                                                        │  async (Solid Queue)
                                                        ▼
                                          Trackman::ReportParser → Importer
                                                        │  idempotent upserts
                                                        ▼
                                 training_sessions · shots · clubs (PostgreSQL)
                                                        │
                              ┌─────────────────────────┴──────────────────┐
                              ▼                                            ▼
                 React / React Native clients                    AI agent clients
                 (JWT + rotating refresh tokens)          (scoped API keys, rate-limited)
```

## Quick start

```sh
docker compose up --build      # PostgreSQL + API on http://localhost:3000
```

or natively:

```sh
bundle install
bin/rails db:prepare db:seed   # seeds demo@swing-stack.dev + every export in data/*.json
bin/rails server
```

Then:

```sh
# 1. Login as a human client
curl -s localhost:3000/api/v1/auth/login \
  -d email=demo@swing-stack.dev -d password=demo-password-123
# => { "access_token": "…", "refresh_token": "…", … }

# 2. Import a TrackMan report export
curl -s localhost:3000/api/v1/imports -X POST \
  -H "Authorization: Bearer $ACCESS" -H "Content-Type: application/json" \
  --data-binary @data/2026-07-19.json
# => 202 { "id": "…", "status": "pending" }   (parsed on the worker tier)

# 3. Read the analytics
curl -s localhost:3000/api/v1/stats/clubs -H "Authorization: Bearer $ACCESS"
```

## Architecture decisions

**Why two authentication lanes?** Humans and autonomous agents have
different failure modes. A phone can be phished; an agent can loop.
So browsers/mobile get short-lived JWTs (15 min) with single-use rotating
refresh tokens, while machine clients get scoped personal access tokens
(`ssk_…`, SHA-256 digest at rest, shown once at provisioning) that can
*never* mint further credentials, carry explicit scopes
(`telemetry:read` / `telemetry:write`), default to a 30-day TTL, and are
rate-limited per key by `Rack::Attack`. Every data endpoint declares the
scope an agent needs to reach it (`app/controllers/concerns/authenticable.rb`).

**Why UUID primary keys everywhere?** Exposed IDs must not be
sequentially iterable — UUIDs close off object-reference enumeration at
the CRUD layer.

**Why import via raw payload + background job?** A dense report export
(hundreds of strokes, full ball-flight trajectories) should never be
parsed inside a web request. `POST /api/v1/imports` only stores the raw
JSON (`jsonb`) and returns `202 Accepted`; `TrackmanImportJob` parses and
upserts on the worker tier. Solid Queue keeps jobs in PostgreSQL — one
fewer moving part than Redis, and `SOLID_QUEUE_IN_PUMA=1` runs the
supervisor inside Puma for single-container demos.

**Why is ingestion idempotent?** Launch monitors issue their own UUIDs.
Sessions are unique per `(user, external_id)` and shots per
`(session, external_id)`, and the importer upserts against those keys —
re-importing overlapping exports can never duplicate telemetry.

**How are clubs identified?** Exports don't name the club. The club
head's *static loft* is a stable per-club fingerprint, so shots are
grouped by loft automatically and users attach labels ("7 Iron") after
the fact.

**Where do analytics run?** In the database. `GET /api/v1/stats/clubs`
computes per-club efficiency aggregates (avg/σ carry, side dispersion,
smash factor, club path, face-to-path…) in a single grouped query —
the natural surface for both dashboard charts and agent analysis loops.

## API surface (v1)

| Endpoint | Auth | Purpose |
|---|---|---|
| `POST /api/v1/auth/register` `login` `refresh` `logout` | — / JWT | Human auth, rotating refresh tokens |
| `POST /api/v1/api_tokens` · `GET` · `DELETE` | JWT only | Provision / revoke scoped agent keys |
| `POST /api/v1/imports` | `telemetry:write` | Ingest a raw report export (202, async) |
| `GET /api/v1/imports/:id` | `telemetry:read` | Import status + counts |
| `GET /api/v1/sessions` · `/sessions/:id` | `telemetry:read` | Range sessions |
| `GET /api/v1/shots?session_id=&club_id=` | `telemetry:read` | Paginated shot telemetry (30+ metrics/shot) |
| `GET /api/v1/clubs` · `PATCH /api/v1/clubs/:id` | read / JWT | List clubs, attach labels |
| `GET /api/v1/stats/clubs` | `telemetry:read` | Per-club aggregates + dispersion |

Agent authentication uses the `X-Api-Key` header; humans use
`Authorization: Bearer <jwt>`.

## Stack

Rails 8.1 (API-only) · PostgreSQL (UUID PKs, `jsonb` payloads, in-DB
aggregates) · Solid Queue / Solid Cache (no Redis) · JWT + bcrypt ·
Rack::Attack · RSpec (the suite runs against a real 52-stroke TrackMan
export fixture).

Planned tiers per the architecture spec: React web dashboard
(canvas-based dispersion/gapping charts), React Native + Expo
(local-first offline sync), and ONNX-based server-side dispersion
modeling — each consuming this API as an ordinary client.

## Development

```sh
bundle exec rspec        # 18 specs, real-export fixture
bin/rubocop              # omakase style
bin/brakeman             # static security analysis
```

Drop your TrackMan exports into `data/` (gitignored — exports contain
player names/emails) and re-run `bin/rails db:seed`; every `data/*.json`
file is imported, and re-seeding is idempotent.

> This project is actively maintained for personal use and portfolio
> demonstration. Bug reports are welcome; feature requests may not be
> implemented.
