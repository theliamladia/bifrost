import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWorklist } from '../src/lib/worklist.js';
import { lookupBroker } from '../src/sources/brokers.js';
import { normalizeResults } from '../src/sources/serpapi.js';

const RESULTS = [
  { link: 'https://www.spokeo.com/Ada-Lovelace', title: 'Ada Lovelace - Spokeo', snippet: 'Age 36, lives in Austin TX' },
  { link: 'https://example.org/blog/post', title: 'A blog post mentioning Ada Lovelace', snippet: 'A conference talk' },
  { link: 'https://www.spokeo.com/Ada-Lovelace', title: 'duplicate', snippet: '' },
];

test('broker lookup matches hosts and subdomains', () => {
  assert.equal(lookupBroker('www.spokeo.com')?.key, 'spokeo');
  assert.equal(lookupBroker('records.radaris.com')?.key, 'radaris');
  assert.equal(lookupBroker('example.org'), null);
});

test('normalizing results dedupes by URL and tags brokers', () => {
  const findings = normalizeResults(RESULTS, { queryId: 'brokers' });
  assert.equal(findings.length, 2);
  assert.equal(findings[0].kind, 'data-broker');
  assert.equal(findings[1].kind, 'web-result');
});

test('worklist puts broker opt-outs first and carries an action for every item', () => {
  const worklist = buildWorklist(normalizeResults(RESULTS, { queryId: 'brokers' }), { name: 'Ada Lovelace' });
  assert.equal(worklist.summary.total, 2);
  assert.equal(worklist.summary.brokerListings, 1);
  assert.equal(worklist.items[0].priority, 'high');
  assert.equal(worklist.items[0].action.type, 'opt-out');
  assert.match(worklist.items[0].action.url, /^https:\/\//);
  for (const item of worklist.items) {
    assert.ok(item.steps.length > 0, 'every item needs remediation steps');
    assert.ok(item.action.url, 'every item needs an actionable link');
    assert.equal(item.status, 'todo');
  }
});

test('non-broker exposure is marked as inferred, not asserted', () => {
  const worklist = buildWorklist(normalizeResults(RESULTS, { queryId: 'name' }), { name: 'Ada Lovelace' });
  const generic = worklist.items.find((i) => i.host === 'example.org');
  assert.equal(generic.exposedIsInferred, true);
});
