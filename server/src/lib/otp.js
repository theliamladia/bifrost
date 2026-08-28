import crypto from 'node:crypto';

/** Numeric OTP code, uniform over the range (no modulo bias). */
export function generateCode(length = 6) {
  const max = 10 ** length;
  let value;
  do {
    value = crypto.randomBytes(4).readUInt32BE(0);
  } while (value >= Math.floor(0xffffffff / max) * max);
  return String(value % max).padStart(length, '0');
}

/** Codes are stored hashed with a per-challenge salt, never in plaintext. */
export function hashCode(code, salt) {
  return crypto.scryptSync(code, salt, 32).toString('hex');
}

export function codeMatches(code, salt, expectedHash) {
  const actual = Buffer.from(hashCode(code, salt), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}
