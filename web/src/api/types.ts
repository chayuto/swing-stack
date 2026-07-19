// Shapes returned by the Rails API (api/v1). Rails serializes float
// columns as numbers and decimal columns (static_loft_deg) as strings.

export interface SessionUser {
  id: string
  email: string
  name: string | null
}

export interface AuthResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token: string
  user: SessionUser
}

export interface TrainingSession {
  id: string
  external_id: string
  source: string
  played_on: string | null
  facility: string | null
  bay: string | null
  ball_type: string | null
  temperature: number | null
  created_at: string
  shots_count: number
}

export interface Club {
  id: string
  label: string
  static_loft_deg: string
  created_at: string
  shots_count: number
}

export interface ClubRef {
  id: string
  label: string
}

export interface Shot {
  id: string
  external_id: string
  training_session_id: string
  struck_at: string | null
  club: ClubRef | null
  reduced_accuracy: string[]
  club_speed: number | null
  attack_angle: number | null
  club_path: number | null
  dynamic_loft: number | null
  face_angle: number | null
  spin_loft: number | null
  face_to_path: number | null
  swing_plane: number | null
  swing_direction: number | null
  swing_radius: number | null
  low_point_distance: number | null
  impact_offset: number | null
  impact_height: number | null
  dynamic_lie: number | null
  ball_speed: number | null
  smash_factor: number | null
  launch_angle: number | null
  launch_direction: number | null
  spin_rate: number | null
  spin_axis: number | null
  curve: number | null
  max_height: number | null
  carry: number | null
  total_distance: number | null
  carry_side: number | null
  total_side: number | null
  landing_angle: number | null
  hang_time: number | null
  norm_carry: number | null
  norm_total_distance: number | null
  norm_total_side: number | null
  /** [downrange m, height m, side m] points; present when requested with include=trajectory */
  ball_trajectory: [number, number, number][] | null
}

export interface ShotsPage {
  shots: Shot[]
  page: number
  per_page: number
  total: number
}

export interface ClubStats {
  club: { id: string; label: string; static_loft_deg: string }
  shots_count: number
  averages: {
    club_speed: number | null
    ball_speed: number | null
    smash_factor: number | null
    launch_angle: number | null
    spin_rate: number | null
    max_height: number | null
    carry: number | null
    total_distance: number | null
    attack_angle: number | null
    club_path: number | null
    face_to_path: number | null
  }
  dispersion: {
    carry_sd: number | null
    carry_min: number | null
    carry_max: number | null
    side_sd: number | null
  }
}
