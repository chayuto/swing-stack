---
name: maintain
description: Routine upkeep for the Swing-Stack repo. Triage and merge Dependabot PRs, get red CI back to green, and update outdated dependencies. Use whenever the user asks to check Dependabot, review or merge dependency PRs, fix failing CI, update or bump dependencies, or do general repo maintenance. Also use when CI is red on main, when several PRs fail at once, or when the user asks whether the repo is healthy or up to date.
---

# Maintain the repo

Keep `main` green and dependencies current without breaking the app. There is
no hosted deployment and no staging, so `main` is the only thing that has to
work. CI is the only safety net.

## Order of work

Do it in this order. Getting it wrong wastes a lot of time.

1. **Check `main` first.** Never start with the Dependabot PRs.
2. **Fix `main` if it is red.** Land that fix before touching anything else.
3. **Rebase the Dependabot PRs** onto the fixed `main`.
4. **Merge what is safe**, one at a time.
5. **Re-check `main`** after the last merge.

The reason is in the next section.

## A red Dependabot PR usually means a red main

Every Dependabot PR runs CI against its own branch, which forks from `main` at
the time the PR was opened. A broken `main` makes every open PR red at once,
and the failure has nothing to do with the bump.

The tell: **a job fails that the bump cannot possibly touch.** An npm-only PR
that fails `scan_ruby` or `test` is not an npm problem. A gem PR that fails
`frontend` is not a gem problem.

So when several PRs fail the same way, check `main`:

```
gh run list --branch main --workflow ci.yml --limit 5 \
  --json conclusion,displayTitle,createdAt
```

Note the `--workflow ci.yml`. Without it the list is dominated by Dependabot's
own "Update #..." runs, which are its internal update jobs, not CI. Those are
almost always green and will fool you into thinking `main` is fine.

## Running CI locally

Run everything CI runs before pushing. From the repo root:

```
bundle exec rspec
bin/rubocop
bin/brakeman
bin/bundler-audit
```

From `web/`:

```
npm run lint
npm run build
```

`bin/rails db:test:prepare` first if the test database is stale. Playwright
E2E (`npx playwright test` from `web/`) needs a seeded dev database and does
not run in CI, so it is not part of the gate.

## The Ruby version drifts unwatched

Ruby is pinned in two places that must always agree:

- `.ruby-version`, which drives rbenv locally and `ruby/setup-ruby` in CI.
- `ARG RUBY_VERSION` in the `Dockerfile`.

**No Dependabot ecosystem watches either one.** The config covers `bundler`,
`npm` and `github-actions` only, so Ruby ages silently until someone looks.
`scripts/triage.sh` checks it on every run: it compares the two pins against
each other and the pinned version against the newest patch in its series.

Do not try to fix this by pointing Dependabot's `docker` ecosystem at the
Dockerfile. It would bump `ARG RUBY_VERSION` and leave `.ruby-version`
behind, which produces a routine looking PR that quietly breaks the pair.
Move both files together, by hand, in one commit.

A patch bump inside the same series (3.3.10 to 3.3.12) is routine: change the
two pins, `bundle install`, run the suite. A major Ruby upgrade is not
maintenance work and deserves its own pass.

Rails is an ordinary gem, so Dependabot does propose it, but the Gemfile pin
caps what it can ever offer. `gem "rails", "~> 8.1.3"` means 8.1.x only, so
no 8.2 or 9.0 PR will ever appear. Widening that pin is a deliberate decision,
not something to do while triaging.

## Judging a Dependabot PR

Dependabot holds every gem and npm update for 30 days before proposing it
(`.github/dependabot.yml`). An open PR has already cleared that cooldown, so
the release is not brand new. That is not a substitute for reading it.

**Safe to merge once CI is green**, no local run needed:

- Patch and minor bumps of dev or test only packages (`@types/*`, `oxlint`,
  `@playwright/test`, `vitejs/plugin-react`).
- Patch bumps of runtime packages with no changelog surprises.
- `github-actions` bumps.

**Run the full local suite first:**

- Anything in the runtime gem set: `rails`, `pg`, `puma`, `solid_*`,
  `paper_trail`, `jwt`, `rack-attack`, `rack-cors`.
- Any `react` or `react-dom` bump.
- Any bump that touches the build (`vite`, `typescript`).

**Read the changelog properly before merging:**

- Every major version bump.
- `golf-shot-viz`. See its own section below.

### Major bumps can remove dependencies

This is the one that has already bitten this repo. A major bump of a library
gem can drop transitive dependencies the app was silently relying on. The PR
diff looks small and CI on the PR may even be green, and the app still breaks.

`image_processing` 2.0 dropped `ruby-vips` and `mini_magick`. Active Storage
still required the vips transformer at boot, so every `bin/rails` invocation
died. It sat broken on `main` for three weeks.

So on any major bump, **read what left the lockfile, not just what changed**:

```
git diff main -- Gemfile.lock | grep '^-'
```

Then actually boot the app: `RAILS_ENV=test bin/rails runner 'puts :ok'`.
A green `bundle install` proves nothing.

### golf-shot-viz

`golf-shot-viz` is our own library (repo `chayuto/golf-shot-viz`). Always
consume the published npm version. Never merge anything that introduces an
`npm link` or a `file:` reference.

A version bump here is a real code change we wrote, not a third party patch.
`npm run build` passing does not mean the 3D shot view still renders. Run the
app and look at it before merging.

## Merging

Rebase first so the PR runs against current `main`:

```
gh pr comment <N> --body "@dependabot rebase"
```

Wait for the new run, then:

```
gh pr checks <N>
gh pr merge <N> --squash --delete-branch
```

Merge one at a time and let each land before rebasing the next. Merging
several at once produces lockfile conflicts that Dependabot then has to
resolve on every remaining PR.

If a PR needs a small fix to be mergeable, push a commit to its branch rather
than closing it. Dependabot stops managing a branch once you push to it, which
is what you want for a PR that needed manual work.

## Security findings

`scan_ruby` runs `bin/brakeman` and then `bin/bundler-audit`, in that order,
in one job. **A brakeman failure means bundler-audit never ran.** CVEs can
therefore hide behind an unrelated brakeman failure for as long as it lasts.
After fixing anything in `scan_ruby`, expect bundler-audit to have a backlog.

Fix a bundler-audit finding with a targeted update, not a blanket one:

```
bundle update <gem> --conservative
```

Security updates go in regardless of the 30-day cooldown. The cooldown is for
routine upgrades. A failing `bin/bundler-audit` is a red CI job.

## Things not to do

- **Do not add `--ensure-latest` back to `bin/brakeman`.** It exits 5 whenever
  a newer brakeman exists on rubygems. Combined with the 30-day cooldown, the
  lock is always behind the newest release, so the flag guarantees a red
  `scan_ruby` on every brakeman publish. It was removed deliberately.
- **Do not blanket `bundle update` or `npm update`.** It defeats the cooldown
  policy and produces a lockfile diff nobody can review. Update the specific
  thing you mean to update.
- **Do not commit anything under `data/` or `docs/personal/`.** Both are
  gitignored. They hold launch monitor exports with player names and emails.
- **Do not add co-author lines to commits**, and do not mention AI in PR
  descriptions.
- **Do not touch the database** as part of maintenance. If something does need
  a destructive migration, run `bin/rails snapshot:create` first. The local
  database is the only copy. See the `snapshot` skill.

## Watch for

- **Bullet raises on N+1 in test.** A gem upgrade that changes how
  associations load can turn a passing spec into a Bullet failure. That is a
  real regression, not a flaky test. Add the missing `includes`.
- **Rails deprecation warnings** in rspec output. They are the early warning
  for the next major upgrade. Worth fixing while the suite is green rather
  than under time pressure later.
- **The `frontend` job passing while the app is broken.** `npm run build` only
  type-checks and bundles. It does not render anything.
