module Trackman
  # Pure transformation of a TrackMan "multiGroupReport" export into
  # normalized session/shot hashes. No persistence — see Importer.
  class ReportParser
    Error = Class.new(StandardError)

    # TrackMan Measurement key -> shots column. SI units throughout.
    MEASUREMENT_FIELDS = {
      "ClubSpeed" => :club_speed,
      "AttackAngle" => :attack_angle,
      "ClubPath" => :club_path,
      "DynamicLoft" => :dynamic_loft,
      "FaceAngle" => :face_angle,
      "SpinLoft" => :spin_loft,
      "FaceToPath" => :face_to_path,
      "SwingPlane" => :swing_plane,
      "SwingDirection" => :swing_direction,
      "SwingRadius" => :swing_radius,
      "LowPointDistance" => :low_point_distance,
      "ImpactOffset" => :impact_offset,
      "ImpactHeight" => :impact_height,
      "DynamicLie" => :dynamic_lie,
      "BallSpeed" => :ball_speed,
      "SmashFactor" => :smash_factor,
      "LaunchAngle" => :launch_angle,
      "LaunchDirection" => :launch_direction,
      "SpinRate" => :spin_rate,
      "SpinAxis" => :spin_axis,
      "Curve" => :curve,
      "MaxHeight" => :max_height,
      "Carry" => :carry,
      "Total" => :total_distance,
      "CarrySide" => :carry_side,
      "TotalSide" => :total_side,
      "LandingAngle" => :landing_angle,
      "HangTime" => :hang_time
    }.freeze

    NORMALIZED_FIELDS = {
      "Carry" => :norm_carry,
      "Total" => :norm_total_distance,
      "TotalSide" => :norm_total_side
    }.freeze

    def initialize(payload)
      @payload = payload
    end

    # => [{ session: {...}, shots: [{...}] }]
    def sessions
      groups = @payload["StrokeGroups"]
      groups = [ @payload ] if groups.nil? && @payload.key?("Strokes")
      raise Error, "no StrokeGroups in payload — expected a TrackMan report export" if groups.blank?

      groups.map { |group| parse_group(group) }
    end

    private

    def parse_group(group)
      env = @payload["Environment"] || {}
      {
        session: {
          external_id: group["Id"] || @payload["Id"],
          source: "trackman",
          played_on: group["Date"],
          facility: report_group_name { |kind| kind.start_with?("Facility") || kind == "Location" },
          bay: report_group_name { |kind| kind == "Bay" },
          ball_type: group["Ball"],
          client_name: @payload.dig("Client", "Name"),
          latitude: env.dig("Location", "Latitude"),
          longitude: env.dig("Location", "Longitude"),
          temperature: env["Temperature"]
        },
        shots: Array(group["Strokes"]).map { |stroke| parse_stroke(stroke, group_club: group["Club"]) }
      }
    end

    def parse_stroke(stroke, group_club: nil)
      measurement = stroke["Measurement"] || {}
      normalized = stroke["NormalizedMeasurement"] || {}

      shot = {
        external_id: stroke.fetch("Id"),
        struck_at: stroke["Time"],
        club_name: stroke["Club"] || group_club,
        static_loft_deg: static_loft_deg(stroke),
        reduced_accuracy: Array(measurement["ReducedAccuracy"]),
        ball_trajectory: compact_trajectory(measurement["BallTrajectory"])
      }
      MEASUREMENT_FIELDS.each { |key, column| shot[column] = measurement[key] }
      NORMALIZED_FIELDS.each { |key, column| shot[column] = normalized[key] }
      shot
    end

    # The loft (radians) of the club config the bay had attached to the
    # stroke. A config, not a measurement, and often stale — some
    # exports carry no club name, and then this is all there is.
    def static_loft_deg(stroke)
      radians = stroke.dig("MeasurementDetails", "ImpactLocation", "ClubConfiguration", "StaticLoft")
      return nil if radians.nil?

      (radians * 180.0 / Math::PI).round(1)
    end

    def compact_trajectory(points)
      return nil if points.blank?

      points.map { |p| [ p["X"].round(2), p["Y"].round(2), p["Z"].round(2) ] }
    end

    def report_group_name
      group = Array(@payload["Groups"]).find { |g| yield(g["Kind"].to_s) }
      group && group["Name"]
    end
  end
end
