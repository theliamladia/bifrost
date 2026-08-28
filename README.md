# Digital Footprint Self-Check

A web app that shows a person their own online exposure and hands them a
remediation worklist — source, what's exposed, and the opt-out link or steps.

**This is a self-exposure scanner, not a people-search tool.** The single
design constraint everything else follows from: it only runs on the person
running it, verified by a contact they control. It must not function as an
arbitrary-target lookup, and the architecture — not just the UI copy — is what
enforces that.

## How the constraint is enforced

| Rule | Where it lives |
| --- | --- |
| No query runs before a code is confirmed | `requireVerifiedSession` (`server/src/lib/auth.js`) gates `POST /api/scan` |
| The searched name is fixed at verification time | The name is read from the session, never from the scan request body (`server/src/routes/scan.js`) |
| One verification is not an unlimited search box | Sessions expire in 30 minutes and allow 5 scans |
| A code cannot be brute-forced or replayed | Codes are scrypt-hashed with a per-challenge salt, 5 attempts, single-use challenge |
| Looking up anyone else requires admin approval | An admin-issued grant, pinned to one subject name *and* one requester contact, single-use, off entirely unless `ADMIN_API_KEY` is set |
| The operator cannot self-authorize | The grant is issued through `/api/admin/grants` with the admin key and a recorded reason; the requester still has to pass OTP on their own contact |

`server/test/gate.test.js` tests these as HTTP behavior, including that a
verified session pointed at `{"name": "Someone Else"}` still scans only the name
it was verified for.

### Verification honesty

Controlling an email address or phone number proves control of that contact.
It does **not** prove the contact belongs to the name typed into the box. This
stops casual misuse; it will not stop a determined actor. The UI says exactly
that at every stage (`VerificationHonestyNote`), and the verify response carries
the same sentence. Stronger identity proofing (e.g. Stripe Identity) is a later
option, not something this version claims to do.

## Flow

1. Enter a name to check plus an email or phone you control, and confirm the
   self-check attestation.
2. A 6-digit code is sent to that contact. Nothing is queried yet.
3. Enter the code. On success the scan fires immediately.
4. Results render as a worklist: each finding shows its source, what is
   exposed, and an opt-out link or removal steps — to-do items, not a profile
   card.

## Stack

- **Frontend** — React (Vite). One flow, three screens.
- **Backend** — Node/Express. Required, not optional: it holds the API keys and
  sends the OTP. The browser never talks to SerpAPI, Twilio, or Postmark.
- **OTP** — Twilio (SMS), Postmark or SES (email). A `console` provider prints
  codes to the server log for local development.

## Data sources

- **Google organic via SerpAPI.** Paid per query, ToS-safe. Nothing here
  scrapes a search page.
- **Directory/broker results are prioritized** — a second SerpAPI query targets
  the broker domains specifically, because each broker result carries an opt-out
  path and is therefore actionable. Broker hits sort to the top of the worklist.
- **v1 excludes Facebook-via-Google-Images**: low reliability, high false
  positive rate, and the most sensitive data class. Revisit only with real
  signal.

The broker catalog (`server/src/sources/brokers.js`) currently covers 18 sites
including Whitepages, Spokeo, BeenVerified, Radaris, TruePeopleSearch,
FastPeopleSearch, MyLife, Intelius and Yellow Pages, each with its opt-out URL,
the data classes it exposes, the steps, what verification the opt-out itself
requires, and how long it typically takes.

### Keeping the broker catalog honest

Opt-out URLs and flows change without notice. Each entry carries a `checkedOn`
date, surfaced in the UI next to the steps. Re-verify the catalog quarterly:
open each `optOutUrl`, confirm the flow still matches `steps`, and bump
`CHECKED_ON`. A dead link degrades gracefully — the item still names the site so
the user can find its current privacy page — but a stale catalog is the most
likely way this tool wastes someone's afternoon.

## Running it

```bash
cp .env.example .env       # SESSION_SECRET is required in production
npm install
npm run dev                # server on :8787, client on :5173
```

With no `SERPAPI_KEY`, verification works end to end and the scan returns a
clear 503 — useful for exercising the gate without spending on queries. With
`OTP_EMAIL_PROVIDER=console` (the default), codes print to the server log
instead of being sent; never use that outside development.

```bash
npm test                   # 23 tests: gate behavior, OTP, normalization, worklist
npm run build              # production client bundle
```

## API

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | Configuration state (never secrets) |
| `POST /api/verify/start` | `{ name, contact, attestSelf }` → sends a code, returns a challenge id and the redacted destination |
| `POST /api/verify/resend` | New code for an existing challenge, behind a 30s cooldown |
| `POST /api/verify/confirm` | `{ challengeId, code }` → a short-lived session token |
| `POST /api/scan` | Bearer token required. Runs the queries, returns the worklist |
| `POST /api/admin/grants` | Admin key required. Issues a single-use, pinned third-party grant |
| `DELETE /api/admin/grants/:token` | Revoke an unused grant |

The code is never returned to the client, and contacts are echoed back redacted
(`a**@example.com`, `********0123`).

## What is stored

Challenges and sessions live in memory with a TTL and are swept on expiry;
scan results are returned to the browser and never persisted. There is
deliberately no record of who searched for what. Admin grants are logged,
because an approved non-self lookup should be an auditable event. Moving to
multiple instances means putting challenges, sessions and grants in Redis —
`TtlStore` in `server/src/lib/store.js` is a four-method interface for exactly
that swap.

## Known limits

- Verification is contact control, not identity — stated above and in the UI.
- Absence of a result is not proof of absence. Brokers republish and indexing
  lags; the worklist says so and invites a re-check.
- For non-broker pages the "exposed" line is inferred from the search snippet
  and is flagged as inferred rather than asserted.
- The in-memory stores are single-instance.
