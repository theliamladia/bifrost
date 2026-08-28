import crypto from 'node:crypto';
import express from 'express';
import { config } from '../config.js';
import { grants } from '../lib/store.js';
import { normalizeContact, normalizeName, ContactError } from '../lib/contact.js';
import { randomId } from '../lib/tokens.js';

/**
 * The admin-approval gate.
 *
 * This is the ONLY way a lookup runs against someone other than the verified
 * operator, and it is off unless ADMIN_API_KEY is configured. A grant is
 * single-use, expires in an hour, and is pinned to one subject name plus one
 * requester contact — so it still cannot be turned into an open search box.
 */

const GRANT_TTL_MS = 60 * 60 * 1000;

export const adminRouter = express.Router();

function requireAdmin(req, res, next) {
  if (!config.adminApiKey) {
    return res.status(404).json({
      error: 'third_party_lookups_disabled',
      message: 'Third-party lookups are disabled on this deployment.',
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

adminRouter.post('/grants', requireAdmin, (req, res, next) => {
  try {
    const subjectName = normalizeName(req.body?.subjectName);
    const requester = normalizeContact(req.body?.requesterContact);
    const reason = String(req.body?.reason ?? '').trim();
    if (reason.length < 10) {
      return res.status(400).json({
        error: 'reason_required',
        message: 'Record why this lookup is authorized (at least 10 characters).',
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
        requesterContact: requester.value,
        reason,
        issuedAt: new Date().toISOString(),
        issuedBy: String(req.body?.issuedBy ?? 'admin'),
        used: false,
      },
      GRANT_TTL_MS,
    );

    // The audit line is the point: an approved non-self lookup is a recorded event.
    console.log(
      `[admin-grant] id=${id} subject="${subjectName}" requester=${requester.value} ` +
        `issuedBy=${req.body?.issuedBy ?? 'admin'} reason="${reason}"`,
    );

    return res.status(201).json({
      grantId: id,
      grantToken: token,
      subjectName,
      expiresInSeconds: Math.round(GRANT_TTL_MS / 1000),
      note: 'Single use. The requester must still verify their own contact by OTP.',
    });
  } catch (err) {
    return next(err);
  }
});

adminRouter.delete('/grants/:token', requireAdmin, (req, res) => {
  const existed = grants.delete(req.params.token);
  return res.json({ revoked: existed });
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

/** Burn a grant at the moment its OTP succeeds. Single use, no second scan. */
export function consumeGrant(token) {
  const grant = grants.get(String(token ?? ''));
  if (!grant || grant.used) return false;
  grant.used = true;
  grants.delete(String(token));
  console.log(`[admin-grant] consumed id=${grant.id} subject="${grant.subjectName}"`);
  return true;
}
