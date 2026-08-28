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

  // Empty => third-party lookups are disabled outright.
  adminApiKey: process.env.ADMIN_API_KEY || '',

  otp: {
    codeLength: 6,
    ttlMs: 10 * 60 * 1000,
    maxAttempts: 5,
    resendCooldownMs: 30 * 1000,
    emailProvider: process.env.OTP_EMAIL_PROVIDER || 'console',
    smsProvider: process.env.OTP_SMS_PROVIDER || 'console',
  },

  // A verified session is short-lived and single-purpose.
  session: { ttlMs: 30 * 60 * 1000, maxScans: 5 },

  // Every entry point that costs money (an SMS, a SerpAPI query) is capped.
  // Tunable per deployment; the defaults are what a single real user needs.
  limits: {
    startPerIpPer15Min: Number(process.env.LIMIT_START_PER_IP || 10),
    startPerContactPerHour: Number(process.env.LIMIT_START_PER_CONTACT || 5),
    confirmPerIpPer15Min: Number(process.env.LIMIT_CONFIRM_PER_IP || 30),
    scansPerIpPerHour: Number(process.env.LIMIT_SCANS_PER_IP || 20),
  },

  postmark: {
    token: process.env.POSTMARK_SERVER_TOKEN || '',
    from: process.env.POSTMARK_FROM || '',
  },
  ses: {
    region: process.env.AWS_REGION || 'us-east-1',
    from: process.env.SES_FROM || '',
  },
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    from: process.env.TWILIO_FROM || '',
  },

  serpapi: { key: process.env.SERPAPI_KEY || '' },
};
