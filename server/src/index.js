import { createApp } from './app.js';
import { config } from './config.js';

const app = createApp();
app.listen(config.port, () => {
  console.log(`[server] listening on http://localhost:${config.port}`);
  if (!config.serpapi.key) console.warn('[server] SERPAPI_KEY not set — scans will return 503.');
  if (!config.adminApiKey) {
    console.warn('[server] ADMIN_API_KEY not set — no approvals can be issued, so no scan can run.');
  }
});
