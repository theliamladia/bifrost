# Digital Footprint Self-Check

A web app that shows what is exposed about a person online and hands them a
remediation worklist — source, what's exposed, and the opt-out link or steps.

**This is a self-exposure scanner, not a people-search tool.** Every check is
approved by an administrator before it runs, and runs only for the name that
approval names. Nothing a requester types decides who gets looked up.

## Where consent comes from

Consent originates with the program owner. An administrator records who is
being checked and why, then issues a single-use approval code for that one
name. The requester redeems the code; the scan runs on the approved name.

```
admin (holds ADMIN_API_KEY)          requester                    server
  |                                      |                          |
  |-- POST /api/admin/approvals -------->|                          |
  |   { subjectName, relationship,       |                          |
  |     reason, issuedTo? }              |                          |
  |<-- approvalCode ---------------------|                          |
  |                                      |                          |
  |----- hands over the code ----------->|                          |
  |                                      |-- POST /api/session/redeem -->|
  |                                      |<-- session token ------------|
  |                                      |-- POST /api/scan ----------->|
  |                                      |<-- worklist ----------------|
```

### How the constraint is enforced

| Rule | Where it lives |
| --- | --- |
| Nothing runs without an administrator's approval | `POST /api/session/redeem` is the only way to get a session, and it requires an approval code |
| The requester cannot choose the subject | The name comes off the approval record; anything in the request body is ignored (`server/src/routes/session.js`) |
| A session cannot be re-pointed after the fact | `POST /api/scan` reads the name from the session, never the request body |
| One approval is not standing permission | Approvals are single-use, expire in an hour, and can be revoked before redemption |
| A redeemed approval is not an unlimited search box | Sessions expire in 30 minutes and allow 5 scans of the same approved name |
| No approval authority means nothing runs | With `ADMIN_API_KEY` unset the server fails closed: both approving and redeeming return 503 |
| Every check is auditable | Issue, revoke, consume and redeem are logged with the approval id, subject, issuer and reason |

`server/test/gate.test.js` tests these as HTTP behavior — including that an
approval for "Ada Lovelace" redeemed with `{"name": "Someone Else"}` still
returns a session for Ada, and that a session scans only its approved name.
`server/test/unconfigured.test.js` tests the fail-closed path.

### What an approval does and does not prove

An approval proves an administrator authorized this specific check. It does
**not** prove who is holding the code: the code is a bearer credential, so
whoever has it can redeem it, and nothing downstream re-checks who that is.
Deliver codes over a channel you trust, keep the TTL short, and revoke anything
that goes astray. Nor does anything here prove the name being checked belongs
to the person asking — that is the administrator's call, recorded in the
approval's `reason`.

The UI states both limits at every stage (`ApprovalHonestyNote`), and the
redeem response carries the same sentence.

Two optional strengthenings, neither implemented:

- **Verify the requester** — a one-time code to their email or phone at
  redemption, so the credential is not purely bearer. This existed in the first
  version of this app and was removed deliberately; it is recoverable from git
  history (commit `eeea633`) if you want it back.
- **Verify the subject** — real identity proofing (e.g. Stripe Identity) at the
  point the administrator approves.

## Flow (requester)

1. Enter the approval code. There is no name field — the name is the
   administrator's decision, not the requester's.
2. The scan fires immediately on redemption.
3. Results render as a worklist: each finding shows its source, what is
   exposed, and an opt-out link or removal steps — to-do items, not a profile
   card.

## Stack

- **Frontend** — React (Vite). Two screens: redeem, then worklist.
- **Backend** — Node/Express. Required, not optional: it holds the SerpAPI key
  and the approval authority. The browser never talks to SerpAPI directly.

## Data sources

- **Google organic via SerpAPI.** Paid per query, ToS-safe. Nothing here
  scrapes a search page.
- **Directory/broker results are prioritized** — a second SerpAPI query targets
  the broker domains specifically, because each broker result carries an opt-out
  path and is therefore actionable. Broker hits sort to the top of the worklist.
- **v1 excludes Facebook-via-Google-Images**: low reliability, high false
  positive rate, and the most sensitive data class. Revisit only with real
  signal.

The broker catalog (`server/src/sources/brokers.js`) covers 18 sites including
Whitepages, Spokeo, BeenVerified, Radaris, TruePeopleSearch, FastPeopleSearch,
MyLife, Intelius and Yellow Pages, each with its opt-out URL, the data classes
it exposes, the steps, what verification the opt-out itself requires, and how
long it typically takes.

### Keeping the broker catalog honest

Opt-out URLs and flows change without notice. Each entry carries a `checkedOn`
date, surfaced in the UI next to the steps. Re-verify the catalog quarterly:
open each `optOutUrl`, confirm the flow still matches `steps`, and bump
`CHECKED_ON`. A dead link degrades gracefully — the item still names the site so
the user can find its current privacy page — but a stale catalog is the most
likely way this tool wastes someone's afternoon.

## Running it

```bash
cp .env.example .env       # SESSION_SECRET and ADMIN_API_KEY are required in production
npm install
npm run dev                # server on :8787, client on :5173
```

Issue an approval, then redeem it:

```bash
curl -X POST localhost:8787/api/admin/approvals \
  -H 'Content-Type: application/json' -H 'x-admin-key: YOUR_ADMIN_KEY' \
  -d '{"subjectName":"Ada Lovelace","relationship":"self",
       "reason":"employee checking own exposure, ID verified in person",
       "issuedBy":"compliance@example.com","issuedTo":"ada@example.com"}'
```

With no `SERPAPI_KEY`, approval and redemption work end to end and the scan
returns a clear 503 — useful for exercising the gate without spending on
queries.

```bash
npm test                   # 30 tests: gate behavior, fail-closed, normalization, worklist
npm run build              # production client bundle
```

## API

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | Configuration state (never secrets) |
| `POST /api/admin/approvals` | Admin key required. Issues a single-use approval for one subject name |
| `DELETE /api/admin/approvals/:code` | Revoke an unredeemed approval |
| `POST /api/session/redeem` | `{ approvalCode }` → a short-lived session token for the approved name |
| `POST /api/scan` | Bearer token required. Runs the queries, returns the worklist |

`issuedTo` is echoed back redacted (`a**@example.com`), and approval codes are
never logged in full.

### Approval fields

| Field | Required | Meaning |
| --- | --- | --- |
| `subjectName` | yes | Whose footprint is checked. The only name the approval will ever scan |
| `reason` | yes (10+ chars) | Why this check is authorized. Goes in the audit log |
| `relationship` | no (default `self`) | `self` if the requester is the subject, `third-party` otherwise |
| `issuedBy` | no | Who approved it, for the audit log |
| `issuedTo` | no | Who the code was handed to. **Recorded, not verified** — nothing downstream checks it |

## What is stored

Approvals and sessions live in memory with a TTL and are swept on expiry; scan
results are returned to the browser and never persisted. There is deliberately
no record of scan *results*. Approval decisions are logged, because an approved
lookup should be an auditable event. Moving to multiple instances means putting
approvals and sessions in Redis — `TtlStore` in `server/src/lib/store.js` is a
four-method interface for exactly that swap.

## Known limits

- The approval code is a bearer credential; see above.
- Approval proves authorization, not that the subject consented — that
  judgement sits with the administrator and is only as good as the `reason`.
- Absence of a result is not proof of absence. Brokers republish and indexing
  lags; the worklist says so and invites a re-check.
- For non-broker pages the "exposed" line is inferred from the search snippet
  and is flagged as inferred rather than asserted.
- The in-memory stores are single-instance.
