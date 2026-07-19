---
name: snapshot
description: Back up or restore the local Swing-Stack database using timestamped pg_dump snapshots
---

# Database snapshots

The local PostgreSQL database is the only copy of the telemetry. There is no
hosted deployment. Snapshots are compressed pg_dump archives in
`data/snapshots/`, gitignored because they contain player names and emails.

## Commands

Run from the repo root:

- `bin/rails snapshot:create` writes `data/snapshots/<timestamp>_<database>.dump`.
- `bin/rails "snapshot:create[label]"` appends a label (letters, digits, `-`, `_`).
- `bin/rails snapshot:list` lists snapshots, oldest first.
- `CONFIRM=1 bin/rails snapshot:restore` restores the newest snapshot.
- `CONFIRM=1 bin/rails "snapshot:restore[FILE.dump]"` restores a named one.
- `bin/rails "snapshot:prune[10]"` keeps the newest 10 and deletes the rest.

## Rules

- Take a snapshot before anything that can lose data: destructive migrations,
  re-imports, seed changes, manual SQL.
- Restore wipes the target database first. Never run it unless the user asked
  for a restore.
- Restore refuses a dump whose filename does not contain the target database
  name. `FORCE=1` overrides that check, only with the user's say-so.
- If a restore hangs, open connections are blocking the table drops. Stop the
  Rails server, then retry.
- After restoring an old dump, run `bin/rails db:migrate` if migrations were
  added since it was taken.
