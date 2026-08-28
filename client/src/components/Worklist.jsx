import { useMemo, useState } from 'react';
import { Notice } from './Notice.jsx';

const PRIORITY_LABEL = { high: 'Do first', medium: 'Worth doing', low: 'Optional' };

function WorklistItem({ item, done, onToggle }) {
  const [open, setOpen] = useState(false);

  return (
    <li className={`item item--${item.priority} ${done ? 'item--done' : ''}`}>
      <div className="item__head">
        <label className="checkbox checkbox--task">
          <input type="checkbox" checked={done} onChange={onToggle} />
          <span className="sr-only">Mark handled</span>
        </label>

        <div className="item__body">
          <div className="item__meta">
            <span className={`pill pill--${item.priority}`}>{PRIORITY_LABEL[item.priority]}</span>
            <span className="pill pill--muted">{item.category}</span>
            <span className="pill pill--muted">{item.difficulty}</span>
            <span className="pill pill--muted">{item.typicalTime}</span>
          </div>

          <h3 className="item__title">{item.source}</h3>
          <p className="item__url">
            <a href={item.url} target="_blank" rel="noreferrer noopener">
              {item.title}
            </a>
          </p>

          <p className="item__exposed">
            <strong>Exposed:</strong> {item.exposed.join(' · ')}
            {item.exposedIsInferred ? (
              <span className="muted"> (from the search result; open the page to confirm)</span>
            ) : null}
          </p>

          <div className="row">
            <a className="button button--primary" href={item.action.url} target="_blank" rel="noreferrer noopener">
              {item.action.label}
            </a>
            <button type="button" className="link" onClick={() => setOpen((value) => !value)}>
              {open ? 'Hide steps' : 'Show steps'}
            </button>
          </div>

          {open ? (
            <div className="item__steps">
              <ol>
                {item.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <p className="hint">
                Requires: {item.requires}.
                {item.optOutCheckedOn
                  ? ` Opt-out path last reviewed ${item.optOutCheckedOn}; if the link has moved, search the site for "privacy" or "opt out".`
                  : ''}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export function Worklist({ result, onRescan, scanning }) {
  const [doneIds, setDoneIds] = useState(() => new Set());

  const toggle = (id) =>
    setDoneIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const remaining = useMemo(
    () => result.items.filter((item) => !doneIds.has(item.id)).length,
    [result.items, doneIds],
  );

  return (
    <section className="card card--wide">
      <header className="worklist__header">
        <div>
          <h2>Your remediation worklist</h2>
          <p className="muted">
            {result.summary.total} finding{result.summary.total === 1 ? '' : 's'} for{' '}
            <strong>{result.checkedName}</strong> — {result.summary.brokerListings} broker listing
            {result.summary.brokerListings === 1 ? '' : 's'} with an opt-out path,{' '}
            {result.summary.otherPages} other page{result.summary.otherPages === 1 ? '' : 's'}.{' '}
            <strong>{remaining} left to do.</strong>
          </p>
        </div>
        <button type="button" className="button" onClick={onRescan} disabled={scanning || result.scansRemaining === 0}>
          {scanning ? 'Re-checking…' : `Re-check (${result.scansRemaining} left)`}
        </button>
      </header>

      {result.partialFailures?.length ? (
        <Notice tone="warn" title="Some queries did not complete">
          {result.partialFailures.map((failure) => `${failure.query}: ${failure.message}`).join(' · ')} — the list
          below is incomplete.
        </Notice>
      ) : null}

      {result.items.length === 0 ? (
        <Notice tone="info" title="Nothing surfaced in this pass">
          No results came back for this name. That is not proof of absence — brokers republish and
          indexing lags. Re-check periodically.
        </Notice>
      ) : (
        <ul className="items">
          {result.items.map((item) => (
            <WorklistItem key={item.id} item={item} done={doneIds.has(item.id)} onToggle={() => toggle(item.id)} />
          ))}
        </ul>
      )}

      <p className="hint">{result.disclaimer}</p>
    </section>
  );
}
