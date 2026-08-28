import crypto from 'node:crypto';
import dotenv from 'dotenv';

dotenv.config({ path: new URL('../../.env', import.meta.url).pathname });

const isProd = process.env.NODE_ENV === 'production';

function requiredInProd(name, value, fallback) {
  if (value) return value;
  if (isProd) throw new Error(`${name} must be set in production`);
  return fallback;
}

export const config = {
  isProd,
  port: Number(process.env.PORT || 8787),

  // Ephemeral fallback: restarting dev invalidates old sessions, which is fine.
  sessionSecret: requiredInProd(
    'SESSION_SECRET',
    process.env.SESSION_SECRET,
    crypto.randomBytes(32).toString('hex'),
  ),

  // The approval authority. Every scan needs an approval issued with this key,
  // so an unset key means the deployment approves nothing and runs nothing.
  adminApiKey: requiredInProd('ADMIN_API_KEY', process.env.ADMIN_API_KEY, ''),

  // A redeemed approval is short-lived and single-purpose.
  session: { ttlMs: 30 * 60 * 1000, maxScans: 5 },

  // Every entry point that costs money (a SerpAPI query) is capped.
  // Tunable per deployment; the defaults are what a single real user needs.
  limits: {
    redeemPerIpPer15Min: Number(process.env.LIMIT_REDEEM_PER_IP || 30),
    scansPerIpPerHour: Number(process.env.LIMIT_SCANS_PER_IP || 20),
  },

  serpapi: { key: process.env.SERPAPI_KEY || '' },
};
