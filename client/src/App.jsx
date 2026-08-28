import { useState } from 'react';
import { api } from './api.js';
import { NameStep } from './components/NameStep.jsx';
import { VerifyStep } from './components/VerifyStep.jsx';
import { Worklist } from './components/Worklist.jsx';
import { Notice } from './components/Notice.jsx';

/**
 * One flow: enter name -> verify -> worklist. The scan is fired the moment
 * verification succeeds, so there is no state in which a query has run without
 * a confirmed code.
 */
export default function App() {
  const [stage, setStage] = useState('name'); // name | verify | scanning | results
  const [challenge, setChallenge] = useState(null);
  const [session, setSession] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const restart = () => {
    setStage('name');
    setChallenge(null);
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
      setStage(result ? 'results' : 'verify');
    }
  }

  async function handleStart(payload) {
    setBusy(true);
    setError('');
    try {
      setChallenge(await api.startVerification(payload));
      setStage('verify');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm(code) {
    setBusy(true);
    setError('');
    try {
      const verified = await api.confirmCode(challenge.challengeId, code);
      setSession(verified);
      await runScan(verified.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    try {
      await api.resendCode(challenge.challengeId);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="page">
      <header className="page__header">
        <h1>Digital Footprint Self-Check</h1>
        <p className="muted">
          See what is exposed about you online, and get a to-do list for taking it down. This is a
          self-check tool — it runs only on the person using it, after they verify a contact they
          control.
        </p>
      </header>

      {stage === 'name' ? <NameStep onStart={handleStart} busy={busy} error={error} /> : null}

      {stage === 'verify' ? (
        <VerifyStep
          challenge={challenge}
          onConfirm={handleConfirm}
          onResend={handleResend}
          onRestart={restart}
          busy={busy}
          error={error}
        />
      ) : null}

      {stage === 'scanning' ? (
        <section className="card">
          <h2>Checking…</h2>
          <p className="muted">Verified. Running searches for {session?.name} and building your worklist.</p>
          <div className="spinner" aria-label="Scanning" />
        </section>
      ) : null}

      {stage === 'results' && result ? (
        <>
          {error ? <Notice tone="error">{error}</Notice> : null}
          <Worklist result={result} scanning={busy} onRescan={() => session && runScan(session.token)} />
          <div className="row row--center">
            <button type="button" className="link" onClick={restart}>
              Start over
            </button>
          </div>
        </>
      ) : null}

      <footer className="page__footer">
        <p>
          Verification proves control of a contact, not ownership of a name. Results come from
          Google organic search via SerpAPI; nothing here scrapes search pages, and nothing about
          your scan is stored after your session expires.
        </p>
      </footer>
    </main>
  );
}
