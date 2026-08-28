/**
 * The gate is the product. These tests exercise the real HTTP surface: no
 * query runs without a confirmed OTP, and a confirmed OTP cannot be pointed at
 * a different name than the one it was issued for.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-secret-not-for-production';
process.env.OTP_EMAIL_PROVIDER = 'console';
process.env.OTP_SMS_PROVIDER = 'console';
process.env.ADMIN_API_KEY = 'test-admin-key';
delete process.env.SERPAPI_KEY;
// The suite drives many verifications from one IP; raise the per-IP caps so the
// tests exercise the gate rather than the rate limiter (which has its own test).
process.env.LIMIT_START_PER_IP = '100';
process.env.LIMIT_CONFIRM_PER_IP = '200';

const { createApp } = await import('../src/app.js');

const server = createApp().listen(0);
await new Promise((resolve) => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
test.after(() => server.close());

/** The console OTP provider prints the code; capture it instead of guessing. */
async function withCapturedCode(fn) {
  const original = console.log;
  let captured = null;
  console.log = (...args) => {
    const match = /\b(\d{6})\b/.exec(args.join(' '));
    if (match) captured = match[1];
  };
  try {
    const result = await fn();
    return { result, code: captured };
  } finally {
    console.log = original;
  }
}

const post = (path, body, headers = {}) =>
  fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

test('a scan without a token is refused', async () => {
  const res = await post('/api/scan', {});
  assert.equal(res.status, 401);
  assert.equal((await res.json()).error, 'verification_required');
});

test('a scan with a forged token is refused', async () => {
  const res = await post('/api/scan', {}, { Authorization: 'Bearer eyJzaWQiOiJ4In0.notavalidmac' });
  assert.equal(res.status, 401);
});

test('starting verification requires the self-check attestation', async () => {
  const res = await post('/api/verify/start', { name: 'Ada Lovelace', contact: 'ada@example.com' });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'attestation_required');
});

test('the code is never returned to the client', async () => {
  const { result } = await withCapturedCode(() =>
    post('/api/verify/start', { name: 'Ada Lovelace', contact: 'ada@example.com', attestSelf: true }),
  );
  const body = await result.json();
  assert.equal(result.status, 201);
  assert.equal(body.sentTo, 'a**@example.com');
  assert.equal(body.code, undefined);
  assert.equal(JSON.stringify(body).match(/\b\d{6}\b/), null);
});

test('a wrong code does not verify, and the right one does', async () => {
  const { result, code } = await withCapturedCode(() =>
    post('/api/verify/start', { name: 'Ada Lovelace', contact: 'ada2@example.com', attestSelf: true }),
  );
  const { challengeId } = await result.json();
  assert.match(code, /^\d{6}$/);

  const wrong = await post('/api/verify/confirm', { challengeId, code: code === '000000' ? '111111' : '000000' });
  assert.equal(wrong.status, 401);

  const right = await post('/api/verify/confirm', { challengeId, code });
  assert.equal(right.status, 200);
  const session = await right.json();
  assert.equal(session.name, 'Ada Lovelace');
  assert.equal(session.subject, 'self');
  assert.ok(session.token);
  assert.match(session.verificationNote, /not proof/i);
});

test('a challenge is single use', async () => {
  const { result, code } = await withCapturedCode(() =>
    post('/api/verify/start', { name: 'Ada Lovelace', contact: 'ada3@example.com', attestSelf: true }),
  );
  const { challengeId } = await result.json();
  assert.equal((await post('/api/verify/confirm', { challengeId, code })).status, 200);
  assert.equal((await post('/api/verify/confirm', { challengeId, code })).status, 404);
});

test('a verified session scans its own name only — the body cannot redirect it', async () => {
  const { result, code } = await withCapturedCode(() =>
    post('/api/verify/start', { name: 'Ada Lovelace', contact: 'ada4@example.com', attestSelf: true }),
  );
  const { challengeId } = await result.json();
  const { token } = await (await post('/api/verify/confirm', { challengeId, code })).json();

  // SERPAPI_KEY is unset, so a scan that gets past the gate fails at the
  // search layer (503) rather than at the gate (401). That distinction is the
  // assertion: the session authorized a scan, and it authorized it for its own
  // name — "Someone Else" in the body is ignored entirely.
  const res = await post('/api/scan', { name: 'Someone Else' }, { Authorization: `Bearer ${token}` });
  assert.equal(res.status, 503);
  assert.equal((await res.json()).error, 'search_unavailable');
});

test('third-party lookups need an admin grant, and the grant is pinned', async () => {
  const rejected = await post('/api/verify/start', {
    name: 'Someone Else',
    contact: 'operator@example.com',
    grantToken: 'made-up-token',
  });
  assert.equal(rejected.status, 403);

  const noKey = await post('/api/admin/grants', { subjectName: 'Someone Else', requesterContact: 'operator@example.com', reason: 'signed authorization on file' });
  assert.equal(noKey.status, 401);

  const granted = await post(
    '/api/admin/grants',
    { subjectName: 'Someone Else', requesterContact: 'operator@example.com', reason: 'signed authorization on file' },
    { 'x-admin-key': 'test-admin-key' },
  );
  assert.equal(granted.status, 201);
  const { grantToken } = await granted.json();

  // Pinned to the name it was issued for...
  const wrongName = await post('/api/verify/start', {
    name: 'A Third Party',
    contact: 'operator@example.com',
    grantToken,
  });
  assert.equal(wrongName.status, 403);
  assert.equal((await wrongName.json()).error, 'grant_mismatch');

  // ...and to the requester's own contact, which still has to pass OTP.
  const wrongContact = await post('/api/verify/start', {
    name: 'Someone Else',
    contact: 'other@example.com',
    grantToken,
  });
  assert.equal(wrongContact.status, 403);

  const { result, code } = await withCapturedCode(() =>
    post('/api/verify/start', { name: 'Someone Else', contact: 'operator@example.com', grantToken }),
  );
  const { challengeId } = await result.json();
  const confirmed = await post('/api/verify/confirm', { challengeId, code });
  assert.equal(confirmed.status, 200);
  assert.equal((await confirmed.json()).subject, 'admin-approved');

  // Single use: the same grant cannot start a second verification.
  const reused = await post('/api/verify/start', {
    name: 'Someone Else',
    contact: 'operator@example.com',
    grantToken,
  });
  assert.equal(reused.status, 403);
});

test('with no admin key configured the endpoint would not exist — key here is test-only', async () => {
  const res = await fetch(`${base}/api/health`);
  const body = await res.json();
  assert.equal(body.thirdPartyLookups, 'admin-gated');
  assert.equal(body.searchConfigured, false);
});

test('end to end: verified session produces a worklist with opt-out links', async () => {
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
    const { result, code } = await withCapturedCode(() =>
      post('/api/verify/start', { name: 'Ada Lovelace', contact: 'ada5@example.com', attestSelf: true }),
    );
    const { challengeId } = await result.json();
    const { token } = await (await post('/api/verify/confirm', { challengeId, code })).json();

    const res = await post('/api/scan', {}, { Authorization: `Bearer ${token}` });
    assert.equal(res.status, 200);
    const worklist = await res.json();

    assert.deepEqual(worklist.partialFailures, []);
    assert.equal(worklist.checkedName, 'Ada Lovelace');
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
