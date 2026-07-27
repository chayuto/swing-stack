# session_report.rb -- one range session in the training-log format.
#
# Run from the repo root:
#   bin/rails runner .claude/skills/session-report/session_report.rb [played_on]
# With no argument it reports the latest session. Pass a date (YYYY-MM-DD) to
# report an earlier one. Reads only, writes nothing. You still write the prose
# entry into the log yourself (docs/personal/<date>-training-log.md, newest on top).
#
# Align these to the CURRENT plan, which is the "Next steps" of the latest log
# entry. They are the scorecard targets, not physics constants. Change them when
# the plan changes (e.g. the carry window moved to 63 +/- 5).
LAUNCH_WINDOW = (15.0..22.0) # good launch band, degrees
LAUNCH_FLOOR  = 12.0         # under this is the thin, delofted miss
CARRY_WINDOW  = (58.0..68.0) # carry-window game, metres (63 +/- 5)
MISS_CARRY    = 45.0         # carry under this is a duffed or thin miss, metres
FULL_CLUB     = "7 Iron"     # the club the player does full-swing work with
WELL_STRUCK   = 1.30         # smash at or above this is a flush strike
MISHIT        = 1.10         # smash under this is a poor strike

user = User.find_by!(email: "demo@swing-stack.dev")

def f(x) = x.nil? ? nil : x.to_f
def med(arr)
  a = arr.compact.map(&:to_f).sort
  n = a.size
  return nil if n.zero?
  n.odd? ? a[n / 2] : (a[n / 2 - 1] + a[n / 2]) / 2.0
end
def iqr(arr)
  a = arr.compact.map(&:to_f).sort
  n = a.size
  return nil if n < 4
  q = ->(p) { i = p * (n - 1); lo = i.floor; a[lo] + (a[[lo + 1, n - 1].min] - a[lo]) * (i - lo) }
  q.call(0.75) - q.call(0.25)
end
def sd(arr)
  a = arr.compact.map(&:to_f)
  n = a.size
  return nil if n < 2
  m = a.sum / n
  Math.sqrt(a.sum { |x| (x - m)**2 } / (n - 1))
end
def avg(arr)
  a = arr.compact.map(&:to_f)
  a.empty? ? nil : a.sum / a.size
end
def mae(arr, t = 0.0)
  a = arr.compact.map(&:to_f)
  a.empty? ? nil : a.sum { |x| (x - t).abs } / a.size
end
def r(x, d = 1) = x.nil? ? "-" : x.round(d)

# Sessions in chronological order by earliest struck_at.
all = Shot.for_user(user).analyzed.includes(:club, :training_session).to_a
sessions = all.group_by(&:training_session).to_a
               .sort_by { |ts, ss| ss.map(&:struck_at).compact.min || ts.played_on.to_time }
idx = ARGV[0] ? sessions.index { |ts, _| ts.played_on.to_s == ARGV[0] } : sessions.size - 1
abort "No session for #{ARGV[0].inspect}. Dates: #{sessions.map { |ts, _| ts.played_on }.uniq.join(', ')}" if idx.nil?
ts, ss = sessions[idx]
prev_ts, prev_ss = sessions[idx - 1] if idx > 0

full = ss.select { |s| s.club&.label == FULL_CLUB }.sort_by { |s| s.struck_at || Time.at(0) }
other = ss.reject { |s| s.club&.label == FULL_CLUB }
abort "Session #{ts.played_on} has no #{FULL_CLUB} shots." if full.empty?

puts "SESSION #{ts.played_on}  total=#{ss.size}  #{FULL_CLUB}=#{full.size}  other=#{other.size}"
puts "carry: med=#{r(med(full.map(&:carry)))} m  IQR=#{r(iqr(full.map(&:carry)))} m  " \
     "CV=#{r((sd(full.map(&:carry)) && med(full.map(&:carry)) ? sd(full.map(&:carry)) / med(full.map(&:carry)) * 100 : nil))}%"
puts "side (carry_side): med=#{r(med(full.map(&:carry_side)))} m  sd=#{r(sd(full.map(&:carry_side)))} m"
puts "club_speed: med=#{r(med(full.map(&:club_speed)), 2)} m/s  smash: med=#{r(med(full.map(&:smash_factor)), 2)} mean=#{r(avg(full.map(&:smash_factor)), 2)}"
puts "face_angle: mean=#{r(avg(full.map(&:face_angle)), 2)} sd=#{r(sd(full.map(&:face_angle)), 2)} " \
     "MAE=#{r(mae(full.map(&:face_angle)), 2)} n_face=#{full.count { |s| s.face_angle }}  " \
     "closed-face%=#{r((full.count { |s| f(s.face_angle) && f(s.face_angle) < 0 } * 100.0 / [full.count { |s| s.face_angle }, 1].max))}"
puts "launch: med=#{r(med(full.map(&:launch_angle)))} deg"

puts "\nPer-10-ball buckets (#{FULL_CLUB}, in order):"
puts "balls    carry_med  misses(<#{MISS_CARRY.to_i}m)  launch<#{LAUNCH_FLOOR.to_i}  face_mean"
full.each_slice(10).with_index do |g, i|
  lo = i * 10 + 1
  hi = i * 10 + g.size
  puts "%-8s %-10s %-14s %-11s %s" % [
    "#{lo}-#{hi}", r(med(g.map(&:carry))),
    g.count { |s| f(s.carry) && f(s.carry) < MISS_CARRY },
    g.count { |s| f(s.launch_angle) && f(s.launch_angle) < LAUNCH_FLOOR },
    r(avg(g.map(&:face_angle)))
  ]
end

h = full.size / 2
puts "\nFade check: first-half carry med=#{r(med(full.first(h).map(&:carry)))}  second-half=#{r(med(full.last(full.size - h).map(&:carry)))}"
puts "Cold start (first 10): carry med=#{r(med(full.first(10).map(&:carry)))}  misses<#{MISS_CARRY.to_i}m=#{full.first(10).count { |s| f(s.carry) && f(s.carry) < MISS_CARRY }}"

well = full.select { |s| f(s.smash_factor) && f(s.smash_factor) >= WELL_STRUCK }
mis  = full.select { |s| f(s.smash_factor) && f(s.smash_factor) < MISHIT }
puts "\nStrike gap: well-struck (smash>=#{WELL_STRUCK}) carry med=#{r(med(well.map(&:carry)))} m (n=#{well.size})  " \
     "vs mishit (smash<#{MISHIT}) carry med=#{r(med(mis.map(&:carry)))} m (n=#{mis.size})"

n = full.size
puts "\nPLAN SCORECARD (#{FULL_CLUB}, targets from the current plan):"
puts "  launch window #{LAUNCH_WINDOW.first.to_i}-#{LAUNCH_WINDOW.last.to_i} deg: #{full.count { |s| f(s.launch_angle) && LAUNCH_WINDOW.cover?(f(s.launch_angle)) }} of #{n}"
puts "  balls under #{LAUNCH_FLOOR.to_i} deg launch: #{full.count { |s| f(s.launch_angle) && f(s.launch_angle) < LAUNCH_FLOOR }} of #{n}"
puts "  carry-window #{CARRY_WINDOW.first.to_i}-#{CARRY_WINDOW.last.to_i} m: #{full.count { |s| f(s.carry) && CARRY_WINDOW.cover?(f(s.carry)) }} of #{n}"
puts "  other-club (e.g. driver) shots: #{other.size}"

if prev_ss
  pv = prev_ss.select { |s| s.club&.label == FULL_CLUB }
  puts "\nvs previous session #{prev_ts.played_on}: " \
       "carry med #{r(med(pv.map(&:carry)))} -> #{r(med(full.map(&:carry)))}, " \
       "carry IQR #{r(iqr(pv.map(&:carry)))} -> #{r(iqr(full.map(&:carry)))}, " \
       "face mean #{r(avg(pv.map(&:face_angle)), 2)} -> #{r(avg(full.map(&:face_angle)), 2)}"
end
