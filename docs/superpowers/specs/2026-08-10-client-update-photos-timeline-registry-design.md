# Client Update — Engagement Photos, Wedding Day Timeline, Registry & Staged Rollout

**Date:** 2026-08-10
**Source:** Email from Theresa Whalen (client)
**Developer:** Jim Sherlock

---

## Context

Theresa sent four requests in one email:

1. Incorporate updated engagement photos (10 files delivered to `assets/images/`)
2. Add the wedding day timeline — all events at The Merrill Hotel
3. Link the wedding registry, and adopt a new registry message she drafted
4. Advice on sending the website and invitations to guests in two waves

Items 1–3 are site changes. Item 4 is mostly advisory, but surfaces one blocking
dependency and one small code change.

### Confirmed new facts

| Fact | Value |
|---|---|
| Ceremony | 3:15 – 3:45 p.m. |
| Cocktail Hour | 3:45 – 4:30 p.m. |
| Reception | 5:30 p.m. – 12:00 a.m. |
| Venue (all events) | The Merrill Hotel, 119 W Mississippi Dr, Muscatine, IA 52761 |
| Engagement photos | 10 JPEGs, 4400×6600 (6 portrait) and 6600×4400 (4 landscape), 6–18 MB each, ~127 MB total |

This resolves four items that were open on the pre-launch checklist: ceremony
time, reception time, ceremony venue name, and the visible placeholder banner.

---

## WO-1 — Engagement Photos

### Asset handling

The delivered files are 29-megapixel originals averaging 12 MB. They must not be
committed to the repository: GitHub Pages would serve them at full weight, and
the blobs would live in git history permanently even after later removal.

- Add `assets/images/` to `.gitignore`. Originals stay local and are archived to
  Google Drive as the master copies.
- Generate derivatives into `images/gallery/engagement/`:
  - Long edge 1600 px (standard) and 2400 px (retina)
  - JPEG quality 82 **and** WebP, served via `<picture>` with JPEG fallback
  - Target ≤ 250 KB per standard-size image
- Filenames: preserve the photographer's sequence numbers so photos can be
  traced back to originals — `eng-022.jpg`, `eng-044.jpg`, etc.

### Gallery section (`#gallery`)

Replace the single `whalen-photo-card.png` collage with a 10-cell asymmetric
mosaic. The prior 9-cell grid CSS still exists in `css/gallery.css`
(`.gallery-grid`, `.gallery-item--1` through `--9`) and is reused: extend to a
tenth cell and retune the span values for the 6-portrait / 4-landscape mix
rather than the old all-landscape stock set.

- All images `loading="lazy"` except the first (above-fold on some viewports)
- Descriptive `alt` text per image, not filler
- The caption "More to come from our engagement shoot in May" is removed — the
  shoot has happened
- The lead position goes to the photo Theresa names as their favorite

Explicitly out of scope: lightbox / click-to-enlarge. Not requested, and it
would add a JS module plus focus-trap and keyboard-navigation work.

### Our Story section (`#story`)

Place one portrait-orientation photo alongside the existing two-paragraph prose.
Two-column on desktop, stacked above the prose on mobile (≤768 px).

This photo is one of the same 10 and also appears in the gallery mosaic — it is
not an eleventh image, and it is not excluded from the grid.

### Retained

The hero keeps its background video. Swapping it for a still is a separate
decision and is not part of this work.

---

## WO-2 — Wedding Day Timeline

### Corrections to existing event cards (`#details`)

| Element | From | To |
|---|---|---|
| Ceremony time | "Three O'Clock" | "Quarter Past Three" |
| Ceremony venue | "Venue Name" | "The Merrill Hotel" |
| Reception time | "Five O'Clock" | "Half Past Five" |
| `.placeholder-note` banner | present | removed |

Times stay in the site's existing spelled-out register to match the established
typographic voice; exact clock times appear in the timeline rail below.

The Details kicker currently reads "Saturday Evening" while the ceremony is at
3:15 p.m. Change to "Saturday Afternoon & Evening".

### New: timeline rail

A vertical gold-rail timeline beneath the two event cards, headed "The Evening":

```
     ─── The Evening ───
  │
  ●  3:15 – 3:45 p.m.       The Ceremony
  │
  ●  3:45 – 4:30 p.m.       Cocktail Hour
  │
  ●  5:30 p.m. – 12:00 a.m. Reception — dinner, dancing & celebration
```

Three rows, not four. The mockup shown during design had a fourth "12:00 a.m.
Farewell" row; that wording came from the mockup rather than from the client, so
the midnight end time is rendered as the close of the reception range instead.
Nothing on this page should say anything Theresa did not say.

- Semantic markup: `<ol>` with `<li>` per moment — it is an ordered sequence
- Styling uses existing tokens: `--color-gold` rail, `--color-cream` labels,
  Cormorant Garamond for times, Montserrat for event names
- Nodes reuse the `✦` ornament already used in `.date-stamp` and dividers
- Rail collapses to a left-aligned single column at ≤768 px
- Reveal animation follows the existing `.reveal` IntersectionObserver pattern,
  staggered per row, respecting `prefers-reduced-motion`
- New styles go in `css/details.css` alongside the event grid

### Single-venue messaging

Theresa's main point is that guests do not travel between venues. Surface it twice:

- Details section, below the timeline: "All events take place at The Merrill
  Hotel — no travel between venues."
- FAQ: revise the existing indoor/outdoor answer to also state the single-venue fact.

---

## WO-3 — Registry

### Links

All three registry cards currently have `href="#"` and lead nowhere. Each is
replaced with the real public registry URL. If the actual registry count is two
rather than three, the `.registry-grid` drops to a two-card layout with the grid
constrained in width, following the `.hotel-grid--single` precedent in
`css/travel.css`.

### Message copy

Theresa's drafted message replaces the current `.registry-intro` text. Used
essentially verbatim, split into two paragraphs so it does not become a wall of
text on mobile:

> Your presence at our wedding is the greatest gift we could ask for. Since
> we've already built a home together, we're fortunate to have many of the
> things we need.
>
> We've included a small registry with a few items (because who doesn't love
> opening a few presents?), but if you'd prefer, a contribution toward our
> honeymoon or future together would be sincerely appreciated. Most of all,
> we're simply grateful to celebrate this special day with the people we love.

`.registry-intro` currently styles a single short line; it needs to handle two
paragraphs with a comfortable measure (~65ch) and centered alignment.

### Blocked on client

Cannot be completed without:

- Public registry URL for each store
- Confirmation of which stores are real — Crate & Barrel and Williams Sonoma
  are currently placeholders written during the design phase, not client-confirmed
- Honeymoon fund platform and link (Honeyfund is likewise a placeholder)

No account access or credentials are required from her — only the public
shareable links.

---

## WO-4 — Staged Invitation Rollout

The website is a single public URL with no send mechanism, so staging is
governed by who receives the link. Two changes make that work properly.

### Discoverability

Add `<meta name="robots" content="noindex, nofollow">` to `index.html` and a
`robots.txt` disallowing all crawlers. Without this, the site can be indexed and
reach guests before their wave. Removing the tag after all invitations are out
is optional — most wedding sites stay unindexed permanently.

### Guest list as the staging gate

The Apps Script backend already validates submitted names against the
`GuestList` tab and rejects anyone absent from it. This is a working staged
gate at no additional code cost: load wave-1 names only, then append wave 2
before the second send.

**Blocking dependency:** the `GuestList` tab still contains 200 sample names
from development. If wave 1 ships before Theresa's real list is loaded, every
guest receives "we couldn't find your invitation" when they try to RSVP. The
real list — at minimum the wave-1 subset — must be in place before any
invitation goes out.

### Rejected: password gate

A shared passphrase was considered and rejected. It adds friction for older
guests, is trivially forwarded, and provides no meaningful protection given the
site contains no sensitive information.

---

## WO-5 — Consistency Sweep

- **FAQ parking answer** currently promises "complimentary valet parking at both
  the ceremony and reception venues." There is now one venue, and the valet
  claim was never confirmed with The Merrill. Verify with the hotel or remove
  the claim — an unverified promise of free valet is a real guest-experience
  risk.
- **`og:image`** should point at an engagement photo now that real ones exist.
- **RSVP deadline** remains a placeholder (Saturday, October 31, 2026) and is
  flagged on-page. It needs confirming before invitations are printed, since the
  date appears on them.

---

## Open Questions for the Client

Non-blocking for WO-1/2/5, blocking for WO-3:

1. Which photo is the favorite (filename), and should all 10 go up?
2. Does the photographer's contract require a credit line on the site?
3. What happens between 4:30 p.m. (cocktail hour ends) and 5:30 p.m. (reception
   begins)? Guests will ask. Room flip, photos, open seating?
4. Is 12:00 a.m. a hard end — bar close or venue curfew?
5. Registry URLs, confirmed store names, honeymoon fund platform (WO-3 blocker).
6. Is valet parking actually offered at The Merrill, and is it complimentary?
7. Confirmed RSVP deadline date.

---

## Out of Scope — Flagged Separately

`whalenwattswedding.com` (Namecheap) is suspended for failed WHOIS verification
and is not yet pointed at the site. If invitations are printed with that URL, it
must be resolved before wave 1 goes to print. This is the longest-lead item in
the engagement and is independent of all work above.

---

## Sequencing & Estimate

| Item | Work | Est. | Blocked? |
|---|---|---|---|
| WO-2 | Timeline + details corrections | 2 hrs | No |
| WO-5 | Consistency sweep | 1 hr | Partly (valet, deadline) |
| WO-1 | Photo pipeline + gallery + story photo | 3–4 hrs | No |
| WO-4 | noindex/robots.txt + guest list guidance | 1 hr | Guest list is client-side |
| WO-3 | Registry links + copy | 1.5 hrs | Yes — needs URLs |

**Total: 8–10 hours.** WO-2 first: it is unblocked, removes the most visible
placeholder content on the site, and closes four pre-launch checklist items.
WO-3 runs last since it cannot complete until the registry links arrive.

## Verification

- Visual check of Details, Story, Gallery, and Registry at 1440 / 1024 / 768 /
  480 px
- Confirm no image over 250 KB in the deployed `images/` tree
- Confirm `assets/images/` originals are untracked by git
- Confirm `prefers-reduced-motion` suppresses the timeline stagger animation
- Deploy via the `deploy-wedding-site` skill, then curl the live site and grep
  for "Cocktail Hour" to confirm the change is live
- No backend changes in this work order, so no Apps Script redeploy and no RSVP
  smoke test required
