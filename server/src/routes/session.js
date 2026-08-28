import express from 'express';
import { config } from '../config.js';
import { sessions } from '../lib/store.js';
import { redactContact } from '../lib/contact.js';
import { sign, randomId } from '../lib/tokens.js';
import { peekGrant, consumeGrant, approvalConfigured } from './admin.js';
import { RateLimiter, limiterMiddleware } from '../lib/ratelimit.js';

/**
 * Redeeming an approval.
 *
 * An administrator has already decided this scan may happen and for whom. The
 * requester presents the approval code and gets a short-lived session; the
 * name to be scanned comes off the approval, never from the requester, so
 * there is nothing here for a requester to point at someone else.
 */

export const sessionRouter = express.Router();

// Codes are 32 random bytes, so guessing is not the threat — this just keeps a
// broken client or a script from hammering the endpoint.
const redeemByIp = new RateLimiter({ limit: config.limits.redeemPerIpPer15Min, windowMs: 15 * 60 * 1000 });

sessionRouter.post('/redeem', limiterMiddleware(redeemByIp, (req) => req.ip || 'unknown'), (req, res) => {
  if (!approvalConfigured()) {
    return res.status(503).json({
      error: 'approval_unconfigured',
      message: 'No approval authority is configured on this deployment, so no scan can run.',
    });
  }

  const approvalCode = String(req.body?.approvalCode ?? '').trim();
  if (!approvalCode) {
    return res.status(403).json({
      error: 'approval_required',
      message: 'An administrator must approve this scan. Enter the approval code they issued you.',
    });
  }

  const grant = peekGrant(approvalCode);
  if (!grant) {
    return res.status(403).json({
      error: 'invalid_approval',
      message: 'That approval code is not valid, has expired, or has already been used.',
    });
  }

  // Single use, burned on redemption: an approval buys one session, not a
  // standing permission.
  if (!consumeGrant(approvalCode)) {
    return res.status(403).json({
      error: 'invalid_approval',
      message: 'That approval code has already been used. Ask an administrator to reissue it.',
    });
  }

  const sessionId = randomId();
  sessions.set(
    sessionId,
    {
      id: sessionId,
      name: grant.subjectName,
      approval: { id: grant.id, relationship: grant.relationship, issuedBy: grant.issuedBy },
      scansUsed: 0,
    },
    config.session.ttlMs,
  );

  console.log(`[approval] redeemed id=${grant.id} subject="${grant.subjectName}"`);

  return res.json({
    token: sign({ sid: sessionId }, config.session.ttlMs),
    name: grant.subjectName,
    relationship: grant.relationship,
    approvedBy: grant.issuedBy,
    issuedTo: grant.issuedTo ? redactContact(grant.issuedTo) : null,
    expiresInSeconds: Math.round(config.session.ttlMs / 1000),
    scansAllowed: config.session.maxScans,
    // Said plainly here as well as in the UI.
    approvalNote:
      'This scan runs because an administrator approved it for this name. The approval is the only ' +
      'credential — anyone holding the code can redeem it, and it does not verify who redeemed it.',
  });
});
