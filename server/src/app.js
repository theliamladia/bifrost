import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { sessionRouter } from './routes/session.js';
import { scanRouter } from './routes/scan.js';
import { adminRouter } from './routes/admin.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '16kb' }));
  app.use(cors({ origin: config.isProd ? false : true }));

  app.use((_req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'no-referrer');
    // Results are personal; never let a cache or an intermediary keep them.
    res.set('Cache-Control', 'no-store');
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      searchConfigured: Boolean(config.serpapi.key),
      approvalAuthority: config.adminApiKey ? 'configured' : 'missing',
      scansRequireApproval: true,
    });
  });

  app.use('/api/session', sessionRouter);
  app.use('/api/scan', scanRouter);
  app.use('/api/admin', adminRouter);

  app.use((_req, res) => res.status(404).json({ error: 'not_found', message: 'No such endpoint.' }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    const status = err.status || 500;
    if (status >= 500) console.error('[error]', err);
    res.status(status).json({
      error: err.code || 'server_error',
      message: status >= 500 ? 'Something went wrong on our end.' : err.message,
    });
  });

  return app;
}
