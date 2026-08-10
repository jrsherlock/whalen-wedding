# Client Update — Photos, Timeline, Registry & Rollout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the four changes Theresa requested on 2026-08-10 — real engagement photos, the wedding day timeline, the registry message, and staged-rollout safeguards — plus the consistency fixes those changes expose.

**Architecture:** Pure static edits to a no-build-step site. `index.html` holds all sections; each section has a matching stylesheet in `css/`. Photos are transcoded once by a committed shell script into optimized derivatives under `images/gallery/engagement/`; the 127 MB of originals stay in `assets/` (gitignored) and Drive. A new `tools/verify-site.sh` provides the automated gate each task runs, since the project has no test framework.

**Tech Stack:** HTML5, CSS3 (custom properties, CSS Grid), ES module JS, ImageMagick (`magick`) for transcoding, bash for tooling, GitHub Pages for hosting.

**Spec:** `docs/superpowers/specs/2026-08-10-client-update-photos-timeline-registry-design.md`

## Global Constraints

- **No build step.** The site must remain plain HTML/CSS/ES-module JS served directly. `tools/*.sh` are manually-run tools, never wired into a build or CI.
- **No invented content.** Nothing may appear on the page that Theresa did not state. Where a fact is unknown, leave existing copy alone and flag it — do not fill the gap with plausible wording. (Prior incident: commit `7c8a177` removed a fabricated quote.)
- **Colour profile:** every image derivative must be ICC-converted to sRGB with `-intent perceptual -profile "$SRGB"`. Originals are Adobe RGB (1998); tagging alone is not sufficient.
- **Image budget:** no file in `images/` may exceed 300 KB.
- **Originals never enter git.** `assets/` is gitignored; do not `git add -f` it.
- **Design tokens only.** Use existing custom properties from `css/variables.css` (`--color-gold`, `--color-cream-muted`, `--space-lg`, `--transition-base`, …). Do not introduce raw hex values or new tokens.
- **Reduced motion:** `js/animations.js` returns early when `prefers-reduced-motion: reduce` matches, so `.reveal` elements never receive `.visible`. Any new revealed element MUST therefore be visible by default in CSS, with `.reveal` only adding the animation — never rely on `.visible` to make content appear.
- **Confirmed event facts** (use verbatim): Ceremony 3:15–3:45 p.m.; Cocktail Hour 3:45–4:30 p.m.; Reception 5:30 p.m.–12:00 a.m.; all at The Merrill Hotel, 119 W Mississippi Dr, Muscatine, IA 52761.
- **Client answers 2026-08-10:** all 10 photos go up; no photographer credit line required.
- Commit after every task. Do not push until the whole plan is reviewed.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `tools/verify-site.sh` | Automated assertions run as each task's test gate | Create (Task 1) |
| `tools/optimize-photos.sh` | One-command transcode of originals → sRGB derivatives | Create (Task 3) |
| `index.html` | All page sections | Modify (Tasks 2, 4, 5, 6, 7, 8) |
| `css/details.css` | Event cards + new timeline | Modify (Task 2) |
| `css/gallery.css` | Gallery mosaic + palette treatment | Modify (Task 4) |
| `css/story.css` | Our Story prose + new photo | Modify (Task 5) |
| `css/responsive.css` | Breakpoint overrides for timeline + 10th gallery cell | Modify (Tasks 2, 4, 5) |
| `css/registry.css` | Registry intro two-paragraph handling | Modify (Task 8) |
| `robots.txt` | Crawler exclusion | Create (Task 6) |
| `images/gallery/engagement/` | 40 optimized derivatives | Generate (Task 3) |

---

### Task 1: Verification harness

The project has no test framework. This script is the gate every later task runs. It must exit non-zero on any failure.

**Files:**
- Create: `tools/verify-site.sh`

**Interfaces:**
- Consumes: nothing
- Produces: `tools/verify-site.sh`, runnable as `bash tools/verify-site.sh`. Exits 0 on all-pass, 1 on any failure. Later tasks add no arguments — the script always checks the whole site.

- [ ] **Step 1: Write the failing test**

Create `tools/verify-site.sh`:

```bash
#!/usr/bin/env bash
# Static-site assertions for the Whalen wedding site.
# No test framework in this project — this script is the gate.
# Run from the repo root:  bash tools/verify-site.sh
set -uo pipefail
cd "$(dirname "$0")/.."

# Guard: without this, every `absent` check trivially "passes" when
# index.html is missing — a false green. Fail loudly instead.
[ -f index.html ] || { echo "ERROR: index.html not found in $(pwd) — run this from the repo"; exit 2; }
[ -d .git ]       || { echo "ERROR: not a git repo ($(pwd)) — git assertions would be meaningless"; exit 2; }

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
```

- [ ] **Step 2: Run it to verify it fails**

```bash
chmod +x tools/verify-site.sh && bash tools/verify-site.sh
```

Expected: **`passed 5, failed 11`, exit 1.** (Verified against the current tree on 2026-08-10.) The failures are the real starting state — `Venue Name` still present, `Cocktail Hour` absent, no `robots.txt`, and two oversized images (`whalen-photo-card.png` at 2.5 MB and `5-bouquet-moody.jpg` at 328 KB). This proves the assertions actually test something.

Every later task reduces the failing count. Task 6 is where it reaches zero.

Also confirm the guard works — run it from somewhere else and it must refuse rather than report a false green:

```bash
(cd /tmp && bash "$OLDPWD/tools/verify-site.sh"); echo "exit=$?"
```

Expected: `ERROR: index.html not found …`, exit 2.

- [ ] **Step 3: Confirm the passing assertions are real**

Five checks should already pass: `ceremony at The Merrill`, `CNAME intact`, `all referenced images exist`, `assets/ is gitignored`, `assets/ not tracked`. If `CNAME intact` or either `assets/` check fails, stop — the custom-domain and gitignore work from earlier is broken and must be fixed before continuing, or a later `git add` will commit 127 MB of originals.

- [ ] **Step 4: Commit**

```bash
git add tools/verify-site.sh
git commit -m "Add static-site verification harness

No test framework in this project; this script is the gate each
change runs against. Currently failing by design."
```

---

### Task 2: Wedding day timeline + Details corrections (WO-2)

**Files:**
- Modify: `index.html:358-387` (event cards + placeholder note)
- Modify: `index.html:337` (section kicker)
- Modify: `css/details.css` (append timeline styles)
- Modify: `css/responsive.css` (timeline at ≤768px)

**Interfaces:**
- Consumes: `tools/verify-site.sh` from Task 1
- Produces: `.timeline`, `.timeline-heading`, `.timeline-list`, `.timeline-item`, `.timeline-time`, `.timeline-event`, `.timeline-detail`, `.timeline-note` class names. Task 7 does not touch these.

- [ ] **Step 1: Run the gate to see the current failures**

```bash
bash tools/verify-site.sh 2>&1 | grep -E 'venue filled in|time updated|placeholder banner|cocktail|no travel|Merrill'
```

Expected: `ceremony venue filled in`, `ceremony time updated`, `reception time updated`, `details placeholder banner gone`, `cocktail hour listed`, and `single-venue note` all FAIL.

- [ ] **Step 2: Update the section kicker**

In `index.html`, line 337, replace:

```html
          <span class="section-kicker">A Winter Celebration</span>
```

with:

```html
          <span class="section-kicker">Saturday Afternoon &amp; Evening</span>
```

- [ ] **Step 3: Correct the two event cards**

In `index.html`, in the Ceremony card replace:

```html
            <p class="event-time">Three O&rsquo;Clock</p>
            <h3 class="event-name">The Ceremony</h3>
            <span class="event-name-rule"></span>
            <p class="event-venue">Venue Name</p>
```

with:

```html
            <p class="event-time">Quarter Past Three</p>
            <h3 class="event-name">The Ceremony</h3>
            <span class="event-name-rule"></span>
            <p class="event-venue">The Merrill Hotel</p>
```

In the Reception card replace:

```html
            <p class="event-time">Five O&rsquo;Clock</p>
```

with:

```html
            <p class="event-time">Half Past Five</p>
```

- [ ] **Step 4: Replace the placeholder banner with the timeline**

In `index.html`, delete this entire block:

```html
        <p class="placeholder-note reveal">
          <span class="placeholder-note-tag">Placeholder</span>
          Ceremony and reception times shown above are temporary &mdash; final times will be confirmed soon.
        </p>
```

and put this in its place:

```html
        <div class="timeline reveal">
          <h3 class="timeline-heading">The Evening</h3>
          <ol class="timeline-list">
            <li class="timeline-item">
              <span class="timeline-time">3:15 &ndash; 3:45 p.m.</span>
              <span class="timeline-event">The Ceremony</span>
            </li>
            <li class="timeline-item">
              <span class="timeline-time">3:45 &ndash; 4:30 p.m.</span>
              <span class="timeline-event">Cocktail Hour</span>
            </li>
            <li class="timeline-item">
              <span class="timeline-time">5:30 p.m. &ndash; 12:00 a.m.</span>
              <span class="timeline-event">Reception</span>
              <span class="timeline-detail">Dinner, dancing &amp; celebration</span>
            </li>
          </ol>
          <p class="timeline-note">All events take place at The Merrill Hotel &mdash; no travel between venues.</p>
        </div>
```

Three rows, not four. Do NOT add a "12:00 a.m. Farewell" row — Theresa gave a reception range ending at midnight, not a separate send-off event. Adding one would violate the no-invented-content constraint.

- [ ] **Step 5: Append the timeline styles**

Append to `css/details.css`:

```css

/* ─── Wedding Day Timeline ─── */
.timeline {
  max-width: 52rem;
  margin: var(--space-2xl) auto 0;
}

.timeline-heading {
  font-family: var(--font-body);
  font-size: 1.2rem;
  font-weight: 400;
  letter-spacing: 0.32em;
  text-transform: uppercase;
  color: var(--color-gold);
  text-align: center;
  margin: 0 0 var(--space-xl);
}

.timeline-list {
  list-style: none;
  margin: 0;
  padding: 0 0 0 var(--space-xl);
  position: relative;
}

.timeline-item {
  position: relative;
  padding-bottom: var(--space-xl);
}

.timeline-item:last-child {
  padding-bottom: 0;
}

/* Node — the site's ✦ ornament, matching .date-stamp .sep */
.timeline-item::before {
  content: '\2726';
  position: absolute;
  left: calc(var(--space-xl) * -1);
  top: 0;
  width: var(--space-lg);
  text-align: center;
  font-size: 0.9rem;
  line-height: 2.2;
  color: var(--color-gold);
}

/* Rail segment — drawn per item below its node, so it never needs to
   match the translucent .section--alt background. */
.timeline-item:not(:last-child)::after {
  content: '';
  position: absolute;
  left: calc(var(--space-xl) * -1 + var(--space-lg) / 2);
  top: 2.6rem;
  bottom: 0.4rem;
  width: 1px;
  background: var(--color-gold-border);
}

.timeline-time {
  display: block;
  font-family: var(--font-serif);
  font-size: 2rem;
  font-style: italic;
  color: var(--color-cream);
  line-height: 1.5;
}

.timeline-event {
  display: block;
  font-family: var(--font-body);
  font-size: 1.25rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--color-cream-muted);
  margin-top: var(--space-xs);
}

.timeline-detail {
  display: block;
  font-family: var(--font-serif);
  font-size: 1.6rem;
  color: var(--color-cream-dim);
  margin-top: var(--space-xs);
}

.timeline-note {
  margin: var(--space-xl) 0 0;
  text-align: center;
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 1.7rem;
  color: var(--color-cream-muted);
}
```

Note the timeline is visible by default — no `opacity: 0`. `.reveal` supplies the animation only, per the Global Constraints reduced-motion rule.

- [ ] **Step 6: Add the mobile override**

In `css/responsive.css`, inside the existing `@media (max-width: 768px)` block (the one containing `.event-grid`), add:

```css
  .timeline {
    margin-top: var(--space-xl);
  }

  .timeline-list {
    padding-left: var(--space-lg);
  }

  .timeline-item::before {
    left: calc(var(--space-lg) * -1);
    width: var(--space-md);
  }

  .timeline-item:not(:last-child)::after {
    left: calc(var(--space-lg) * -1 + var(--space-md) / 2);
  }

  .timeline-time {
    font-size: 1.8rem;
  }
```

- [ ] **Step 7: Run the gate**

```bash
bash tools/verify-site.sh
```

Expected: the six Task 2 assertions now PASS (`ceremony venue filled in`, `ceremony time updated`, `reception time updated`, `details placeholder banner gone`, `cocktail hour listed`, `single-venue note`). Image and robots assertions still FAIL — those are Tasks 3, 4 and 6.

- [ ] **Step 8: Verify visually**

```bash
python3 -m http.server 8000 >/dev/null 2>&1 &
echo "open http://localhost:8000/#details"
```

Check at 1440 / 1024 / 768 / 480 px:
- Ornament nodes align with the rail segments and the rail does not overlap any glyph
- Times read as italic serif, event names as uppercase Montserrat
- The orange placeholder banner is gone
- Nothing is invisible (confirm with reduced motion forced on in DevTools → Rendering → Emulate `prefers-reduced-motion`)

Kill the server when done: `kill %1`

- [ ] **Step 9: Commit**

```bash
git add index.html css/details.css css/responsive.css
git commit -m "Add wedding day timeline and confirm ceremony/reception details

Ceremony 3:15pm and reception 5:30pm confirmed by Theresa, both at
The Merrill Hotel. Replaces the placeholder times, the 'Venue Name'
stub and the placeholder banner. Adds a gold-rail timeline covering
ceremony, cocktail hour and reception, plus the single-venue note."
```

---

### Task 3: Photo transcode script + generate derivatives (WO-1a)

**Files:**
- Create: `tools/optimize-photos.sh`
- Generate: `images/gallery/engagement/eng-{022,044,051,052,057,078,091,106,141,149}-{800,1600}.{jpg,webp}` (40 files)

**Interfaces:**
- Consumes: originals in `assets/images/TheresaRyan_ENG_*.jpg` (gitignored)
- Produces: derivative paths in the exact form `images/gallery/engagement/eng-<NNN>-<W>.<ext>`. Task 4 and Task 5 reference these names literally.

- [ ] **Step 1: Write the script**

Create `tools/optimize-photos.sh`:

```bash
#!/usr/bin/env bash
# Transcode full-resolution engagement originals into web derivatives.
#
# Originals are Adobe RGB (1998) 300dpi print masters (~127MB total) and live
# in assets/images/ (gitignored; masters archived in Google Drive). They MUST
# be ICC-converted to sRGB or browsers render them visibly desaturated.
#
# This is a manually-run tool, NOT a build step.
# Usage:  bash tools/optimize-photos.sh
set -euo pipefail
cd "$(dirname "$0")/.."

SRC_DIR="assets/images"
OUT_DIR="images/gallery/engagement"
SRGB="/System/Library/ColorSync/Profiles/sRGB Profile.icc"

command -v magick >/dev/null || { echo "ERROR: ImageMagick not found (brew install imagemagick)"; exit 1; }
[ -f "$SRGB" ] || { echo "ERROR: sRGB ICC profile not found at $SRGB"; exit 1; }
[ -d "$SRC_DIR" ] || { echo "ERROR: $SRC_DIR not found — originals are gitignored; restore from Drive"; exit 1; }

mkdir -p "$OUT_DIR"

shopt -s nullglob
count=0
for src in "$SRC_DIR"/TheresaRyan_ENG_*.jpg; do
  # TheresaRyan_ENG_022.jpg -> 022
  num="${src##*_}"; num="${num%.jpg}"
  for w in 800 1600; do
    out="$OUT_DIR/eng-${num}-${w}"
    magick "$src" -intent perceptual -profile "$SRGB" -colorspace sRGB \
      -resize "${w}x${w}>" -strip -interlace Plane \
      -quality 80 -sampling-factor 4:2:0 "${out}.jpg"
    magick "$src" -intent perceptual -profile "$SRGB" -colorspace sRGB \
      -resize "${w}x${w}>" -strip \
      -quality 78 -define webp:method=6 "${out}.webp"
  done
  count=$((count+1))
  printf '  %s -> eng-%s-{800,1600}.{jpg,webp}\n' "$(basename "$src")" "$num"
done

echo
echo "Transcoded $count photo(s). Output in $OUT_DIR:"
du -sh "$OUT_DIR"
echo
echo "Largest derivative:"
find "$OUT_DIR" -type f -printf '%s %p\n' 2>/dev/null | sort -rn | head -1 \
  || find "$OUT_DIR" -type f -exec ls -l {} + | sort -k5 -rn | head -1
```

- [ ] **Step 2: Run it**

```bash
chmod +x tools/optimize-photos.sh && bash tools/optimize-photos.sh
```

Expected: 10 photos processed, 40 files written. Takes a couple of minutes — these are 29-megapixel sources.

- [ ] **Step 3: Verify colour conversion and budget**

```bash
# every derivative must report sRGB, NOT Adobe RGB
for f in images/gallery/engagement/*.jpg; do
  sips -g profile "$f" 2>/dev/null | tail -1
done | sort -u
```

Expected: exactly one line, `profile: sRGB IEC61966-2.1`. If any file still reports `Adobe RGB (1998)`, the profile conversion silently failed — stop and fix before continuing; this is the defect that makes the photos look dead.

```bash
# nothing over the 300KB budget
find images/gallery/engagement -type f -size +300k
```

Expected: no output. (Measured range is 14–99 KB.)

```bash
# expected file count
ls images/gallery/engagement | wc -l
```

Expected: `40`

- [ ] **Step 4: Verify metadata was stripped**

```bash
strings images/gallery/engagement/eng-022-1600.jpg \
  | grep -oiE 'GPS|Lightroom|Photoshop|Adobe RGB|Serial' | sort -u
```

Expected: no output.

- [ ] **Step 5: Confirm originals are still excluded**

```bash
git status --short assets/ ; git check-ignore -q assets && echo "assets/ correctly ignored"
```

Expected: no files listed from `assets/`, and the confirmation line prints. If `assets/` shows as untracked-but-stageable, the `.gitignore` entry is broken — fix before committing, or a `git add -A` will drop 127 MB into history.

- [ ] **Step 6: Commit**

```bash
git add tools/optimize-photos.sh images/gallery/engagement
git commit -m "Add photo transcode script and engagement derivatives

Originals are Adobe RGB print masters; the script ICC-converts to sRGB
(without which browsers render them desaturated), strips metadata and
emits 800/1600px WebP + JPEG. 40 files, all under 100KB.
Manually-run tool, not a build step."
```

---

### Task 4: Gallery rebuild — 10-cell mosaic + palette treatment (WO-1b)

**Files:**
- Modify: `index.html:653-670` (gallery section)
- Modify: `css/gallery.css` (10th cell, invert overlay to a resting veil)
- Modify: `css/responsive.css:88-96` and `:272-280` (10th cell at both breakpoints)

**Interfaces:**
- Consumes: `images/gallery/engagement/eng-<NNN>-<W>.<ext>` from Task 3
- Produces: `.gallery-item--10` class; inverted `.gallery-item::after` semantics (veil at rest, clears on hover/focus)

- [ ] **Step 1: Run the gate to see the current failures**

```bash
bash tools/verify-site.sh 2>&1 | grep -E 'collage|caption|300KB'
```

Expected: `collage retired`, `stale gallery caption removed` FAIL, and the 300KB budget FAILs on the 2.5 MB `whalen-photo-card.png`.

- [ ] **Step 2: Replace the gallery markup**

In `index.html`, replace the whole `<figure class="gallery-feature reveal">…</figure>` block with:

```html
        <div class="gallery-grid">

          <figure class="gallery-item gallery-item--1 reveal">
            <picture>
              <source type="image/webp" srcset="images/gallery/engagement/eng-022-800.webp 800w, images/gallery/engagement/eng-022-1600.webp 1600w" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 500px">
              <img src="images/gallery/engagement/eng-022-800.jpg" srcset="images/gallery/engagement/eng-022-800.jpg 800w, images/gallery/engagement/eng-022-1600.jpg 1600w" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 500px" alt="Theresa and Ryan forehead to forehead at golden hour beside a still lake" width="1600" height="1067">
            </picture>
          </figure>

          <figure class="gallery-item gallery-item--2 reveal">
            <picture>
              <source type="image/webp" srcset="images/gallery/engagement/eng-044-800.webp 800w, images/gallery/engagement/eng-044-1600.webp 1600w" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 400px">
              <img src="images/gallery/engagement/eng-044-800.jpg" srcset="images/gallery/engagement/eng-044-800.jpg 800w, images/gallery/engagement/eng-044-1600.jpg 1600w" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 400px" alt="Theresa and Ryan standing together at the water's edge" width="1067" height="1600" loading="lazy">
            </picture>
          </figure>

          <figure class="gallery-item gallery-item--3 reveal">
            <picture>
              <source type="image/webp" srcset="images/gallery/engagement/eng-051-800.webp 800w, images/gallery/engagement/eng-051-1600.webp 1600w" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 300px">
              <img src="images/gallery/engagement/eng-051-800.jpg" srcset="images/gallery/engagement/eng-051-800.jpg 800w, images/gallery/engagement/eng-051-1600.jpg 1600w" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 300px" alt="Theresa and Ryan laughing together outdoors" width="1600" height="1067" loading="lazy">
            </picture>
          </figure>

          <figure class="gallery-item gallery-item--4 reveal">
            <picture>
              <source type="image/webp" srcset="images/gallery/engagement/eng-052-800.webp 800w, images/gallery/engagement/eng-052-1600.webp 1600w" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 400px">
              <img src="images/gallery/engagement/eng-052-800.jpg" srcset="images/gallery/engagement/eng-052-800.jpg 800w, images/gallery/engagement/eng-052-1600.jpg 1600w" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 400px" alt="Theresa and Ryan walking together in the late afternoon light" width="1600" height="1067" loading="lazy">
            </picture>
          </figure>

          <figure class="gallery-item gallery-item--5 reveal">
            <picture>
              <source type="image/webp" srcset="images/gallery/engagement/eng-057-800.webp 800w, images/gallery/engagement/eng-057-1600.webp 1600w" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 300px">
              <img src="images/gallery/engagement/eng-057-800.jpg" srcset="images/gallery/engagement/eng-057-800.jpg 800w, images/gallery/engagement/eng-057-1600.jpg 1600w" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 300px" alt="Portrait of Theresa and Ryan close together" width="1067" height="1600" loading="lazy">
            </picture>
          </figure>

          <figure class="gallery-item gallery-item--6 reveal">
            <picture>
              <source type="image/webp" srcset="images/gallery/engagement/eng-078-800.webp 800w, images/gallery/engagement/eng-078-1600.webp 1600w" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 500px">
              <img src="images/gallery/engagement/eng-078-800.jpg" srcset="images/gallery/engagement/eng-078-800.jpg 800w, images/gallery/engagement/eng-078-1600.jpg 1600w" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 500px" alt="Theresa and Ryan sharing a quiet moment" width="1067" height="1600" loading="lazy">
            </picture>
          </figure>

          <figure class="gallery-item gallery-item--7 reveal">
            <picture>
              <source type="image/webp" srcset="images/gallery/engagement/eng-091-800.webp 800w, images/gallery/engagement/eng-091-1600.webp 1600w" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 400px">
              <img src="images/gallery/engagement/eng-091-800.jpg" srcset="images/gallery/engagement/eng-091-800.jpg 800w, images/gallery/engagement/eng-091-1600.jpg 1600w" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 400px" alt="Theresa and Ryan holding hands, sunlight behind them" width="1600" height="1067" loading="lazy">
            </picture>
          </figure>

          <figure class="gallery-item gallery-item--8 reveal">
            <picture>
              <source type="image/webp" srcset="images/gallery/engagement/eng-106-800.webp 800w, images/gallery/engagement/eng-106-1600.webp 1600w" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 400px">
              <img src="images/gallery/engagement/eng-106-800.jpg" srcset="images/gallery/engagement/eng-106-800.jpg 800w, images/gallery/engagement/eng-106-1600.jpg 1600w" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 400px" alt="Theresa and Ryan embracing outdoors" width="1067" height="1600" loading="lazy">
            </picture>
          </figure>

          <figure class="gallery-item gallery-item--9 reveal">
            <picture>
              <source type="image/webp" srcset="images/gallery/engagement/eng-141-800.webp 800w, images/gallery/engagement/eng-141-1600.webp 1600w" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 400px">
              <img src="images/gallery/engagement/eng-141-800.jpg" srcset="images/gallery/engagement/eng-141-800.jpg 800w, images/gallery/engagement/eng-141-1600.jpg 1600w" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 400px" alt="Theresa and Ryan smiling at one another" width="1067" height="1600" loading="lazy">
            </picture>
          </figure>

          <figure class="gallery-item gallery-item--10 reveal">
            <picture>
              <source type="image/webp" srcset="images/gallery/engagement/eng-149-800.webp 800w, images/gallery/engagement/eng-149-1600.webp 1600w" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 400px">
              <img src="images/gallery/engagement/eng-149-800.jpg" srcset="images/gallery/engagement/eng-149-800.jpg 800w, images/gallery/engagement/eng-149-1600.jpg 1600w" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 400px" alt="Theresa and Ryan together as the sun sets" width="1600" height="1067" loading="lazy">
            </picture>
          </figure>

        </div>
```

Note item 1 has **no** `loading="lazy"` — it is above the fold on tall viewports. All nine others do.

The `alt` text above describes composition generically because the implementer may not have viewed each photo. **Before committing, open each derivative and rewrite any `alt` that does not match what the photo actually shows.** Inaccurate alt text is worse than generic alt text.

- [ ] **Step 3: Delete the retired collage and the unreferenced stock photos**

```bash
git rm images/gallery/whalen-photo-card.png
git rm images/gallery/[1-9]-*.jpg
```

The collage is the 2.5 MB file breaking the size budget. The nine stock photos (`1-couple-silhouette.jpg` … `9-reception-golden.jpg`) were placeholders from the design phase, are unreferenced once this task lands, and one of them — `5-bouquet-moody.jpg` at 328 KB — **also exceeds the 300 KB budget**, so the gate cannot go green while it remains. Removing all ten files together is the correct cleanup.

Confirm nothing still references them before deleting:

```bash
grep -nE 'whalen-photo-card|gallery/[1-9]-' index.html css/*.js js/*.js 2>/dev/null
```

Expected: no output. (`css/gallery.css` retains the old `.gallery-placeholder` rules — that is dead CSS, not a reference, and is left alone.)

- [ ] **Step 4: Add the 10th cell and invert the overlay**

In `css/gallery.css`, after the `.gallery-item--9` line, add:

```css
.gallery-item--10 { grid-column: span 4; grid-row: span 1; }
```

Then replace the existing hover-overlay rules. Find and replace this block:

```css
.gallery-item:hover img {
  transform: scale(1.04);
  filter: brightness(0.95) saturate(1);
}
```

with:

```css
/* Resting treatment — the engagement photos are bright, warm and high-key;
   this settles them into the navy winter palette without altering the
   photographer's work. Full colour returns on hover/focus. */
.gallery-item img {
  filter: saturate(0.9) brightness(0.86) contrast(1.03);
  transition: filter var(--transition-base), transform var(--transition-base);
}

.gallery-item:hover img,
.gallery-item:focus-within img {
  transform: scale(1.04);
  filter: saturate(1) brightness(1) contrast(1);
}
```

Then change the overlay from hover-on to rest-on. Replace:

```css
  opacity: 0;
  transition: opacity var(--transition-base);
  pointer-events: none;
}

.gallery-item:hover::after {
  opacity: 1;
}
```

with:

```css
  opacity: 1;
  transition: opacity var(--transition-base);
  pointer-events: none;
}

.gallery-item:hover::after,
.gallery-item:focus-within::after {
  opacity: 0;
}

/* Touch devices get no hover — lighten the resting veil so photos read
   properly without interaction. */
@media (hover: none) {
  .gallery-item img {
    filter: saturate(0.96) brightness(0.94);
  }
  .gallery-item::after {
    opacity: 0.55;
  }
}
```

And change the `::after` gradient itself from a bottom-fade to a navy veil. Replace:

```css
  background:
    linear-gradient(180deg, transparent 50%, rgba(4, 6, 15, 0.7) 100%),
    radial-gradient(ellipse at center, transparent 60%, rgba(212, 176, 98, 0.08) 100%);
```

with:

```css
  background:
    linear-gradient(180deg, rgba(7, 11, 28, 0.30) 0%, rgba(4, 6, 15, 0.55) 100%),
    radial-gradient(ellipse at center, transparent 55%, rgba(212, 176, 98, 0.10) 100%);
```

- [ ] **Step 5: Add the 10th cell at both responsive breakpoints**

In `css/responsive.css`, in the `max-width: 1024px` block after `.gallery-item--9`, add:

```css
  .gallery-item--10 { grid-column: span 4; grid-row: span 1; }
```

In the `max-width: 480px` block after its `.gallery-item--9`, add:

```css
  .gallery-item--10 { grid-column: span 6; grid-row: span 1; }
```

At 1024px items 7–9 each span 4 of 12, so item 10 starting a new row of one is acceptable; confirm visually in Step 7 and adjust items 7–10 to `span 3` each if the trailing single cell looks unbalanced.

- [ ] **Step 6: Run the gate**

```bash
bash tools/verify-site.sh
```

Expected: `collage retired`, `stale gallery caption removed`, `all referenced images exist` and `all images under 300KB` now PASS. Only the robots/noindex assertions should still fail.

- [ ] **Step 7: Verify visually**

```bash
python3 -m http.server 8000 >/dev/null 2>&1 &
echo "open http://localhost:8000/#gallery"
```

Check at 1440 / 1024 / 768 / 480 px:
- No gaps or orphaned cells in the mosaic; portrait images are not badly cropped
- Photos read as toned-but-natural at rest, and lift to full colour on hover
- On a touch viewport (DevTools device mode) photos are clearly legible without hovering
- Network tab: WebP is served, not JPEG; no image over 100 KB

Kill the server: `kill %1`

- [ ] **Step 8: Commit**

```bash
git add index.html css/gallery.css css/responsive.css
git add -u images/gallery   # stages the git rm deletions from Step 3
git commit -m "Replace collage with 10-photo engagement gallery

All 10 photos per Theresa; no credit line required. Serves WebP with
JPEG fallback at 800/1600px. Inverts the gallery overlay to a resting
navy veil so the bright summer photos settle into the winter palette,
clearing to full colour on hover/focus, with a lighter resting state
on touch devices. Removes the collage and the nine unreferenced stock
placeholders."
```

---

### Task 5: Our Story photo (WO-1c)

**Files:**
- Modify: `index.html:313-327` (`.story-prose`)
- Modify: `css/story.css`
- Modify: `css/responsive.css` (stack at ≤768px)

**Interfaces:**
- Consumes: `images/gallery/engagement/eng-057-*.{jpg,webp}` from Task 3
- Produces: `.story-layout`, `.story-figure` class names

- [ ] **Step 1: Wrap the prose and add the photo**

In `index.html`, replace the opening `<div class="story-prose">` with `<div class="story-layout">`, then structure as:

```html
        <div class="story-layout">

          <figure class="story-figure reveal">
            <picture>
              <source type="image/webp" srcset="images/gallery/engagement/eng-057-800.webp 800w, images/gallery/engagement/eng-057-1600.webp 1600w" sizes="(max-width: 768px) 100vw, 420px">
              <img src="images/gallery/engagement/eng-057-800.jpg" srcset="images/gallery/engagement/eng-057-800.jpg 800w, images/gallery/engagement/eng-057-1600.jpg 1600w" sizes="(max-width: 768px) 100vw, 420px" alt="Theresa and Ryan together, photographed during their engagement session" width="1067" height="1600" loading="lazy">
            </picture>
          </figure>

          <div class="story-prose">
            <!-- the two existing .story-paragraph elements and the
                 .story-divider between them, unchanged -->
          </div>

        </div>
```

Keep both existing paragraphs and the divider exactly as they are — the copy was settled in commit `613fef8` and must not change.

- [ ] **Step 2: Add the layout styles**

Append to `css/story.css`:

```css

/* ─── Story layout with photo ─── */
.story-layout {
  display: grid;
  grid-template-columns: 42rem 1fr;
  gap: var(--space-2xl);
  align-items: center;
  max-width: var(--content-wide);
  margin: 0 auto;
}

.story-figure {
  margin: 0;
  position: relative;
  border: 1px solid var(--color-gold-border-soft);
  overflow: hidden;
}

.story-figure img {
  display: block;
  width: 100%;
  height: auto;
  filter: saturate(0.9) brightness(0.88) contrast(1.03);
  transition: filter var(--transition-base);
}

.story-figure:hover img {
  filter: saturate(1) brightness(1) contrast(1);
}

@media (hover: none) {
  .story-figure img {
    filter: saturate(0.96) brightness(0.94);
  }
}
```

The treatment matches the gallery so the two sections read as one system.

- [ ] **Step 3: Stack on mobile**

In `css/responsive.css`, in the `max-width: 768px` block add:

```css
  .story-layout {
    grid-template-columns: 1fr;
    gap: var(--space-xl);
  }

  .story-figure {
    max-width: 42rem;
    margin: 0 auto;
  }
```

- [ ] **Step 4: Run the gate**

```bash
bash tools/verify-site.sh
```

Expected: no regressions — same pass count as after Task 4, plus `all referenced images exist` still passing with the new reference.

- [ ] **Step 5: Verify visually**

Serve and check `#story` at 1440 / 1024 / 768 / 480 px. The photo and prose should be vertically centred against each other on desktop and stacked with the photo on top on mobile. Confirm the prose copy is unchanged from `613fef8`.

- [ ] **Step 6: Commit**

```bash
git add index.html css/story.css css/responsive.css
git commit -m "Add engagement photo to Our Story section

Two-column on desktop, stacked on mobile. Same resting treatment as
the gallery so the two sections read as one system. Prose unchanged."
```

---

### Task 6: Discoverability — noindex + robots.txt (WO-4)

**Files:**
- Modify: `index.html:7` (after the description meta)
- Create: `robots.txt`

**Interfaces:**
- Consumes: nothing
- Produces: nothing consumed downstream

- [ ] **Step 1: Run the gate**

```bash
bash tools/verify-site.sh 2>&1 | grep -E 'noindex|robots'
```

Expected: both FAIL.

- [ ] **Step 2: Add the robots meta**

In `index.html`, immediately after the `<meta name="description" …>` line, add:

```html
  <meta name="robots" content="noindex, nofollow">
```

- [ ] **Step 3: Create robots.txt**

```
User-agent: *
Disallow: /
```

- [ ] **Step 4: Run the gate**

```bash
bash tools/verify-site.sh
```

Expected: **all assertions PASS**, exit 0. This is the first fully green run.

- [ ] **Step 5: Commit**

```bash
git add index.html robots.txt
git commit -m "Exclude site from search indexing

The invitations go out in waves; nothing should surface the site to
guests ahead of their wave. Remove after all invitations are sent if
the couple want the site indexed, though most wedding sites stay
unindexed permanently."
```

---

### Task 7: Consistency sweep (WO-5)

**Files:**
- Modify: `index.html:708-713` (FAQ parking answer)
- Modify: `index.html:11` (og:image)

**Interfaces:**
- Consumes: `images/gallery/engagement/eng-022-1600.jpg` from Task 3
- Produces: nothing consumed downstream

- [ ] **Step 1: Fix the parking answer**

The current answer promises *"Complimentary valet parking will be available at both the ceremony and reception venues."* There is now one venue, and the valet claim was written during the design phase and never confirmed with The Merrill.

Per the no-invented-content constraint, replace it with something true regardless of what the hotel offers:

```html
          <details class="faq-item reveal">
            <summary class="faq-question">Is there parking at the venue?</summary>
            <div class="faq-answer">
              <p>The Merrill Hotel has on-site parking for guests. Because the ceremony, cocktail hour and reception all take place at the hotel, there is no need to move your car during the evening.</p>
            </div>
          </details>
```

Add to the client follow-up list: confirm whether valet is offered and whether it is complimentary, then restore the specific wording if so.

- [ ] **Step 2: Add og:image**

In `index.html`, after the `og:description` line, add:

```html
  <meta property="og:image" content="https://whalenwattswedding.com/images/gallery/engagement/eng-022-1600.jpg">
  <meta property="og:url" content="https://whalenwattswedding.com/">
```

An absolute URL is required — Open Graph does not accept relative paths.

- [ ] **Step 3: Add the single-venue fact to the indoor/outdoor FAQ**

The spec requires the single-venue point to appear in the FAQ as well as the Details section. Replace the existing indoor/outdoor answer:

```html
          <details class="faq-item reveal">
            <summary class="faq-question">Will the ceremony and reception be indoors or outdoors?</summary>
            <div class="faq-answer">
              <p>Everything will be held indoors at The Merrill Hotel &mdash; ceremony, cocktail hour and reception all under one roof, so there is no travel between venues and no need to worry about the winter weather. Cozy, candlelit, and warm.</p>
            </div>
          </details>
```

- [ ] **Step 4: Note what is NOT being changed**

Leave the RSVP deadline placeholder (`Saturday, October 31, 2026`, index.html ~line 494) exactly as it is, including its `.placeholder-note placeholder-note--inline` callout. The date is unconfirmed and the callout is honest. The verification harness deliberately asserts on the Details-specific wording rather than the shared `placeholder-note-tag` class precisely so this can stay.

- [ ] **Step 5: Run the gate**

```bash
bash tools/verify-site.sh
```

Expected: all PASS, exit 0.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "Consistency sweep: parking answer, single-venue FAQ, og:image

Parking answer no longer promises unconfirmed complimentary valet or
refers to two venues. Indoor/outdoor answer now carries the
single-venue fact. Adds a real engagement photo as the share image.
RSVP deadline placeholder intentionally left in place - still
unconfirmed by the client."
```

---

### Task 8: Registry message copy (WO-3, partial)

**Blocked:** the registry URLs have not arrived. This task ships Theresa's message only. The three `href="#"` links stay dead until she sends them — do **not** invent or guess retailer URLs.

**Files:**
- Modify: `index.html:442-444` (`.registry-intro`)
- Modify: `css/registry.css`

**Interfaces:**
- Consumes: nothing
- Produces: nothing consumed downstream

- [ ] **Step 1: Replace the intro copy**

In `index.html`, replace:

```html
        <p class="registry-intro reveal">
          Your presence is the greatest gift &mdash; truly. For those who&rsquo;ve asked, we&rsquo;ve gathered a few favorite places to shop and a fund for our honeymoon.
        </p>
```

with Theresa's message, split into two paragraphs:

```html
        <div class="registry-intro reveal">
          <p>Your presence at our wedding is the greatest gift we could ask for. Since we&rsquo;ve already built a home together, we&rsquo;re fortunate to have many of the things we need.</p>
          <p>We&rsquo;ve included a small registry with a few items (because who doesn&rsquo;t love opening a few presents?), but if you&rsquo;d prefer, a contribution toward our honeymoon or future together would be sincerely appreciated. Most of all, we&rsquo;re simply grateful to celebrate this special day with the people we love.</p>
        </div>
```

This is her wording verbatim, with only the paragraph break added. Do not edit it for style.

- [ ] **Step 2: Update the intro styles**

`.registry-intro` was written for a single `<p>` and is now a `<div>` wrapping two. In `css/registry.css`, find the `.registry-intro` rule and ensure it contains:

```css
.registry-intro {
  max-width: 62ch;
  margin: 0 auto var(--space-2xl);
  text-align: center;
}

.registry-intro p {
  margin: 0;
}

.registry-intro p + p {
  margin-top: var(--space-md);
}
```

Preserve whatever `font-family`, `font-size`, `line-height` and `color` the existing rule already declares — move those onto `.registry-intro p` if they do not inherit correctly.

- [ ] **Step 3: Run the gate**

```bash
bash tools/verify-site.sh
```

Expected: all PASS.

- [ ] **Step 4: Verify visually**

Serve and check `#registry` at 1440 / 768 / 480 px. Both paragraphs should be centred, comfortably measured, and not run to full container width.

- [ ] **Step 5: Commit**

```bash
git add index.html css/registry.css
git commit -m "Use Theresa's registry message

Her wording verbatim, split into two paragraphs for mobile
readability. Registry links remain placeholders - still waiting on
the actual URLs from the client."
```

---

## Final Verification

- [ ] **Full gate green**

```bash
bash tools/verify-site.sh
```

Expected: exit 0, zero failures.

- [ ] **Reduced motion**

Serve locally, enable DevTools → Rendering → Emulate `prefers-reduced-motion: reduce`, reload, and scroll the whole page. Every section must be fully visible. `js/animations.js` returns early under reduced motion, so anything depending on `.visible` to appear would be invisible — this check catches that class of bug.

- [ ] **Page weight**

DevTools Network, hard reload, scroll to the bottom. Total transferred should be roughly 1–2 MB including the 5.9 MB-on-disk hero video's initial range requests. No single image over 100 KB.

- [ ] **Deploy**

Use the `deploy-wedding-site` skill. Then:

```bash
curl -s https://whalenwattswedding.com | grep -c 'Cocktail Hour'   # expect 1
curl -sI https://whalenwattswedding.com/images/gallery/engagement/eng-022-800.webp | head -1
curl -s https://whalenwattswedding.com/robots.txt
```

No backend changes in this plan — no Apps Script redeploy, no RSVP smoke test.

- [ ] **Update the spec's open-questions list** with anything still outstanding: favorite photo for the lead cell, the 4:30–5:30 gap, midnight hard-stop, registry URLs, valet confirmation, RSVP deadline.

---

## Still Blocked After This Plan

| Item | Blocker | Impact |
|---|---|---|
| Registry links | Client has not sent URLs | Three dead `href="#"` links remain live on the page |
| `GuestList` tab | Still 200 sample names | **Wave 1 cannot go out** — every guest would fail RSVP lookup |
| RSVP deadline | Unconfirmed | Placeholder stays visible; date is printed on invitations |
| Valet parking | Unconfirmed with hotel | Generic parking answer shipped instead |

The `GuestList` item is not a code task and is the hardest blocker to the invitations actually going out.
