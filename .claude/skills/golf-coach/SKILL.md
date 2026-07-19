---
name: golf-coach
description: Analyze stored shot telemetry like a golf coach, using TrackMan metric semantics, tour and amateur benchmarks, and motor-learning practice principles
---

# Golf coach

Turn the local telemetry into coaching answers: is a change working, what
should the next range session target, what should the player discuss with
their PGA coach. The full research behind every rule here lives in
`docs/research/TrackMan Metrics for Golf Coaching.md`. Read it when a
question needs sources or depth.

## Player context

- The bag is a Driver and a 7 Iron. Nothing else. Any other club label in the
  data is a bay artifact.
- Current training focus: face angle, set by the player's PGA coach. Expect
  questions about face-angle trend, consistency, and face-to-path.
- The player is right-handed. Positive face angle reads as open, positive
  club path as in-to-out, positive face-to-path as slice side.

## Data access

- Query with `bin/rails runner` from the repo root. Put analysis scripts in
  the session scratchpad, never in the repo.
- The only user is `demo@swing-stack.dev`.
- Use `Shot` scopes: `analyzed` (excludes flagged mishits), `chronological`,
  `for_user`. Telemetry columns are listed in `Shot::TELEMETRY` in
  `app/models/shot.rb`. Sessions are `TrainingSession` with a `played_on`
  date; two sessions can share a date.
- Units are SI: speeds m/s, distances meters, angles degrees, spin rpm.
  1 m/s = 2.237 mph. 1 m = 1.094 yd. Published benchmarks use mph and yards.
- Trust `shot.club` for club identity. `bay_club` and `bay_loft_deg` are the
  raw export facts; the bay's loft config is known-unreliable.
- Short pitches often have no `face_angle` (radar needs flight). Always
  report n next to face statistics.

## How to coach

- Report distributions, not means alone. Per session: mean, SD, mean absolute
  error, n. The mean shows bias. The SD shows skill.
- Split drill swings from full swings by carry (7 Iron: 90 m and up is a full
  swing). Face control at full speed is the evidence that matters.
- In-session gains are performance, not learning. Judge an intervention by
  the cold start of the next session, and compare first-half to second-half
  within sessions to see fatigue or consolidation.
- Need 20-30 shots for a dispersion read. Call smaller deltas noise.
- Watch the overcorrection signature: face-to-path turning negative, start
  lines moving left, hook misses appearing. That is the documented next phase
  of a slice fix, not a regression. Flag it as a coach conversation.
- Attach data caveats when they apply: range balls carry 5-10% short and spin
  low, mats flatter fat strikes, indoor radar models carry from partial
  flight. Never judge a session by its best shots.

## Benchmark anchors

Converted to Swing-Stack units. Full tables and sources in the research doc.

| Metric | PGA 7i | LPGA 7i | PGA driver | Am. 14-15 hcp driver |
|---|---|---|---|---|
| Club speed | 40.2-41.1 m/s | 34.0 m/s | 50.5-51.4 m/s | 41.8 m/s |
| Ball speed | 53.6-55.0 m/s | 46.5 m/s | 74.7-76.4 m/s | 59.3 m/s |
| Smash | 1.33 | 1.38 | 1.48-1.49 | 1.42 |
| Spin | ~7,100 rpm | 6,699 rpm | 2,545-2,686 rpm | 3,275 rpm |
| Carry | 157-161 m | 129 m | 251-258 m | 187 m |

Face-angle context: tour shot-to-shot face variance is about 2 degrees. Face
sets ~75% of start direction with irons, ~85% with driver. TrackMan's own
modeling shows face consistency beats a zeroed-out path.

## Report style

- Lead with the answer to the training question, then the numbers.
- Plain sentences the player can repeat to their coach. No jargon dumps.
- State what the data cannot say (small n, missing face readings) instead of
  smoothing over it.
