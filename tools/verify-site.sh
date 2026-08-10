#!/usr/bin/env bash
# Static-site assertions for the Whalen wedding site.
# No test framework in this project — this script is the gate.
# Run from the repo root:  bash tools/verify-site.sh
set -uo pipefail
cd "$(dirname "$0")/.."

# Guard: without this, every `absent` check trivially "passes" when
# index.html is missing — a false green. Fail loudly instead.
[ -f index.html ] || { echo "ERROR: index.html not found in $(pwd) — run this from the repo"; exit 2; }
# Use rev-parse, NOT `[ -d .git ]`: in a git worktree .git is a FILE holding a
# gitdir pointer, so the -d test would reject the worktree this plan runs in.
git rev-parse --git-dir >/dev/null 2>&1 \
  || { echo "ERROR: not a git repo ($(pwd)) — git assertions would be meaningless"; exit 2; }

PASS=0; FAIL=0
ok()   { printf '  \033[32mPASS\033[0m  %s\n' "$1"; PASS=$((PASS+1)); }
bad()  { printf '  \033[31mFAIL\033[0m  %s\n' "$1"; FAIL=$((FAIL+1)); }

# absent <label> <pattern> — index.html must NOT contain pattern
absent() {
  if grep -qF "$2" index.html; then bad "$1 (found: '$2')"; else ok "$1"; fi
}
# present <label> <pattern> — index.html MUST contain pattern
present() {
  if grep -qF "$2" index.html; then ok "$1"; else bad "$1 (missing: '$2')"; fi
}

echo "── Placeholder content removed ──"
absent "ceremony venue filled in"        'Venue Name'
absent "ceremony time updated"           "Three O&rsquo;Clock"
absent "reception time updated"          "Five O&rsquo;Clock"
absent "details placeholder banner gone" 'Ceremony and reception times shown above are temporary'
absent "stale gallery caption removed"   'More to come from our engagement shoot'
absent "collage retired"                 'whalen-photo-card.png'

# NOTE: index.html has TWO .placeholder-note callouts — the Details one
# (removed in Task 2) and the RSVP deadline one (line ~494), which stays
# until the client confirms the date. Never assert on the shared
# 'placeholder-note-tag' class; it would be unsatisfiable while the
# honest RSVP placeholder remains.

echo "── Confirmed facts present ──"
present "cocktail hour listed"           'Cocktail Hour'
present "single-venue note"              'no travel between venues'
present "ceremony at The Merrill"        'The Merrill Hotel'

echo "── Discoverability ──"
present "noindex meta"                   'content="noindex, nofollow"'
if [ -f robots.txt ] && grep -q 'Disallow: /' robots.txt; then
  ok "robots.txt disallows crawlers"
else
  bad "robots.txt missing or does not disallow"
fi

echo "── Custom domain ──"
if [ -f CNAME ] && [ "$(tr -d '[:space:]' < CNAME)" = "whalenwattswedding.com" ]; then
  ok "CNAME intact"
else
  bad "CNAME missing or wrong"
fi

echo "── Images ──"
# every locally-referenced image/source in index.html must exist on disk
missing=0
grep -oE '(src|srcset)="[^"]+"' index.html \
  | sed -E 's/^(src|srcset)="//; s/"$//' \
  | tr ',' '\n' \
  | sed -E 's/^[[:space:]]+//; s/[[:space:]]+[0-9]+w$//' \
  | grep -E '^images/' | sort -u | while read -r f; do
      [ -f "$f" ] || { echo "    missing: $f"; exit 1; }
    done || missing=1
[ "$missing" -eq 0 ] && ok "all referenced images exist" || bad "referenced image(s) missing from disk"

# size budget
if [ -d images ]; then
  big=$(find images -type f \( -name '*.jpg' -o -name '*.webp' -o -name '*.png' \) -size +300k)
  if [ -n "$big" ]; then bad "image(s) over 300KB:"; echo "$big" | sed 's/^/    /'; else ok "all images under 300KB"; fi
fi

echo "── Originals excluded from git ──"
if git check-ignore -q assets 2>/dev/null; then ok "assets/ is gitignored"; else bad "assets/ NOT gitignored"; fi
if git ls-files --error-unmatch assets >/dev/null 2>&1; then bad "assets/ is tracked in git"; else ok "assets/ not tracked"; fi

echo
printf 'passed %d, failed %d\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
