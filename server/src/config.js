import crypto from 'node:crypto';
import dotenv from 'dotenv';

// A local .env is a convenience, not a requirement: hosted deployments inject
// their own environment, and there is no file to read there.
dotenv.config({ path: new URL('../../.env', import.meta.url).pathname, quiet: true });

const isProd = process.env.NODE_ENV === 'production';

/**
 * Missing production configuration is reported, not thrown.
 *
 * Throwing here happens at import time, which on a serverless host surfaces as
 * an opaque FUNCTION_INVOCATION_FAILED with no indication of which variable is
 * missing. Instead the server starts, /api/health names what is absent, and
 * every other route fails closed with the same list. Same refusal to run, far
 * better diagnostics.
 */
const missingRequired = [];

function requiredInProd(name, value, fallback) {
  if (value) return value;
  if (isProd) {
    missingRequired.push(name);
    return '';
  }
  return fallback;
}

export const config = {
  isProd,
  missingRequired,
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
