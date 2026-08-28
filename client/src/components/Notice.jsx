export function Notice({ tone = 'info', title, children }) {
  return (
    <div className={`notice notice--${tone}`} role={tone === 'error' ? 'alert' : 'note'}>
      {title ? <strong className="notice__title">{title}</strong> : null}
      <div>{children}</div>
    </div>
  );
}

/**
 * Shown at every stage. An approval says a check may happen and for whom; it
 * does not establish who is holding the code. Saying so plainly is part of the
 * product, not fine print.
 */
export function ApprovalHonestyNote() {
  return (
    <Notice tone="warn" title="What an approval does and does not prove">
      An administrator approved this specific check — that is where consent comes from, not from
      anyone using this form. The code is the whole credential: it proves the approval was granted,
      it does <strong>not</strong> prove who is holding it, and nothing here confirms that the name
      being checked is yours. This stops casual misuse; it will not stop someone who was handed a
      code they should not have. Verifying the requester (a code to their email or phone) or the
      subject (identity proofing such as Stripe Identity) are both possible later additions.
    </Notice>
  );
}
