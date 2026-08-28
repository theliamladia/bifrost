import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { generateCode, hashCode, codeMatches } from '../src/lib/otp.js';

test('generates zero-padded codes of the requested length', () => {
  for (let i = 0; i < 200; i += 1) {
    const code = generateCode(6);
    assert.match(code, /^\d{6}$/);
  }
});

test('codes verify only against their own salt', () => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashCode('123456', salt);
  assert.ok(codeMatches('123456', salt, hash));
  assert.ok(!codeMatches('654321', salt, hash));
  assert.ok(!codeMatches('123456', crypto.randomBytes(16).toString('hex'), hash));
});
