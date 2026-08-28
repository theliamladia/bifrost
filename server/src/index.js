import { createApp } from './app.js';
import { config } from './config.js';

const app = createApp();
app.listen(config.port, () => {
  console.log(`[server] listening on http://localhost:${config.port}`);
  if (!config.serpapi.key) console.warn('[server] SERPAPI_KEY not set — scans will return 503.');
  if (config.otp.emailProvider === 'console' || config.otp.smsProvider === 'console') {
    console.warn('[server] OTP codes print to this log (console provider). Do not use in production.');
  }
});
