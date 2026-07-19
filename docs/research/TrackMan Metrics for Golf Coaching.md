# TrackMan Metrics for Golf Coaching

Research notes compiled 2026-07-20. Sources: official TrackMan pages and PDFs,
published datasets (TrackMan tour tables, TrackMan Combine, Arccos, Shot Scope),
peer-reviewed studies, and coaching practitioners (Adam Young, Jon Sherman,
Andrew Rice, Monte Scheinblum, TPI, Golf Science Lab interviews). Facts that
could not be traced to a primary source are marked [unverified]. This document
backs the `golf-coach` skill in `.claude/skills/golf-coach/`.

## 1. How TrackMan measures

- TrackMan 4 uses dual radar plus a synchronized camera ("OERT"), sampling at
  40,000 samples per second per receiver. Club data pickup is over 90% across
  shot types. ([trackman.com ultimate guide](https://www.trackman.com/blog/golf/the-ultimate-guide-to-understanding-trackman),
  [two radars one camera](https://www.trackman.com/blog/golf/two-radars-one-camera-zero-doubt))
- Club speed, attack angle, and club path are defined at the geometric center
  of the club head. Face angle and dynamic loft are defined at the impact
  location on the face. All are evaluated at maximum ball compression from
  pre-impact data. Camera-based systems reference the face center instead, so
  cross-system numbers differ by up to 3 degrees of path and 1 degree of attack
  angle. Do not mix systems when comparing sessions.
  ([club data definitions](https://www.trackman.com/blog/golf/club-data-definitions))
- Measured vs calculated: ball speed, club speed, launch angle, spin rate, face
  angle, and club path are measured directly. Carry, total, and side numbers
  are derived from launch conditions plus a flight model.
  ([ultimate guide](https://www.trackman.com/blog/golf/the-ultimate-guide-to-understanding-trackman))
- Indoors, the radar sees only part of the flight and models the rest. Spin
  needs a minimum flight distance to be measured; below it, spin is inferred
  from club data. Practical rule: indoors, trust club data (speed, path, face,
  strike); treat carry and curvature as modeled.
  ([TrackMan support, indoor vs outdoor](https://support.trackmangolf.com/hc/en-us/articles/36721370071707))
- The unit must sit behind the player. Any other placement captures launch data
  only. ([two radars one camera](https://www.trackman.com/blog/golf/two-radars-one-camera-zero-doubt))
- TrackMan's normalization feature recomputes carry, side, and total to
  standard conditions (no wind, set temperature and altitude) and converts
  range-ball data toward premium-ball equivalents. Use normalized values for
  gapping. ([normalization explained](https://www.trackman.com/blog/golf/normalization-feature-explained))
- Short shots often return no face angle. Radar needs ball flight and club
  visibility; pitches and chips frequently miss club-face metrics. Report the
  sample count next to any face-angle statistic.

## 2. Metric definitions and sign conventions

Swing-Stack stores telemetry in SI units: speeds in m/s, distances in meters,
angles in degrees, spin in rpm, time in seconds. Conversions: 1 m/s = 2.237
mph, 1 m = 1.094 yd. TrackMan publishes in mph and yards.

Definitions from TrackMan's official parameter pages
([40 parameters](https://www.trackman.com/blog/golf/40-trackman-parameters)).
Sign conventions are target-relative and dexterity-independent: positive
always means right of the target line. For a right-handed player, positive
face angle reads as open and positive club path reads as in-to-out.

| Column | TrackMan parameter | Definition and sign |
|---|---|---|
| `club_speed` | Club Speed | Speed of the club head's geometric center just before contact |
| `attack_angle` | Attack Angle | Vertical club movement at max compression. Positive = hitting up |
| `club_path` | Club Path | Horizontal club movement at max compression. Positive = right of target |
| `face_angle` | Face Angle | Horizontal face orientation at impact point at max compression. Positive = right of target |
| `face_to_path` | Face To Path | Face angle minus club path. Positive = face open to path, ball curves right |
| `dynamic_loft` | Dynamic Loft | Vertical face orientation at impact. Main factor for launch height |
| `spin_loft` | Spin Loft | 3D angle between club movement and face orientation. Approx. dynamic loft minus attack angle. Drives spin rate and compression |
| `swing_plane` | Swing Plane | Vertical angle of the swing arc plane, knee-high to knee-high |
| `swing_direction` | Swing Direction | Horizontal aim of that plane. Negative = over the top for a right-hander |
| `low_point_distance` | Low Point | Distance from impact to the arc's lowest point. Irons want low point after the ball, driver before |
| `impact_offset` | Impact Offset | Horizontal strike location vs face center (heel/toe), mm |
| `impact_height` | Impact Height | Vertical strike location vs face center, mm |
| `ball_speed` | Ball Speed | Ball speed at separation from the face |
| `smash_factor` | Smash Factor | Ball speed divided by club speed |
| `launch_angle` | Launch Angle | Vertical launch, slightly below dynamic loft |
| `launch_direction` | Launch Direction | Horizontal start line. Positive = starts right |
| `spin_rate` | Spin Rate | Rotation rate at separation |
| `spin_axis` | Spin Axis | Tilt of the rotation axis. Positive = fade side, negative = draw side. Constant during flight |
| `curve` | Curve | Side movement from launch direction to landing |
| `max_height` | Height | Apex relative to launch elevation |
| `carry` | Carry | Flight distance to launch elevation ("carry flat") |
| `landing_angle` | Landing Angle | Descent angle at launch elevation. Flatter = more roll |
| `norm_carry`, `norm_total_distance`, `norm_total_side` | Normalized values | Recomputed to standard conditions and premium-ball flight |

## 3. Ball flight laws

- New laws, radar-verified: the ball starts close to where the face points and
  curves away from the path. The old teaching (path starts it, face curves it)
  is backwards. Consensus across TrackMan and independent coaches.
  ([TrackMan](https://www.trackman.com/blog/golf/the-ultimate-guide-to-understanding-trackman),
  [Adam Young](https://www.adamyounggolf.com/the-ball-flight-laws/),
  [Scheinblum](https://rebelliongolf.com/swing-path-and-face-angle/))
- Face angle sets roughly 75% of start direction with irons and about 85% with
  driver. The exact split varies 75 to 87% by source and loft. The figures come
  from TrackMan University material; current trackman.com states the law only
  qualitatively. ([PGA Academy](https://pgaacademy.com.au/trackman/starting-line-path-or-face/))
- Curvature: face open to path curves right, face closed to path curves left.
  Face-to-path magnitudes at speed are large. TrackMan's worked examples:
  minus 2 degrees of face-to-path at PGA driver speed is about 19 yards of left
  curve; plus 5 degrees is about 44 yards right.
  ([face-to-path](https://www.trackman.com/blog/golf/face-to-path))
- The laws assume a centered strike. Gear effect from off-center hits distorts
  them: heel strikes fade, toe strikes draw, high-face strikes drop spin, low
  strikes add it, up to about 1,000 rpm.
  ([6 numbers](https://www.trackman.com/blog/golf/6-trackman-numbers-all-amateur-golfers-should-know),
  [spin article](https://www.trackman.com/blog/golf/3-steps-to-improve-your-spin-rate-in-golf))
- The classic misconception: a slicer who aims further left widens the
  face-to-path gap and slices more. Coaches fight this constantly.
  ([Adam Young](https://www.adamyounggolf.com/the-ball-flight-laws/),
  [Scheinblum](https://rebelliongolf.com/swing-path-and-face-angle/))

## 4. Benchmarks

### Tour averages (TrackMan-published)

Classic table ([TrackMan PDF](https://teeituprva.com/wp-content/uploads/2019/03/PGA-AVERAGES-INTERACTIVE.pdf))
with 2024 refresh where published
([announcement](https://www.trackman.com/blog/golf/introducing-updated-tour-averages)).
Metric conversions to Swing-Stack units in parentheses.

| Metric | PGA driver | PGA 7 iron | LPGA driver | LPGA 7 iron |
|---|---|---|---|---|
| Club speed | 113-115 mph (50.5-51.4 m/s) | 90-92 mph (40.2-41.1 m/s) | 94-96 mph (42.0-42.9 m/s) | 76 mph (34.0 m/s) |
| Ball speed | 167-171 mph (74.7-76.4 m/s) | 120-123 mph (53.6-55.0 m/s) | 140-143 mph (62.6-63.9 m/s) | 104 mph (46.5 m/s) |
| Smash factor | 1.48-1.49 | 1.33 | 1.48-1.49 | 1.38 |
| Attack angle | -1.3 to -0.9 | -4.3 | +2.8 to +3.0 | -2.3 |
| Launch angle | 10.4-10.9 | 16.3 | 12.6-13.2 | 19.0 |
| Spin rate | 2,545-2,686 rpm | ~7,100 rpm | 2,506-2,611 rpm | 6,699 rpm |
| Carry | 275-282 yd (251-258 m) | 172-176 yd (157-161 m) | 218-223 yd (199-204 m) | 141 yd (129 m) |
| Landing angle | 38 | 50 | 37 | 47 |

Notable: LPGA pros hit up on driver, PGA pros slightly down. The 7 iron
column is stable across both TrackMan releases.

### Amateur anchors

- TrackMan's "average male amateur" (handicap 14-15) with driver: club speed
  93.4 mph (41.8 m/s), ball speed 132.6 mph (59.3 m/s), smash 1.42, attack
  angle -1.6, spin 3,275 rpm, carry 204 yd (187 m). TrackMan's point: about 30
  yards left on the table from delivery alone at fixed speed.
  ([TrackMan AMA](https://blog.trackmangolf.jp/performance-of-the-average-male-amateur/))
- Shot Scope on-course carry by handicap (via MyGolfSpy, approximate): driver
  250/220/195/170 yd and 7 iron 165/145/130/110 yd at scratch/10/20/30.
  ([driver chart](https://mygolfspy.com/news-opinion/driver-distance-chart-2026-update-how-far-golfers-hit-it-by-handicap/))
- Arccos 2025 report (6.5M drives): average male total driving distance 224.7
  yd, flat since 2018.
  ([Lou Stagner](https://newsletter.loustagnergolf.com/p/how-far-do-amateurs-hit-driver-2025-distance-report))
- Iron gapping norms: 10-15 yd of carry between adjacent irons, roughly 2-3 yd
  per degree of loft. ([MyGolfSpy](https://mygolfspy.com/news-opinion/how-to-gap-your-golf-bag/))

### Consistency and dispersion (the face-angle context)

- TrackMan puts average tour shot-to-shot face-angle variance near 2 degrees.
  Their modeling: a 0-degree path with a plus/minus 2 degree face window lands
  a mid/long approach in a 42.6 ft wide band. A 4.5-degree out-to-in path with
  the same face window lands in essentially the same band (42.4 ft). Face
  consistency matters more than zeroing out path.
  ([is zeroing out hurting your scorecard](https://www.trackman.com/blog/golf/is-zeroing-out-hurting-your-scorecard))
- Betzler et al. 2012 (n=285): low-handicap golfers show significantly lower
  shot-to-shot SD in club speed, strike location, attack angle, club path, and
  face angle. Face-angle SD is a primary skill discriminator. Magnitudes are
  paywalled [unverified].
  ([PubMed](https://pubmed.ncbi.nlm.nih.gov/22272690/))
- TrackMan Combine precision ladder: tour average miss is 5-6% of shot
  distance (9.1 yd at 160 yd); an 18-handicap misses 13-15% (24.1 yd at 160).
  Driver average offline: 11.8 yd tour, 26.8 yd 18-handicap.
  ([Combine brochure PDF](https://georgepinnell.com/files/2013/02/TrackMan-Combine-brochure.pdf))
- Full driver pattern width barely shrinks with skill. Mid-single-digit
  amateurs and a world number one both show roughly 70-74 yd wide driver
  patterns. Skill shows up as fewer extreme misses and better aim, not a
  narrower cone. ([The Left Rough summary](https://theleftrough.com/shot-dispersion-in-golf/))
- Drives more than 40 yd offline happen on 7-8% of drives at every handicap
  from 0 to 20. ([Stagner/Arccos](https://newsletter.loustagnergolf.com/p/big-miss-with-driver))
- 7 iron dispersion by handicap (coaching estimate, not a dataset): tour under
  15 yd wide, scratch 15-20, 10-handicap 25-30, 20-handicap 35-40 [rule of
  thumb]. Amateurs miss short far more than long.
  ([Hackmotion](https://hackmotion.com/shot-dispersion-in-golf/))

## 5. Coaching practice

### Why coaches train face first

Face dominates start line, and start line is feedback a player can see. The
dominant taught mechanism for face control is wrist condition (lead-wrist
extension opens the face, flexion closes it) over grip appearance.
([Foy Golf Academy](https://foygolfacademy.com/open-or-closed-how-to-train-face-angle-with-purpose/),
[Andrew Rice](https://www.andrewricegolf.com/andrew-rice-golf/tag/face+to+path),
[Hackmotion](https://hackmotion.com/clubface-control-drills/))

Andrew Rice's framing, common among TrackMan-certified teachers: a functional
face-to-path relationship is the bottom line of the swing; the swing does not
need a certain appearance to function.

### Canonical face drills

- Start-line gate: two sticks a few feet ahead. Through the gate means the
  face was near target. Miss right = open, left = closed. (Foy, Hackmotion)
- Awareness-speed swings: deliberate open, closed, then square faces at ~25%
  speed; earn speed back on successful reps.
  ([Ben Emerson, Golf Monthly](https://www.golfmonthly.com/tips/how-awareness-speed-swings-are-the-key-to-better-clubface-control-in-2024))
- Clubface checkpoints: stop waist-high, look at the face. (Hackmotion)
- Exaggeration drills: intentionally hit big hooks and slices. Adam Young's
  study found deliberate wrong-spot strikes improved sweet-spot finding more
  than centered-only practice.
  ([variability practice](https://www.adamyounggolf.com/variability-practice-for-golf-bitesize-blog/))
- Parameter ladders: walk a number (path or face) up and down a ladder so no
  two shots are alike. ([Andrew Rice](https://www.andrewricegolf.com/andrew-rice-golf/tag/trackman))

### The slice-fix progression

Multiple independent sources describe the same journey: open face gets
squared, then the path overcorrects in-to-out, and a hook phase appears. The
fix motion overdone is literally the new fault (stronger grip plus wrist
flexion becomes too much, too early; the reformed slicer swings increasingly
in-to-out and flips). Coaches treat start lines migrating left, face-to-path
going negative, and hooks appearing as the expected next chapter, a cue to
recalibrate rather than panic.
([Scheinblum](https://rebelliongolf.com/ridding-yourself-of-hooks-and-slices/),
[Hackmotion](https://hackmotion.com/slice-vs-hook/),
[Performance Golf](https://www.performancegolf.com/blog/hook-vs-slice-fixing-the-most-common-golf-swing-misses))

### Session structure and motor learning

- Blocked practice (same club, same target) performs well in-session and
  retains poorly. Random practice retains and transfers roughly twice as well
  in cited research. Novices benefit from blocks; experienced players learn
  more from random order while performing worse in it.
  ([Practical Golf](https://practical-golf.com/blocked-vs-random-practice/),
  [TPI](https://www.mytpi.com/articles/fitness/maximize-on-course-performance))
- Bjork: "current performance during training is an inaccurate index of
  learning." The honest test of a change is a later cold session, not tonight's
  numbers. ([Golf Science Lab interview](https://golfwell.co/performance-and-learning-dr-robert-bjork-and-adam-young/))
- Adam Young's difficulty calibration: keep task success around 3-7 out of 10.
  ([interview](https://golfwell.co/structuring-your-practice-adam-young/))
- Volume: coaches surveyed average ~56 balls per session; past 50-60 quality
  collapses. Three 50-ball sessions beat one 150-ball marathon.
  ([Out of Bounds Golf survey](https://outofboundsgolf.com/how-many-balls-to-hit-at-the-range/))
- Sherman's structure: blend technique blocks with scored "game time" blocks
  (routine, changing targets, one ball), driver last.
  ([launch monitor practice](https://practical-golf.com/golf-launch-monitor-practice))

### Judging whether a face intervention works

Synthesized protocol, components individually sourced:

1. Baseline 5-10+ shots per club; log face angle, face-to-path, start line,
   carry, and their SDs.
2. Judge the distribution, not the mean. Success = face-angle SD and
   start-line SD shrinking while face-to-path sits in the intended window.
3. Retest cold at the start of a later session. In-session gains are
   performance, not learning.
4. Test transfer under random conditions (routine, changing targets), then
   on-course.
5. Watch for the overcorrection signature (section above).
6. Control confounds between weeks: same ball type, same surface, same
   indoor/outdoor setting.
7. Around 20-30 shots minimum for a dispersion picture. No rigorous threshold
   exists; the practitioner consensus is distributions over multiple sessions.

## 6. Data traps

- Range balls: 5-10% less carry on irons, up to ~1,000 rpm less spin, and
  ball-to-ball inconsistency. Fine for club data and direction work. Never for
  gapping, spin, or fitting.
  ([Practical Golf test](https://practical-golf.com/range-golf-ball-versus-premium-ball))
- Mats rescue fat shots: the club bounces into the ball instead of digging, so
  strike patterns look cleaner and carry reads optimistic. Exact deltas vary
  by source [unverified].
- Indoor radar: trust face, path, and speed; treat carry and curvature as
  modeled (section 1).
- Chasing numbers: interpret patterns (start line plus curve plus strike),
  change one thing at a time, and never judge a session by its best shots.
  ([Sherman](https://practical-golf.com/golf-launch-monitor-practice))
- Nobody controls the ball as much as they think. A scratch golfer's 8 iron
  spreads 24 yd side to side. Expectation-setting comes before any data
  conversation. ([Practical Golf](https://practical-golf.com/golf-ball-control))

## 7. Implications for Swing-Stack data

- Telemetry is SI (m/s, meters). Tour tables publish mph and yards. Convert
  before comparing.
- Short pitches frequently lack `face_angle`. Report n alongside face stats.
- Club identity comes from `shot.club` (name-first resolution). `bay_club` and
  `bay_loft_deg` are stored export facts; the loft config is known-unreliable
  at the bay level.
- Carry splits drill swings from full swings within a session. Use them
  separately; face control at full speed is the meaningful evidence.
- Face-angle SD per session is the primary progress metric, per Betzler and
  TrackMan's tour-variance framing. The mean shows bias; the SD shows skill.
