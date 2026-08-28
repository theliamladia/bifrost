import crypto from 'node:crypto';
import express from 'express';
import { config } from '../config.js';
import { challenges, sessions } from '../lib/store.js';
import { normalizeContact, normalizeName, redactContact, ContactError } from '../lib/contact.js';
import { generateCode, hashCode, codeMatches } from '../lib/otp.js';
import { sign, randomId } from '../lib/tokens.js';
import { deliverCode } from '../providers/sms.js';
import { RateLimiter, limiterMiddleware } from '../lib/ratelimit.js';
import { consumeGrant, peekGrant } from './admin.js';

export const verifyRouter = express.Router();

// Sending codes costs money and reaches a real inbox/handset; cap both by IP
// and by destination so neither an open server nor one victim can be flooded.
const startByIp = new RateLimiter({ limit: config.limits.startPerIpPer15Min, windowMs: 15 * 60 * 1000 });
const startByContact = new RateLimiter({ limit: config.limits.startPerContactPerHour, windowMs: 60 * 60 * 1000 });
const confirmByIp = new RateLimiter({ limit: config.limits.confirmPerIpPer15Min, windowMs: 15 * 60 * 1000 });

const clientIp = (req) => req.ip || req.socket.remoteAddress || 'unknown';

function issueChallenge({ name, contact, subject }) {
  const id = randomId();
  const code = generateCode(config.otp.codeLength);
  const salt = crypto.randomBytes(16).toString('hex');
  challenges.set(
    id,
    {
      id,
      name,
      contact,
      subject, // 'self' | { via: 'admin-grant', grantId }
      salt,
      codeHash: hashCode(code, salt),
      attempts: 0,
      lastSentAt: Date.now(),
      createdAt: Date.now(),
    },
    config.otp.ttlMs,
  );
  return { id, code };
}

verifyRouter.post(
  '/start',
  limiterMiddleware(startByIp, clientIp),
  async (req, res, next) => {
    try {
      const name = normalizeName(req.body?.name);
      const contact = normalizeContact(req.body?.contact);

      // The scanner runs on the person running it. A lookup aimed at anyone
      // else requires an admin-issued grant; there is no other path.
      let subject = 'self';
      const grantToken = req.body?.grantToken;
      if (grantToken) {
        const grant = peekGrant(grantToken);
        if (!grant) {
          return res.status(403).json({
            error: 'invalid_grant',
            message: 'That authorization is not valid or has expired.',
          });
        }
        if (grant.subjectName.toLowerCase() !== name.toLowerCase()) {
          return res.status(403).json({
            error: 'grant_mismatch',
            message: 'This authorization was issued for a different name.',
          });
        }
        if (grant.requesterContact !== contact.value) {
          return res.status(403).json({
            error: 'grant_mismatch',
            message: 'This authorization was issued to a different verified contact.',
          });
        }
        subject = { via: 'admin-grant', grantId: grant.id, grantToken: grantToken };
      } else if (req.body?.attestSelf !== true) {
        return res.status(400).json({
          error: 'attestation_required',
          message: 'Confirm you are checking your own footprint before continuing.',
        });
      }

      const contactLimit = startByContact.hit(contact.value);
      if (!contactLimit.ok) {
        return res.status(429).json({
          error: 'rate_limited',
          message: 'Too many codes sent to this contact. Try again later.',
        });
      }

      const { id, code } = issueChallenge({ name, contact, subject });
      await deliverCode(contact, code, config.otp.ttlMs);

      return res.status(201).json({
        challengeId: id,
        channel: contact.channel,
        sentTo: redactContact(contact),
        expiresInSeconds: Math.round(config.otp.ttlMs / 1000),
        resendAfterSeconds: Math.round(config.otp.resendCooldownMs / 1000),
      });
    } catch (err) {
      return next(err);
    }
  },
);

verifyRouter.post('/resend', limiterMiddleware(startByIp, clientIp), async (req, res, next) => {
  try {
    const challenge = challenges.get(String(req.body?.challengeId ?? ''));
    if (!challenge) {
      return res.status(404).json({ error: 'challenge_not_found', message: 'That code request expired. Start again.' });
    }
    const since = Date.now() - challenge.lastSentAt;
    if (since < config.otp.resendCooldownMs) {
      const wait = Math.ceil((config.otp.resendCooldownMs - since) / 1000);
      return res.status(429).json({ error: 'resend_too_soon', message: `Wait ${wait}s before resending.` });
    }

    // A resend replaces the outstanding code and clears the attempt count for it.
    const code = generateCode(config.otp.codeLength);
    challenge.salt = crypto.randomBytes(16).toString('hex');
    challenge.codeHash = hashCode(code, challenge.salt);
    challenge.attempts = 0;
    challenge.lastSentAt = Date.now();
    await deliverCode(challenge.contact, code, config.otp.ttlMs);

    return res.json({ challengeId: challenge.id, sentTo: redactContact(challenge.contact) });
  } catch (err) {
    return next(err);
  }
});

verifyRouter.post('/confirm', limiterMiddleware(confirmByIp, clientIp), (req, res) => {
  const challengeId = String(req.body?.challengeId ?? '');
  const code = String(req.body?.code ?? '').trim();
  const challenge = challenges.get(challengeId);

  if (!challenge) {
    return res.status(404).json({ error: 'challenge_not_found', message: 'That code request expired. Start again.' });
  }
  if (challenge.attempts >= config.otp.maxAttempts) {
    challenges.delete(challengeId);
    return res.status(429).json({ error: 'too_many_attempts', message: 'Too many wrong codes. Start again.' });
  }

  challenge.attempts += 1;
  if (!/^\d+$/.test(code) || !codeMatches(code, challenge.salt, challenge.codeHash)) {
    const remaining = Math.max(config.otp.maxAttempts - challenge.attempts, 0);
    return res.status(401).json({
      error: 'invalid_code',
      message: remaining > 0 ? `That code is not right. ${remaining} attempt(s) left.` : 'Too many wrong codes. Start again.',
      attemptsRemaining: remaining,
    });
  }

  // Single use: the challenge dies the moment it succeeds.
  challenges.delete(challengeId);
  if (challenge.subject !== 'self' && !consumeGrant(challenge.subject.grantToken)) {
    // The grant was revoked or already spent between start and confirm.
    return res.status(403).json({
      error: 'invalid_grant',
      message: 'That authorization is no longer valid. Ask an administrator to reissue it.',
    });
  }

  const sessionId = randomId();
  sessions.set(
    sessionId,
    { id: sessionId, name: challenge.name, contact: challenge.contact, subject: challenge.subject, scansUsed: 0 },
    config.session.ttlMs,
  );

  const token = sign({ sid: sessionId }, config.session.ttlMs);
  return res.json({
    token,
    name: challenge.name,
    verifiedContact: redactContact(challenge.contact),
    subject: challenge.subject === 'self' ? 'self' : 'admin-approved',
    expiresInSeconds: Math.round(config.session.ttlMs / 1000),
    // Said plainly here as well as in the UI: this is anti-casual-misuse, not identity proofing.
    verificationNote:
      'Verified control of this contact. That is not proof the contact belongs to the name entered.',
  });
});

verifyRouter.use((err, _req, res, next) => {
  if (err instanceof ContactError) {
    return res.status(err.status).json({ error: 'invalid_input', message: err.message });
  }
  return next(err);
});
