import crypto from 'node:crypto';
import { config } from '../config.js';

/**
 * Compact signed tokens (HMAC-SHA256 over a base64url JSON payload).
 *
 * Not a JWT library on purpose: one algorithm, no header parsing, no "alg:none"
 * class of mistake.
 */

function b64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

export function sign(payload, ttlMs) {
  const body = { ...payload, exp: Date.now() + ttlMs };
  const encoded = b64url(JSON.stringify(body));
  const mac = crypto.createHmac('sha256', config.sessionSecret).update(encoded).digest('base64url');
  return `${encoded}.${mac}`;
}

export function verify(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [encoded, mac] = token.split('.');
  if (!encoded || !mac) return null;

  const expected = crypto
    .createHmac('sha256', config.sessionSecret)
    .update(encoded)
    .digest('base64url');
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (typeof payload?.exp !== 'number' || payload.exp <= Date.now()) return null;
  return payload;
}

export function randomId(bytes = 16) {
  return crypto.randomBytes(bytes).toString('base64url');
}
