#!/usr/bin/env bash
#
# Report maintenance state: main CI first, then every open Dependabot PR.
#
# Main comes first on purpose. A broken main makes every open PR red at once,
# and those failures say nothing about the bumps. Read the top of the output
# before drawing any conclusion from the bottom.
#
# Usage: .claude/skills/maintain/scripts/triage.sh
set -uo pipefail

command -v gh >/dev/null || { echo "gh not installed" >&2; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "gh not authenticated" >&2; exit 1; }

echo "=== main (ci.yml, newest first) ==="
# --workflow ci.yml matters. Without it the list fills up with Dependabot's own
# "Update #..." jobs, which are green even when CI is not.
gh run list --branch main --workflow ci.yml --limit 5 \
  --json conclusion,displayTitle,createdAt \
  --template '{{range .}}{{printf "%-8s %s  %s\n" .conclusion (timeago .createdAt) .displayTitle}}{{end}}' \
  2>/dev/null || echo "(could not read runs)"

main_state=$(gh run list --branch main --workflow ci.yml --limit 1 \
  --json conclusion --jq '.[0].conclusion' 2>/dev/null)

echo
if [ "$main_state" != "success" ]; then
  echo "!! main is '${main_state:-unknown}'. Fix main before triaging PRs."
  echo "!! Expect every PR below to be red for the same reason."
else
  echo "main is green. PR failures below are the PR's own."
fi

echo
echo "=== open Dependabot PRs ==="

prs=$(gh pr list --state open --limit 50 \
  --json number,title,author,headRefName \
  --jq '.[] | select(.author.is_bot and (.headRefName | startswith("dependabot/"))) | "\(.number)\t\(.title)"' \
  2>/dev/null)

if [ -z "$prs" ]; then
  echo "none open"
  exit 0
fi

printf '%s\n' "$prs" | while IFS=$'\t' read -r num title; do
  # Compact per-job summary, e.g. "test:fail lint:pass".
  jobs=$(gh pr checks "$num" --json name,state \
    --jq '.[] | "\(.name):\(.state|ascii_downcase)"' 2>/dev/null | sort | tr '\n' ' ')
  [ -z "$jobs" ] && jobs="(no checks reported)"

  printf '#%-4s %s\n      %s\n' "$num" "$title" "$jobs"

  # A gem or action bump cannot break the frontend job, and an npm bump cannot
  # break scan_ruby or test. Flag that mismatch: it means the base is broken.
  case "$title" in
    *" in /web"*)
      case "$jobs" in
        *scan_ruby:fail*|*test:fail*)
          echo "      ^ npm-only bump failing a Ruby job. Inherited from main, not this PR." ;;
      esac ;;
    *)
      case "$jobs" in
        *frontend:fail*)
          echo "      ^ non-npm bump failing the frontend job. Inherited from main, not this PR." ;;
      esac ;;
  esac
done

echo
echo "Next: fix main if red, then '@dependabot rebase' the PRs, then merge one at a time."
