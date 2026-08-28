/**
 * Vercel serverless entry point.
 *
 * The same Express app as local development, minus `listen` — the platform
 * owns the socket here. `server/src/index.js` remains the entry for running it
 * as a normal long-lived server.
 *
 * Note the tradeoff this deployment shape carries: approvals and sessions live
 * in memory (see server/src/lib/store.js), and serverless instances are
 * ephemeral and plural. An approval issued by one instance is not visible to
 * another, so under anything but trivial traffic a valid code can come back as
 * "invalid". Point TtlStore at Redis before this is used for real.
 */
import { createApp } from '../server/src/app.js';

const app = createApp();

export default function handler(req, res) {
  return app(req, res);
}
