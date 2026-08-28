/**
 * The gate is the product. These tests exercise the real HTTP surface: consent
 * originates with an administrator, no query runs without a redeemed approval,
 * and a redeemed approval cannot be re-pointed at a different person.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-secret-not-for-production';
process.env.ADMIN_API_KEY = 'test-admin-key';
delete process.env.SERPAPI_KEY;

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

const ADMIN = { 'x-admin-key': 'test-admin-key' };

async function approve(subjectName, overrides = {}) {
  const res = await post(
    '/api/admin/approvals',
    { subjectName, relationship: 'self', reason: 'requester is the subject, ID checked', ...overrides },
    ADMIN,
  );
  assert.equal(res.status, 201, 'approval should be issued');
  return (await res.json()).approvalCode;
}

async function approvedSession(subjectName, overrides = {}) {
  const approvalCode = await approve(subjectName, overrides);
  const res = await post('/api/session/redeem', { approvalCode });
  assert.equal(res.status, 200);
  return res.json();
}

test('a scan without a token is refused', async () => {
  const res = await post('/api/scan', {});
  assert.equal(res.status, 401);
  assert.equal((await res.json()).error, 'approval_required');
});

test('a scan with a forged token is refused', async () => {
  const res = await post('/api/scan', {}, { Authorization: 'Bearer eyJzaWQiOiJ4In0.notavalidmac' });
  assert.equal(res.status, 401);
});

test('there is no way to start a check without an approval code', async () => {
  const res = await post('/api/session/redeem', {});
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error, 'approval_required');
});

test('a made-up approval code is refused', async () => {
  const res = await post('/api/session/redeem', { approvalCode: 'not-a-real-code' });
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error, 'invalid_approval');
});

test('a requester cannot name the subject — the name comes off the approval', async () => {
  const approvalCode = await approve('Ada Lovelace');
  // Anything the requester sends alongside the code is ignored.
  const res = await post('/api/session/redeem', {
    approvalCode,
    name: 'Someone Else',
    subjectName: 'Someone Else',
  });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).name, 'Ada Lovelace');
});

test('only an admin can issue an approval', async () => {
  const noKey = await post('/api/admin/approvals', {
    subjectName: 'Ada Lovelace',
    reason: 'signed authorization on file',
  });
  assert.equal(noKey.status, 401);

  const wrongKey = await post(
    '/api/admin/approvals',
    { subjectName: 'Ada Lovelace', reason: 'signed authorization on file' },
    { 'x-admin-key': 'wrong-key-same-length' },
  );
  assert.equal(wrongKey.status, 401);
});

test('an approval needs a recorded reason', async () => {
  const res = await post(
    '/api/admin/approvals',
    { subjectName: 'Ada Lovelace', reason: 'ok' },
    ADMIN,
  );
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'reason_required');
});

test('an unknown relationship is rejected', async () => {
  const res = await post(
    '/api/admin/approvals',
    { subjectName: 'Ada Lovelace', relationship: 'whatever', reason: 'signed authorization on file' },
    ADMIN,
  );
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'invalid_relationship');
});

test('an approval is single use', async () => {
  const approvalCode = await approve('Ada Lovelace');
  assert.equal((await post('/api/session/redeem', { approvalCode })).status, 200);

  const reused = await post('/api/session/redeem', { approvalCode });
  assert.equal(reused.status, 403);
  assert.equal((await reused.json()).error, 'invalid_approval');
});

test('a revoked approval stops working', async () => {
  const approvalCode = await approve('Ada Lovelace');
  const revoked = await fetch(`${base}/api/admin/approvals/${encodeURIComponent(approvalCode)}`, {
    method: 'DELETE',
    headers: ADMIN,
  });
  assert.equal((await revoked.json()).revoked, true);

  const res = await post('/api/session/redeem', { approvalCode });
  assert.equal(res.status, 403);
});

test('redeeming reports the approval it came from, and is honest about what it proves', async () => {
  const session = await approvedSession('Ada Lovelace', { issuedBy: 'compliance@example.com' });
  assert.equal(session.name, 'Ada Lovelace');
  assert.equal(session.relationship, 'self');
  assert.equal(session.approvedBy, 'compliance@example.com');
  assert.ok(session.token);
  assert.match(session.approvalNote, /does not verify who redeemed it/i);
});

test('an approval can record who it was handed to, redacted on the way back', async () => {
  const session = await approvedSession('Ada Lovelace', { issuedTo: 'ada@example.com' });
  assert.equal(session.issuedTo, 'a**@example.com');
});

test('a session scans its approved name only — the body cannot redirect it', async () => {
  const { token } = await approvedSession('Ada Lovelace');

  // SERPAPI_KEY is unset, so a scan that gets past the gate fails at the search
  // layer (503) rather than at the gate (401/403). That distinction is the
  // assertion: the session authorized a scan for the approved name, and
  // "Someone Else" in the body is ignored entirely.
  const res = await post('/api/scan', { name: 'Someone Else' }, { Authorization: `Bearer ${token}` });
  assert.equal(res.status, 503);
  assert.equal((await res.json()).error, 'search_unavailable');
});

test('a third-party check is the same gate, recorded as third-party', async () => {
  const session = await approvedSession('Someone Else', {
    relationship: 'third-party',
    reason: 'signed written authorization from the subject on file',
  });
  assert.equal(session.relationship, 'third-party');
});

test('health reports that approval is required and configured', async () => {
  const body = await (await fetch(`${base}/api/health`)).json();
  assert.equal(body.scansRequireApproval, true);
  assert.equal(body.approvalAuthority, 'configured');
  assert.equal(body.searchConfigured, false);
});

test('end to end: an approved check produces a worklist with opt-out links', async () => {
  const { config } = await import('../src/config.js');
  const realFetch = globalThis.fetch;

  // Stub only SerpAPI; the test's own calls to the app still go over the wire.
  config.serpapi.key = 'test-key';
  globalThis.fetch = async (url, init) => {
    if (String(url).startsWith('https://serpapi.com/')) {
      assert.match(String(url), /api_key=test-key/);
      // URLSearchParams encodes spaces as '+', so undo that before matching.
      assert.match(decodeURIComponent(String(url)).replace(/\+/g, ' '), /"Ada Lovelace"/);
      return new Response(
        JSON.stringify({
          organic_results: [
            { link: 'https://www.spokeo.com/Ada-Lovelace/Texas', title: 'Ada Lovelace, Austin TX', snippet: 'Age 36' },
            { link: 'https://www.truepeoplesearch.com/results?name=ada', title: 'Ada Lovelace - TruePeopleSearch', snippet: '512-555-0100' },
            { link: 'https://example.org/talks/ada', title: 'Ada Lovelace speaks at a conference', snippet: 'Keynote' },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    return realFetch(url, init);
  };

  try {
    const { token } = await approvedSession('Ada Lovelace');
    const res = await post('/api/scan', {}, { Authorization: `Bearer ${token}` });
    assert.equal(res.status, 200);
    const worklist = await res.json();

    assert.deepEqual(worklist.partialFailures, []);
    assert.equal(worklist.checkedName, 'Ada Lovelace');
    assert.equal(worklist.relationship, 'self');
    assert.ok(worklist.approvalId, 'the scan is traceable to the approval that authorized it');
    assert.equal(worklist.summary.total, 3);
    assert.equal(worklist.summary.brokerListings, 2);
    assert.equal(worklist.items[0].action.type, 'opt-out');
    assert.match(worklist.items[0].action.url, /^https:\/\//);
    assert.ok(worklist.items.every((item) => item.steps.length > 0));
    assert.equal(worklist.scansRemaining, 4);

    // A worklist, not a profile: no aggregated identity fields on the payload.
    for (const key of ['age', 'addresses', 'relatives', 'phone', 'profile']) {
      assert.equal(worklist[key], undefined);
    }
  } finally {
    globalThis.fetch = realFetch;
    config.serpapi.key = '';
  }
});
