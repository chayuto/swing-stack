import type { Shot, TrainingSession } from './api/types'

// Bay calibration is a read layer: stored telemetry stays exactly as
// TrackMan reported it, and the session's offset is applied here on the
// way into the charts. Direction angles shift by the offset; lateral
// landing distances rotate with the target line. face_to_path is a
// difference of two directions, so the offset cancels and it is never
// touched. ball_trajectory points stay raw (the side error at chart
// scale is within line width).

const DEG = Math.PI / 180

export function calibrateShot(shot: Shot, offsetDeg: number | null | undefined): Shot {
  if (!offsetDeg) return shot
  const angle = (v: number | null) => (v === null ? null : v + offsetDeg)
  const sin = Math.sin(offsetDeg * DEG)
  const lateral = (side: number | null, dist: number | null) =>
    side === null || dist === null ? side : side + dist * sin
  return {
    ...shot,
    face_angle: angle(shot.face_angle),
    club_path: angle(shot.club_path),
    launch_direction: angle(shot.launch_direction),
    swing_direction: angle(shot.swing_direction),
    carry_side: lateral(shot.carry_side, shot.carry),
    total_side: lateral(shot.total_side, shot.total_distance),
    norm_total_side: lateral(shot.norm_total_side, shot.norm_total_distance),
  }
}

export function offsetsBySession(sessions: TrainingSession[]): Map<string, number | null> {
  return new Map(sessions.map((s) => [s.id, s.calibration_offset_deg]))
}
