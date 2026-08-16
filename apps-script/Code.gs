/**
 * Whalen Wedding RSVP backend.
 * Receives form POSTs from the wedding website and appends a row
 * to the "Responses" tab of the RSVP spreadsheet.
 *
 * Guest-list gating: the submitted name is validated against the
 * "GuestList" tab before the RSVP is accepted.  No name data is
 * ever sent to the client; matching is entirely server-side.
 *
 * Staged invitations: if the GuestList tab has a column headed
 * "Invited" (case-insensitive, any position), only rows where that
 * cell is checked / TRUE / Yes / Y / X / 1 can RSVP. This lets the
 * whole guest list be entered up front and released in waves by
 * ticking boxes. If the column is absent, every listed name is
 * treated as invited (original behaviour). Names that are listed
 * but not yet invited get the same "not found" response as unknown
 * names, so nothing about the wave-2 list leaks.
 */

const SHEET_ID = '1IXK9JWYttUDPNpoaro1ozdrWmdJx3WSp647oPyQGwPA';
const SHEET_NAME = 'Responses';
const GUEST_LIST_TAB = 'GuestList';
const INVITED_HEADER = 'invited';  // matched case-insensitively against row 1
const RATE_LIMIT_MAX = 5;       // attempts per window
const RATE_LIMIT_TTL = 600;     // 10-minute window (seconds)

// ─── Entry points ────────────────────────────────────────────

function doPost(e) {
  try {
    const p = (e && e.parameter) || {};

    // Honeypot — silently accept and discard if filled
    if (p._gotcha && String(p._gotcha).length > 0) {
      return jsonResponse({ ok: true });
    }

    // Minimal server-side validation
    const name = String(p.guest_name || '').trim();
    const email = String(p.email || '').trim();
    if (!name || !email) {
      return jsonResponse({ ok: false, error: 'missing_fields' });
    }

    // Rate-limit by email to prevent brute-force name enumeration
    if (!checkRateLimit(email)) {
      return jsonResponse({
        ok: false,
        error: 'rate_limited',
        message: 'Too many attempts. Please wait a few minutes and try again.'
      });
    }

    // Validate name against guest list
    const guestList = loadGuestList();
    const matched = findGuest(name, guestList);
    if (!matched) {
      return jsonResponse({
        ok: false,
        error: 'name_not_found',
        message: "We couldn't find that name on our guest list. Please enter your name exactly as it appears on your invitation."
      });
    }

    // Validate-only mode — confirm name without recording an RSVP
    if (String(p.action) === 'validate') {
      return jsonResponse({ ok: true });
    }

    // Append the RSVP row
    const attendance =
      p.attendance === 'accepts' ? 'Yes' :
      p.attendance === 'declines' ? 'No' : '';

    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    sheet.appendRow([
      new Date(),
      name,
      email,
      attendance,
      String(p.guest_count || ''),
      String(p.dietary_restrictions || ''),
      String(p.dietary_other || ''),
      String(p.message || '')
    ]);

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error('RSVP submission failed: ' + (err && err.stack || err));
    return jsonResponse({ ok: false, error: 'server_error' });
  }
}

function doGet() {
  return jsonResponse({ ok: true, service: 'whalen-wedding-rsvp' });
}

// ─── Guest list loading & matching ───────────────────────────

function loadGuestList() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(GUEST_LIST_TAB);
  const data = sheet.getDataRange().getValues();
  const invitedCol = findInvitedColumn(data[0] || []);
  const guests = [];
  for (let i = 1; i < data.length; i++) {        // skip header
    const canonical = normalize(String(data[i][0]));
    if (!canonical) continue;
    // Staged rollout: skip rows not yet released. Excluding them here
    // (rather than flagging them) keeps findGuest's fuzzy tiers from
    // matching an un-invited name and lets the "not found" reply stay
    // identical for unknown and not-yet-invited guests.
    if (invitedCol !== -1 && !isTruthyCell(data[i][invitedCol])) continue;
    const aliasStr = String(data[i][1] || '');
    const aliases = aliasStr
      .split(',')
      .map(a => normalize(a))
      .filter(Boolean);
    guests.push({
      canonical: canonical,
      aliases: aliases,
      lastName: canonical.split(' ').slice(-1)[0]
    });
  }
  return guests;
}

/** Index of the "Invited" column in the header row, or -1 if absent. */
function findInvitedColumn(headerRow) {
  for (let c = 0; c < headerRow.length; c++) {
    if (String(headerRow[c]).trim().toLowerCase() === INVITED_HEADER) return c;
  }
  return -1;
}

/** Sheets checkbox (boolean TRUE) or a human "yes" mark. */
function isTruthyCell(v) {
  if (v === true) return true;
  const t = String(v === null || v === undefined ? '' : v).trim().toLowerCase();
  return t === 'true' || t === 'yes' || t === 'y' || t === 'x' || t === '1' || t === '✓';
}

function normalize(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z\s'\-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tiered matching:
 *   1. Exact canonical match (after normalization)
 *   2. Alias first-name + exact last-name match
 *   3. Levenshtein distance ≤ 2 on full name (catches typos)
 */
function findGuest(submittedName, guestList) {
  const input = normalize(submittedName);
  const parts = input.split(' ');
  const inputFirst = parts[0];
  const inputLast = parts.slice(1).join(' ');

  // Tier 1: exact canonical
  for (let i = 0; i < guestList.length; i++) {
    if (guestList[i].canonical === input) return guestList[i];
  }

  // Tier 2: alias first name + exact last name
  if (inputLast) {
    for (let i = 0; i < guestList.length; i++) {
      if (guestList[i].lastName === inputLast &&
          guestList[i].aliases.indexOf(inputFirst) !== -1) {
        return guestList[i];
      }
    }
  }

  // Tier 3: Levenshtein ≤ 2 on full name
  for (let i = 0; i < guestList.length; i++) {
    if (levenshtein(guestList[i].canonical, input) <= 2) return guestList[i];
  }

  return null;
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = [];
  for (let i = 0; i <= m; i++) {
    dp[i] = [i];
    for (let j = 1; j <= n; j++) {
      dp[i][j] = i === 0 ? j : 0;
    }
  }
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// ─── Rate limiting ───────────────────────────────────────────

function checkRateLimit(email) {
  const cache = CacheService.getScriptCache();
  const key = 'rsvp_rl_' + email.toLowerCase();
  const current = cache.get(key);
  const attempts = current ? parseInt(current, 10) : 0;
  if (attempts >= RATE_LIMIT_MAX) return false;
  cache.put(key, String(attempts + 1), RATE_LIMIT_TTL);
  return true;
}

// ─── Helpers ─────────────────────────────────────────────────

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
