---
name: session-report
description: Document a range session in the personal training log. Computes the standard metrics (carry median and IQR, per-10-ball buckets, cold-start, fade, plan scorecard) and writes a dated entry that scores the session against the current plan.
---

# Session report

Turn one ingested range session into a documented log entry. Use this after
`bin/rails trackman:ingest` records a new session, when the question is "how did
that session go, and did the plan work". For open coaching questions (is a
change working over time, what should the next block target, benchmarks), use
the `golf-coach` skill. This skill is the write-up; `golf-coach` is the read.

## Where the log lives

`docs/personal/` (gitignored). The running log is
`docs/personal/2026-07-21-training-log.md`. It is one file, newest entry on top,
under the preamble and its `---`. Do not start a new file per session.

Keep every claim backed by a number from the DB. The folder is gitignored so
player numbers are fine here, but never commit launch monitor exports.

## Steps

1. Confirm the session is ingested. `bin/rails trackman:ingest` prints the new
   session, or check `TrainingSession.order(:played_on).last`.
2. Run the report script from the repo root:

   ```
   bin/rails runner .claude/skills/session-report/session_report.rb
   ```

   No argument reports the latest session. Pass a date (`YYYY-MM-DD`) for an
   earlier one. It reads only and prints medians, IQR, CV, side, face, per-10
   buckets, cold start, fade check, the strike gap, a plan scorecard, and a diff
   vs the previous session. Ad-hoc follow-up scripts still go in the scratchpad,
   never the repo (same rule as `golf-coach`).

3. Read the current plan. The scorecard targets (launch window, carry window,
   miss threshold, driver block) live in the "Next steps" of the latest log
   entry. Edit the constants at the top of `session_report.rb` to match before
   you score, then re-run. Report the honest result, including targets missed.

4. Write the new entry on top of the log. Keep the section order the log uses:

   - `## YYYY-MM-DD session results (<checksum>)`. The checksum is the export's
     short hash (the `data/` filename stem). Note the played_on vs export-date
     gap (exports are UTC, so played_on is usually one day earlier).
   - Headline numbers: carry med and IQR, side bias and sd, club speed, smash,
     face, and whether it faded.
   - The story: the one thing that changed. Cold start, a new miss, a fixed
     miss. Put the per-10-ball table here.
   - Plan scorecard: each target, hit or missed, vs the previous number.
   - Face angle: mean is bias, sd is skill, closed-face% catches overcorrection.
   - Next steps: numbered, concrete, and a short "For the trainer" list.

## Reading the numbers (defer to golf-coach for depth)

- Report distributions, not means. Carry uses median and IQR because mishits
  skew the mean. Face uses mean (bias), sd (consistency), and MAE (from square).
- This player's 7-iron club speed is one tight cluster (about 24 to 25 m/s), so
  every 7-iron shot is a full swing. Do not apply the generic 90 m full-swing
  split; it is calibrated for tour speed. Carry spread here is strike, not swing
  length. The strike-gap line proves it: same speed, flush vs mishit carry.
- In-session gains are performance. The learning signal is the cold start of the
  next session and the session-opening face trend across entries.
- Watch the overcorrection signature: face mean approaching square while
  closed-face% and hook-side face-to-path climb. Flag it for the coach as the
  next phase of a slice fix, not a regression.
- 20 to 30 shots for a dispersion read. Driver samples are usually too small;
  say so.

## Style

Match the log. Short sentences, plain English, metres and m/s and degrees. No em
dashes, no emoji, no filler. State what the data cannot say instead of smoothing
it over.
