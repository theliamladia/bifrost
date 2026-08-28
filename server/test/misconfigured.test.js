/**
 * A production deployment with missing configuration must refuse to serve —
 * but it must refuse *legibly*. Throwing at import time (the previous
 * behavior) surfaces on a serverless host as an opaque
 * FUNCTION_INVOCATION_FAILED on every route, favicon included, with the reason
 * visible only in platform logs.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'production';
delete process.env.SESSION_SECRET;
delete process.env.ADMIN_API_KEY;

// The import itself is the first assertion: this must not throw.
const { createApp } = await import('../src/app.js');
const server = createApp().listen(0);
await new Promise((resolve) => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
test.after(() => server.close());

test('health still answers, and names what is missing', async () => {
  const res = await fetch(`${base}/api/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, false);
  assert.deepEqual(body.missingConfiguration, ['SESSION_SECRET', 'ADMIN_API_KEY']);
});

test('every other route fails closed with the missing variables named', async () => {
  const res = await fetch(`${base}/api/session/redeem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approvalCode: 'anything' }),
  });
  assert.equal(res.status, 503);
  const body = await res.json();
  assert.equal(body.error, 'server_misconfigured');
  assert.match(body.message, /SESSION_SECRET/);
  assert.match(body.message, /ADMIN_API_KEY/);
});

test('a missing secret is never echoed as a value', async () => {
  const body = await (await fetch(`${base}/api/health`)).json();
  assert.equal(body.sessionSecret, undefined);
  assert.equal(body.adminApiKey, undefined);
});

test('the serverless entry point exports a callable handler', async () => {
  const { default: handler } = await import('../../api/index.mjs');
  assert.equal(typeof handler, 'function');
  // (req, res) — the shape Vercel's Node runtime invokes.
  assert.equal(handler.length, 2);
});
