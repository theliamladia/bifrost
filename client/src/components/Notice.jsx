export function Notice({ tone = 'info', title, children }) {
  return (
    <div className={`notice notice--${tone}`} role={tone === 'error' ? 'alert' : 'note'}>
      {title ? <strong className="notice__title">{title}</strong> : null}
      <div>{children}</div>
    </div>
  );
}

/**
 * Shown at every stage. Controlling an inbox is not proof that the inbox
 * belongs to the name typed in the box, and saying so plainly is part of the
 * product, not fine print.
 */
export function VerificationHonestyNote() {
  return (
    <Notice tone="warn" title="What this verification does and does not prove">
      Sending a code proves you control this email address or phone number. It does{' '}
      <strong>not</strong> prove the contact belongs to the name you entered. This stops casual
      misuse; it will not stop a determined actor. Stronger identity proofing (for example Stripe
      Identity) is a possible later addition.
    </Notice>
  );
}
