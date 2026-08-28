import { useState } from 'react';
import { Notice, ApprovalHonestyNote } from './Notice.jsx';

/**
 * The only thing a requester enters. The name being checked is not typed here
 * — it comes off the approval, so this form cannot be aimed at anyone.
 */
export function ApprovalStep({ onRedeem, busy, error }) {
  const [approvalCode, setApprovalCode] = useState('');
  const canSubmit = approvalCode.trim().length > 0 && !busy;

  return (
    <form
      className="card"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit) onRedeem(approvalCode.trim());
      }}
    >
      <h2>Enter your approval code</h2>
      <p className="muted">
        Checks are approved by an administrator before they run. Your code already carries the name
        to be checked — there is nothing to type in but the code itself.
      </p>

      <label htmlFor="approvalCode">Approval code</label>
      <input
        id="approvalCode"
        value={approvalCode}
        onChange={(event) => setApprovalCode(event.target.value)}
        placeholder="Issued by your administrator"
        autoComplete="off"
        spellCheck="false"
        required
      />
      <p className="hint">Single use, and it expires an hour after it was issued.</p>

      {error ? <Notice tone="error">{error}</Notice> : null}

      <button type="submit" disabled={!canSubmit}>
        {busy ? 'Checking approval…' : 'Run the approved check'}
      </button>

      <Notice tone="info" title="Don't have a code?">
        Ask your administrator to approve the check. They record whose footprint is being checked
        and why, then issue you a code for that one name.
      </Notice>

      <ApprovalHonestyNote />
    </form>
  );
}
