import express from 'express';
import { config } from '../config.js';
import { requireVerifiedSession } from '../lib/auth.js';
import { searchGoogle } from '../sources/serpapi.js';
import { buildWorklist } from '../lib/worklist.js';
import { RateLimiter, limiterMiddleware } from '../lib/ratelimit.js';

export const scanRouter = express.Router();

// Each scan is billable SerpAPI traffic; cap it per IP on top of the per-session quota.
const scanByIp = new RateLimiter({ limit: config.limits.scansPerIpPerHour, windowMs: 60 * 60 * 1000 });

scanRouter.post(
  '/',
  requireVerifiedSession,
  limiterMiddleware(scanByIp, (req) => req.ip || 'unknown'),
  async (req, res, next) => {
    const session = req.session;
    try {
      // The name is taken from the verified session, never from the request
      // body — otherwise a single verification would become a search box.
      const { findings, errors, queriesRun } = await searchGoogle(session.name, {
        location: typeof req.body?.location === 'string' ? req.body.location.slice(0, 80) : undefined,
      });

      session.scansUsed += 1;
      const worklist = buildWorklist(findings, { name: session.name });

      return res.json({
        ...worklist,
        verifiedContact: session.contact.channel,
        subject: session.subject === 'self' ? 'self' : 'admin-approved',
        scansRemaining: Math.max(config.session.maxScans - session.scansUsed, 0),
        queriesRun,
        partialFailures: errors,
        disclaimer:
          'Results come from Google organic search via SerpAPI. Absence of a result is not proof of absence; ' +
          'brokers republish, so re-check periodically.',
      });
    } catch (err) {
      if (err.code === 'search_unavailable') {
        return res.status(503).json({ error: err.code, message: err.message });
      }
      return next(err);
    }
  },
);
