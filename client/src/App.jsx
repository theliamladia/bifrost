import { useState } from 'react';
import { api } from './api.js';
import { ApprovalStep } from './components/ApprovalStep.jsx';
import { Worklist } from './components/Worklist.jsx';
import { Notice, ApprovalHonestyNote } from './components/Notice.jsx';

/**
 * One flow: redeem an approval -> worklist. The scan fires the moment the
 * approval is redeemed, so there is no state in which a query has run without
 * an administrator having approved it.
 */
export default function App() {
  const [stage, setStage] = useState('approval'); // approval | scanning | results
  const [session, setSession] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const restart = () => {
    setStage('approval');
    setSession(null);
    setResult(null);
    setError('');
  };

  async function runScan(token) {
    setStage('scanning');
    setError('');
    try {
      setResult(await api.scan(token));
      setStage('results');
    } catch (err) {
      setError(err.message);
      // A failed re-check keeps the list already on screen; a failed first scan
      // sends the requester back to the start, since the approval is spent.
      setStage(result ? 'results' : 'approval');
    }
  }

  async function handleRedeem(approvalCode) {
    setBusy(true);
    setError('');
    try {
      const approved = await api.redeemApproval(approvalCode);
      setSession(approved);
      await runScan(approved.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <header className="page__header">
        <h1>Digital Footprint Self-Check</h1>
        <p className="muted">
          See what is exposed about a person online, and get a to-do list for taking it down. Every
          check is approved by an administrator first, and runs only for the name that approval
          names.
        </p>
      </header>

      {stage === 'approval' ? <ApprovalStep onRedeem={handleRedeem} busy={busy} error={error} /> : null}

      {stage === 'scanning' ? (
        <section className="card">
          <h2>Checking…</h2>
          <p className="muted">
            Approval accepted. Running searches for {session?.name} and building the worklist.
          </p>
          <div className="spinner" aria-label="Scanning" />
        </section>
      ) : null}

      {stage === 'results' && result ? (
        <>
          {error ? <Notice tone="error">{error}</Notice> : null}
          <Notice tone="info" title="Approved check">
            Approved by <strong>{session?.approvedBy || 'an administrator'}</strong> for{' '}
            <strong>{result.checkedName}</strong>
            {result.relationship === 'third-party' ? ' (a third-party check)' : ' (a self-check)'}.
            This session expires shortly and allows a limited number of re-checks.
          </Notice>
          <Worklist result={result} scanning={busy} onRescan={() => session && runScan(session.token)} />
          <div className="row row--center">
            <button type="button" className="link" onClick={restart}>
              Start over
            </button>
          </div>
          <ApprovalHonestyNote />
        </>
      ) : null}

      <footer className="page__footer">
        <p>
          Consent comes from the administrator who approved this check; the code proves the approval
          exists, not who is holding it. Results come from Google organic search via SerpAPI; nothing
          here scrapes search pages, and nothing about the scan is stored after the session expires.
        </p>
      </footer>
    </main>
  );
}
