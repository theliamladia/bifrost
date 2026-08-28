import { sessions } from './store.js';
import { verify } from './tokens.js';
import { config } from '../config.js';

/**
 * Every query path sits behind this. No redeemed approval, no query — and the
 * name that gets searched comes from the session (where the approval put it),
 * never from the request body, so a session cannot be re-pointed at a
 * different person.
 */
export function requireVerifiedSession(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const payload = token ? verify(token) : null;
  if (!payload?.sid) {
    return res.status(401).json({
      error: 'approval_required',
      message: 'Redeem an administrator-issued approval code before running a scan.',
    });
  }

  const session = sessions.get(payload.sid);
  if (!session) {
    return res.status(401).json({
      error: 'session_expired',
      message: 'Your approved session expired. Ask an administrator for a new approval code.',
    });
  }
  if (session.scansUsed >= config.session.maxScans) {
    return res.status(429).json({
      error: 'scan_quota_exhausted',
      message: 'This approval has been used for its maximum number of scans.',
    });
  }

  req.session = session;
  return next();
}
