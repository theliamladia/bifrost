import { useState } from 'react';
import { Notice, VerificationHonestyNote } from './Notice.jsx';

export function NameStep({ onStart, busy, error }) {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [attest, setAttest] = useState(false);

  const canSubmit = name.trim().length >= 2 && contact.trim().length > 0 && attest && !busy;

  return (
    <form
      className="card"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit) onStart({ name: name.trim(), contact: contact.trim(), attestSelf: true });
      }}
    >
      <h2>Check your own footprint</h2>
      <p className="muted">
        This tool only runs on the person using it. Enter your name and a contact you control — we
        send a code there and nothing is searched until you enter it back.
      </p>

      <label htmlFor="name">Name to check</label>
      <input
        id="name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Your full name"
        autoComplete="name"
        required
      />

      <label htmlFor="contact">Your email or phone</label>
      <input
        id="contact"
        value={contact}
        onChange={(event) => setContact(event.target.value)}
        placeholder="you@example.com or +14155550123"
        autoComplete="email"
        required
      />
      <p className="hint">The code goes here. Use an address or number you can open right now.</p>

      <label className="checkbox">
        <input type="checkbox" checked={attest} onChange={(event) => setAttest(event.target.checked)} />
        <span>
          I am checking my own footprint, and I control the contact above. Looking up anyone else
          requires written authorization from an administrator.
        </span>
      </label>

      {error ? <Notice tone="error">{error}</Notice> : null}

      <button type="submit" disabled={!canSubmit}>
        {busy ? 'Sending code…' : 'Send verification code'}
      </button>

      <VerificationHonestyNote />
    </form>
  );
}
