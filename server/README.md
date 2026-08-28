# Server

Express API behind the approval gate. See the root `README.md` for the design
constraints; the short version:

- `src/routes/admin.js` — the approval gate. Consent originates here.
- `src/routes/session.js` — redeems an approval into a short-lived session.
- `src/routes/scan.js` — the only query path, gated by `requireVerifiedSession`.
- `src/sources/` — SerpAPI query layer and the broker catalog.
- `src/lib/worklist.js` — findings to prioritized to-do items.

Run `npm test` from the repo root (or `npm test --workspace=server`).
