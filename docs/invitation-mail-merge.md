# Sending the invitations with YAMM

How Theresa sends the wedding-website invitation to the guest list in waves,
using **YAMM (Yet Another Mail Merge)**, a free Google Sheets add-on.

Everything runs off the existing **GuestList** tab of the RSVP spreadsheet —
no export, no second list to keep in sync.

---

## One-time setup

1. **Install YAMM.** In the RSVP spreadsheet: `Extensions → Add-ons → Get add-ons`,
   search **Yet Another Mail Merge**, install, and grant access. It must be
   installed by whoever will send the emails — the sends come *from that
   person's Gmail account*, so this should be Theresa (or the shared
   `Whaleywatts2026@gmail.com` account, if they'd rather the invites come from
   there).
2. **Check the columns.** YAMM merges by column header. GuestList already has:
   - `First Name` — used for the greeting (`{{First Name}}`)
   - `EMAIL` — the recipient(s). Multiple addresses in one cell are fine when
     separated by commas; several rows have two or three.
   - `Wave` — which batch this household is in. **Theresa fills this in.**
3. **Fill in `Wave`.** `1` = family, close friends, and anyone traveling.
   `2` = everyone else. (More waves are fine — just number them.)
4. **Check for gaps.** Any row with no address in `EMAIL` can't be emailed and
   needs a paper invitation or a phone call. As of 2026-08-27 that is
   Robert Bertellotti, plus the four unfinished rows at the bottom of the sheet.

---

## Sending a wave

1. In GuestList, filter to the wave you're sending: click the filter icon on
   the `Wave` column and tick only `1`.
2. `Extensions → Yet Another Mail Merge → Start Mail Merge`.
3. Pick the Gmail draft to use as the template (see below), send yourself a
   test first, then **Send emails**.
4. YAMM adds a **Merge status** column to the sheet showing `EMAIL_SENT`,
   `EMAIL_OPENED`, `EMAIL_CLICKED`, or `EMAIL_BOUNCED` per row.

**Free-tier limit: 50 emails per day.** With ~90 households that's roughly two
days per full send, or split the waves across days. YAMM Personal (about $25/yr)
raises it to 400/day if we'd rather do it in one sitting.

**A caution about "opened":** Apple Mail and several other clients either block
or auto-trigger the tracking pixel, so `EMAIL_OPENED` is a hint, not proof.
The **Responses** tab is the real record of who has replied.

---

## The invitation email

Write this as a **draft in Gmail** (YAMM reads the draft as its template).
`{{First Name}}` is replaced per row automatically.

**Subject:** Theresa & Ryan are getting married — December 5, 2026

> Dear {{First Name}},
>
> We're getting married! We would be so happy to have you with us on
> **Saturday, December 5, 2026** at **The Merrill Hotel** in Muscatine, Iowa.
>
> We've put everything you'll need on our wedding website — the schedule for
> the day, hotel room block, dinner menu, registry, and our RSVP form:
>
> **https://whalenwattswedding.com**
>
> Please RSVP through the website by **Saturday, October 31, 2026**. If anyone
> in your party has a food allergy or dietary restriction, there's a spot to
> tell us when you reply.
>
> A formal invitation is on its way to your mailbox as well. We can't wait to
> celebrate with you!
>
> With love,
> Theresa & Ryan

Notes for whoever sends it:

- The website link must be the live domain, not the staging preview.
- Send yourself a test through YAMM before every wave and read it on a phone.
- Keep the same draft for later waves so the wording stays identical.

---

## What the RSVP form does with the reply

Every RSVP lands on the **Responses** tab with the guest's name, email,
attendance, party size, dietary notes, and message — plus three columns the
backend fills in automatically:

| Column | What it means |
|---|---|
| `Matched` | The GuestList entry the submitted name matched, or `no match` |
| `Invited Count` | The party size from that household's invitation |
| `Count Check` | `OK`, or `OVER — 4 vs 2 invited` when someone RSVPs for more people than were invited |

Nobody is turned away by the form — a guest typing a nickname the guest list
doesn't know still gets through, and the couple sees the flag and follows up.
