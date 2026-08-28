import { useEffect, useRef, useState } from 'react';
import { Notice, VerificationHonestyNote } from './Notice.jsx';

export function VerifyStep({ challenge, onConfirm, onResend, onRestart, busy, error }) {
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(challenge.resendAfterSeconds ?? 30);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setInterval(() => setCooldown((seconds) => Math.max(seconds - 1, 0)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  return (
    <form
      className="card"
      onSubmit={(event) => {
        event.preventDefault();
        if (code.length >= 4 && !busy) onConfirm(code);
      }}
    >
      <h2>Enter your code</h2>
      <p className="muted">
        We sent a 6-digit code to <strong>{challenge.sentTo}</strong> by{' '}
        {challenge.channel === 'email' ? 'email' : 'SMS'}. Nothing has been searched yet.
      </p>

      <label htmlFor="code">Verification code</label>
      <input
        id="code"
        ref={inputRef}
        value={code}
        onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="000000"
        className="code-input"
      />

      {error ? <Notice tone="error">{error}</Notice> : null}

      <button type="submit" disabled={code.length < 4 || busy}>
        {busy ? 'Verifying…' : 'Verify and run my scan'}
      </button>

      <div className="row">
        <button
          type="button"
          className="link"
          disabled={cooldown > 0 || busy}
          onClick={() => {
            onResend();
            setCooldown(challenge.resendAfterSeconds ?? 30);
          }}
        >
          {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
        </button>
        <button type="button" className="link" onClick={onRestart}>
          Use a different contact
        </button>
      </div>

      <VerificationHonestyNote />
    </form>
  );
}
