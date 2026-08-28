import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeContact, normalizeName, redactContact, ContactError } from '../src/lib/contact.js';

// normalizeContact backs the optional "who was this approval handed to" field
// in the audit record; normalizeName backs the subject of every approval.

test('normalizes emails to one canonical form', () => {
  assert.deepEqual(normalizeContact('  Person@Example.COM '), { channel: 'email', value: 'person@example.com' });
});

test('rejects malformed emails', () => {
  assert.throws(() => normalizeContact('person@localhost'), ContactError);
});

test('normalizes phone numbers to E.164', () => {
  assert.deepEqual(normalizeContact('(415) 555-0123'), { channel: 'sms', value: '+14155550123' });
  assert.deepEqual(normalizeContact('1-415-555-0123'), { channel: 'sms', value: '+14155550123' });
  assert.deepEqual(normalizeContact('+442071838750'), { channel: 'sms', value: '+442071838750' });
});

test('rejects unparseable phone numbers', () => {
  assert.throws(() => normalizeContact('12345'), ContactError);
});

test('redaction never leaks the full contact', () => {
  assert.equal(redactContact({ channel: 'email', value: 'person@example.com' }), 'p*****@example.com');
  assert.equal(redactContact({ channel: 'sms', value: '+14155550123' }), '********0123');
});

test('name normalization collapses whitespace and rejects query syntax', () => {
  assert.equal(normalizeName('  Ada   Lovelace '), 'Ada Lovelace');
  assert.throws(() => normalizeName('a'), ContactError);
  assert.throws(() => normalizeName('Ada (site:example.com)'), ContactError);
});
