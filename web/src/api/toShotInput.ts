import type { ShotInput } from 'golf-shot-viz'
import type { Shot } from './types'

// Adapts the API shot shape (plus dashboard enrichment) to the
// golf-shot-viz input. Explicit colors keep club hues identical to the
// 2D charts no matter how the 3D view is filtered.
export function toShotInput(
  shot: Shot & { color?: string; clubLabel?: string },
  session?: string,
): ShotInput | null {
  if (!shot.ball_trajectory || shot.ball_trajectory.length < 2) return null
  const meta: ShotInput['meta'] = {
    club: shot.clubLabel ?? shot.club?.label ?? 'Unclassified',
  }
  if (session) meta.session = session
  if (shot.carry !== null) meta.carry = shot.carry
  if (shot.total_distance !== null) meta.totalDistance = shot.total_distance
  if (shot.max_height !== null) meta.apex = shot.max_height
  if (shot.ball_speed !== null) meta.ballSpeed = shot.ball_speed
  if (shot.hang_time !== null) meta.hangTime = shot.hang_time
  if (shot.launch_angle !== null) meta.launchAngle = shot.launch_angle
  if (shot.spin_rate !== null) meta.spinRate = shot.spin_rate
  if (shot.curve !== null) meta.curve = shot.curve
  return {
    id: shot.id,
    points: shot.ball_trajectory,
    ...(shot.color ? { color: shot.color } : {}),
    meta,
  }
}
