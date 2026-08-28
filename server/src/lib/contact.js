/**
 * Contact normalization.
 *
 * Used for the optional record of who an approval was handed to, so it must
 * normalize to exactly one canonical string — otherwise "a@b.com" and
 * "A@B.com " look like two people in the audit log.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export class ContactError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ContactError';
    this.status = 400;
  }
}

export function normalizeContact(raw) {
  const input = String(raw ?? '').trim();
  if (!input) throw new ContactError('Enter an email address or phone number.');

  if (input.includes('@')) {
    const value = input.toLowerCase();
    if (!EMAIL_RE.test(value)) throw new ContactError('That email address does not look valid.');
    return { channel: 'email', value };
  }

  const digits = input.replace(/[^\d+]/g, '');
  // E.164: optional +, 8-15 digits. Bare 10-digit US numbers get a +1.
  let e164;
  if (digits.startsWith('+')) {
    e164 = digits;
  } else if (digits.length === 10) {
    e164 = `+1${digits}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    e164 = `+${digits}`;
  } else {
    throw new ContactError('Enter a phone number in international format, e.g. +14155550123.');
  }
  if (!/^\+[1-9]\d{7,14}$/.test(e164)) {
    throw new ContactError('Enter a phone number in international format, e.g. +14155550123.');
  }
  return { channel: 'sms', value: e164 };
}

/** Never echo a full contact back to the client; it is a confirmation, not data. */
export function redactContact({ channel, value }) {
  if (channel === 'email') {
    const [user, domain] = value.split('@');
    const head = user.slice(0, 1);
    return `${head}${'*'.repeat(Math.max(user.length - 1, 1))}@${domain}`;
  }
  return `${'*'.repeat(Math.max(value.length - 4, 0))}${value.slice(-4)}`;
}

export function normalizeName(raw) {
  const name = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (name.length < 2) throw new ContactError('Enter the full name you want to check.');
  if (name.length > 80) throw new ContactError('That name is too long.');
  // Query strings only; keep out characters that only serve to shape a search.
  if (/["()\[\]{}<>|\\]/.test(name)) throw new ContactError('Remove punctuation from the name.');
  return name;
}
