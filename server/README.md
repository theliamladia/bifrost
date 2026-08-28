# Server

Express API behind the verification gate. See the root `README.md` for the
design constraints; the short version:

- `src/routes/verify.js` — OTP challenge, resend, confirm. Issues sessions.
- `src/routes/scan.js` — the only query path, gated by `requireVerifiedSession`.
- `src/routes/admin.js` — the admin-approval gate for non-self lookups.
- `src/sources/` — SerpAPI query layer and the broker catalog.
- `src/lib/worklist.js` — findings to prioritized to-do items.

Run `npm test` from the repo root (or `npm test --workspace=server`).
