#!/usr/bin/env bash
# Stamp a build version into index.html.
#
# The site has no build step, so CSS and JS are served under stable filenames
# and browsers cache them aggressively. This stamp is how you tell whether the
# page in front of you is the one that was just deployed or a stale copy.
#
# Run it immediately before deploying, to either target:
#
#   tools/stamp-version.sh && git commit -am "..." && git push origin main
#   tools/stamp-version.sh && netlify deploy --dir=. --prod --site <id>
#
# The version is <UTC date>.<UTC time>, plus the short SHA of HEAD. The SHA
# names the last *committed* state, so when you stamp-then-commit it refers to
# the commit before this one — the timestamp is the authoritative part.

set -euo pipefail

cd "$(dirname "$0")/.."

STAMP="$(date -u '+%Y.%m.%d.%H%M')"
if SHA="$(git rev-parse --short HEAD 2>/dev/null)"; then
  VERSION="${STAMP}-${SHA}"
else
  VERSION="${STAMP}"
fi

# <meta name="build-version" content="...">
perl -0pi -e "s{(<meta name=\"build-version\" content=\")[^\"]*(\">)}{\${1}${VERSION}\${2}}" index.html

# <p class="footer-version" id="build-version">...</p>
perl -0pi -e "s{(<p class=\"footer-version\" id=\"build-version\">)[^<]*(</p>)}{\${1}${VERSION}\${2}}" index.html

# Verify both landed, so a silent regex miss can never ship as "stamped".
meta_count=$(grep -c "content=\"${VERSION}\"" index.html || true)
body_count=$(grep -c ">${VERSION}</p>" index.html || true)
if [ "$meta_count" -ne 1 ] || [ "$body_count" -ne 1 ]; then
  echo "stamp-version: FAILED to stamp (meta=$meta_count body=$body_count)" >&2
  exit 1
fi

echo "stamped ${VERSION}"
