/**
 * Fail closed: with no approval authority configured, nothing can be approved
 * and therefore nothing can run. A separate file because the check reads config
 * captured at import time.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-secret-not-for-production';
process.env.ADMIN_API_KEY = '';

const { createApp } = await import('../src/app.js');
const server = createApp().listen(0);
await new Promise((resolve) => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
test.after(() => server.close());

const post = (path, body, headers = {}) =>
  fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

test('with no approval authority, no approval can be redeemed', async () => {
  const res = await post('/api/session/redeem', { approvalCode: 'anything' });
  assert.equal(res.status, 503);
  assert.equal((await res.json()).error, 'approval_unconfigured');
});

test('with no approval authority, no approval can be issued with any key', async () => {
  const res = await post(
    '/api/admin/approvals',
    { subjectName: 'Ada Lovelace', reason: 'signed authorization on file' },
    { 'x-admin-key': 'anything' },
  );
  assert.equal(res.status, 503);
  assert.equal((await res.json()).error, 'approval_unconfigured');
});

test('health reports the missing authority', async () => {
  const body = await (await fetch(`${base}/api/health`)).json();
  assert.equal(body.approvalAuthority, 'missing');
  assert.equal(body.scansRequireApproval, true);
});
