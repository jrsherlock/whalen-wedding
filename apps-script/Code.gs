/**
 * Whalen Wedding RSVP backend.
 * Receives form POSTs from the wedding website and appends a row
 * to the "Responses" tab of the RSVP spreadsheet.
 *
 * Guest-list matching (soft): the submitted name is matched against
 * the "GuestList" tab and the result is written to the "Matched"
 * column of the response ("Sheila Cook" or "no match"). The RSVP is
 * ALWAYS accepted — a real guest typing an unexpected nickname must
 * never be bounced; an unfamiliar name is a 30-second review for the
 * couple instead. No name data is ever sent to the client.
 *
 * Optional "Invited" column: if the GuestList tab has a column with
 * that header, only ticked rows count for matching (un-ticked rows
 * show as "no match"). It no longer blocks anyone. The site is not
 * indexed and the URL only appears on invitations, so a hard gate
 * cost more (blocked guests) than it protected against.
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

    // Rate-limit by email to blunt scripted spam
    if (!checkRateLimit(email)) {
      return jsonResponse({
        ok: false,
        error: 'rate_limited',
        message: 'Too many attempts. Please wait a few minutes and try again.'
      });
    }

    // Validate-only mode ("Find My Invitation" step) — nothing to
    // record; matching is soft so this always succeeds.
    if (String(p.action) === 'validate') {
      return jsonResponse({ ok: true });
    }

    // Soft match against the guest list — recorded, never enforced
    const matched = findGuest(name, loadGuestList());
    const matchedLabel = matched ? titleCase(matched.canonical) : 'no match';

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
      String(p.message || ''),
      matchedLabel
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
  return buildGuestList(sheet.getDataRange().getValues());
}

/**
 * Turn the raw GuestList grid into matchable guest entries.
 *
 * Two layouts are supported, detected from the header row:
 *   A) "First Name" / "Last Name" columns (Theresa's working sheet).
 *      One row is a household; the first-name cell may list several
 *      people ("Sheila, John and Liam"). Each person becomes their own
 *      entry ("sheila cook") and the household as written is also an
 *      entry, so a guest can type either.
 *   B) Legacy: column A = canonical Name, column B = comma-separated
 *      Aliases (used before the real list was pasted in).
 *
 * Rows are skipped when an "Invited" column exists and is not ticked
 * (they then show as "no match" — they are not blocked).
 */
function buildGuestList(data) {
  const header = data[0] || [];
  const invitedCol = findInvitedColumn(header);
  const firstCol = findHeaderColumn(header, 'first name');
  const lastCol = findHeaderColumn(header, 'last name');
  const aliasCol = findHeaderColumn(header, 'aliases');
  const guests = [];

  for (let i = 1; i < data.length; i++) {        // skip header
    const row = data[i];
    if (invitedCol !== -1 && !isTruthyCell(row[invitedCol])) continue;

    if (firstCol === -1 || lastCol === -1) {
      // Layout B (legacy): Name | Aliases
      const canonical = normalize(String(row[0]));
      if (!canonical) continue;
      guests.push(makeGuest(canonical, splitNames(String(row[1] || '')),
                            canonical.split(' ').slice(-1)[0]));
      continue;
    }

    // Layout A: First Name | Last Name
    const firstRaw = String(row[firstCol] || '');
    const lastRaw = String(row[lastCol] || '');
    const people = splitNames(firstRaw);
    if (!people.length) continue;               // nothing to match on
    const surnames = splitNames(lastRaw);       // "Watts/Pruis" -> ["watts","pruis"]
    const extraAliases = aliasCol !== -1 ? splitNames(String(row[aliasCol] || '')) : [];
    const primarySurname = surnames[0] || '';

    // Household as written, e.g. "sheila john and liam cook"
    const household = normalize(looseName(firstRaw) + ' ' + looseName(lastRaw));
    guests.push(makeGuest(household, people.concat(extraAliases), primarySurname));

    // One entry per person and surname, e.g. "john cook"
    if (people.length > 1 || surnames.length > 1) {
      for (let k = 0; k < people.length; k++) {
        if (!surnames.length) {
          guests.push(makeGuest(people[k], [people[k]].concat(extraAliases), ''));
          continue;
        }
        for (let s = 0; s < surnames.length; s++) {
          guests.push(makeGuest(people[k] + ' ' + surnames[s],
                                [people[k]].concat(extraAliases), surnames[s]));
        }
      }
    }
  }
  return guests;
}

function makeGuest(canonical, aliases, lastName) {
  const seen = {};
  const uniq = [];
  for (let i = 0; i < aliases.length; i++) {
    const a = normalize(aliases[i]);
    if (a && !seen[a]) { seen[a] = true; uniq.push(a); }
  }
  return { canonical: canonical, aliases: uniq, lastName: lastName || '' };
}

/**
 * Split a cell that lists several people into normalized names.
 * Separators Theresa uses: "_", ",", "and", "&", "+", "/".
 * Parentheticals and ages are dropped by stripNotes/normalize:
 *   "Sheila, John and Liam"  -> ["sheila","john","liam"]
 *   "Todd_Jodi and Lyla 14"  -> ["todd","jodi","lyla"]
 *   "John (Dad)"             -> ["john"]
 */
function splitNames(str) {
  return stripNotes(str)
    .split(/,|&|\band\b|\+|\/|_/i)
    .map(normalize)
    .filter(Boolean);
}

/** Drop "(…)" notes such as "(Dad)". */
function stripNotes(str) {
  return String(str).replace(/\([^)]*\)/g, ' ');
}

/** stripNotes + turn "_" / "/" separators into spaces, for the household string. */
function looseName(str) {
  return stripNotes(str).replace(/[_\/]/g, ' ');
}

/** Index of a header (case-insensitive, trimmed) in row 1, or -1 if absent. */
function findHeaderColumn(headerRow, name) {
  for (let c = 0; c < headerRow.length; c++) {
    if (String(headerRow[c]).trim().toLowerCase() === name) return c;
  }
  return -1;
}

/** Index of the "Invited" column in the header row, or -1 if absent. */
function findInvitedColumn(headerRow) {
  return findHeaderColumn(headerRow, INVITED_HEADER);
}

/** Sheets checkbox (boolean TRUE) or a human "yes" mark. */
function isTruthyCell(v) {
  if (v === true) return true;
  const t = String(v === null || v === undefined ? '' : v).trim().toLowerCase();
  return t === 'true' || t === 'yes' || t === 'y' || t === 'x' || t === '1' || t === '✓';
}

/** "sheila cook" -> "Sheila Cook" for the Matched column. */
function titleCase(s) {
  return s.replace(/\b[a-z]/g, function (c) { return c.toUpperCase(); });
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
