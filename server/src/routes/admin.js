import crypto from 'node:crypto';
import express from 'express';
import { config } from '../config.js';
import { grants } from '../lib/store.js';
import { normalizeContact, normalizeName, ContactError } from '../lib/contact.js';
import { randomId } from '../lib/tokens.js';

/**
 * The approval gate.
 *
 * Consent to run a scan originates here, with the program owner — not with
 * whoever wants the scan. Every scan needs an approval issued on this route;
 * there is no path a requester can authorize for themselves, and the name to
 * be scanned is set by the administrator, not typed in by the requester.
 *
 * An approval is single-use, expires in an hour, and names exactly one
 * subject, so it cannot be reshaped into an open search box.
 *
 * The approval code is a bearer credential: whoever holds it can redeem it.
 * Nothing downstream re-checks who that is, so hand it to the requester over a
 * channel you trust, and revoke it if it goes astray.
 */

const GRANT_TTL_MS = 60 * 60 * 1000;
const RELATIONSHIPS = new Set(['self', 'third-party']);

export const adminRouter = express.Router();

/** Fail closed: with no admin key there is no one who can approve, so nothing runs. */
export function approvalConfigured() {
  return Boolean(config.adminApiKey);
}

function requireAdmin(req, res, next) {
  if (!approvalConfigured()) {
    return res.status(503).json({
      error: 'approval_unconfigured',
      message: 'No approval authority is configured on this deployment, so no scan can be approved.',
    });
  }
  const presented = String(req.get('x-admin-key') ?? '');
  const a = Buffer.from(presented);
  const b = Buffer.from(config.adminApiKey);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ error: 'unauthorized', message: 'Invalid admin key.' });
  }
  return next();
}

adminRouter.post('/approvals', requireAdmin, (req, res, next) => {
  try {
    const subjectName = normalizeName(req.body?.subjectName);
    const relationship = String(req.body?.relationship ?? 'self');
    const reason = String(req.body?.reason ?? '').trim();

    // Who the code was handed to, for the audit trail. Recorded, not verified:
    // nothing downstream checks it, so it is a note to the administrator's
    // future self, not a control.
    const issuedTo = req.body?.issuedTo ? normalizeContact(req.body.issuedTo) : null;

    if (!RELATIONSHIPS.has(relationship)) {
      return res.status(400).json({
        error: 'invalid_relationship',
        message: "relationship must be 'self' (the requester is the subject) or 'third-party'.",
      });
    }
    if (reason.length < 10) {
      return res.status(400).json({
        error: 'reason_required',
        message: 'Record why this scan is approved (at least 10 characters).',
      });
    }

    const id = randomId();
    const token = randomId(32);
    grants.set(
      token,
      {
        id,
        token,
        subjectName,
        issuedTo,
        relationship,
        reason,
        issuedAt: new Date().toISOString(),
        issuedBy: String(req.body?.issuedBy ?? 'admin'),
        used: false,
      },
      GRANT_TTL_MS,
    );

    // The audit line is the point: every scan is a recorded approval decision.
    console.log(
      `[approval] issued id=${id} subject="${subjectName}" issuedTo=${issuedTo?.value ?? 'unrecorded'} ` +
        `relationship=${relationship} issuedBy=${req.body?.issuedBy ?? 'admin'} reason="${reason}"`,
    );

    return res.status(201).json({
      approvalId: id,
      approvalCode: token,
      subjectName,
      relationship,
      expiresInSeconds: Math.round(GRANT_TTL_MS / 1000),
      note:
        'Single use, and the only credential needed to run this scan. Deliver it over a channel you ' +
        'trust, and revoke it if it goes astray.',
    });
  } catch (err) {
    return next(err);
  }
});

adminRouter.delete('/approvals/:token', requireAdmin, (req, res) => {
  const revoked = grants.delete(req.params.token);
  if (revoked) console.log('[approval] revoked before use');
  return res.json({ revoked });
});

adminRouter.use((err, _req, res, next) => {
  if (err instanceof ContactError) {
    return res.status(err.status).json({ error: 'invalid_input', message: err.message });
  }
  return next(err);
});

export function peekGrant(token) {
  const grant = grants.get(String(token ?? ''));
  if (!grant || grant.used) return null;
  return grant;
}

/** Burn an approval at the moment it is redeemed. Single use, no second session. */
export function consumeGrant(token) {
  const grant = grants.get(String(token ?? ''));
  if (!grant || grant.used) return false;
  grant.used = true;
  grants.delete(String(token));
  console.log(`[approval] consumed id=${grant.id} subject="${grant.subjectName}"`);
  return true;
}
