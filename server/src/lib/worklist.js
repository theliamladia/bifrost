import { GENERIC_REMEDIATION } from '../sources/brokers.js';
import { randomId } from './tokens.js';

/**
 * Findings -> a worklist.
 *
 * The output is deliberately a list of tasks, not a profile of a person: each
 * item says where the exposure is, what is exposed, and what to do about it.
 * Nothing here aggregates findings into a dossier.
 */

const DIFFICULTY_RANK = { easy: 0, medium: 1, hard: 2 };

function priorityOf(finding) {
  // Broker listings first: they carry structured personal data and a real
  // opt-out path, so they are both the worst exposure and the most fixable.
  if (finding.kind === 'data-broker') return 'high';
  if (/\b(address|phone|obituary|court|arrest|voter)\b/i.test(`${finding.title} ${finding.snippet}`)) return 'medium';
  return 'low';
}

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };

export function buildWorklist(findings, { name }) {
  const items = findings.map((finding) => {
    const broker = finding.broker;
    const priority = priorityOf(finding);
    return {
      id: randomId(8),
      priority,
      source: finding.source,
      host: finding.host,
      url: finding.url,
      title: finding.title,
      snippet: finding.snippet,
      category: broker?.category || 'Web page',
      // For a broker we know the data classes; for anything else we can only
      // report what the search result itself showed.
      exposed: broker?.exposes || ['Name mentioned in a public page'],
      exposedIsInferred: !broker,
      action: broker
        ? { type: 'opt-out', url: broker.optOutUrl, label: `Opt out of ${broker.name}` }
        : { type: 'request-removal', url: GENERIC_REMEDIATION.referenceUrl, label: 'Request removal' },
      steps: broker?.steps || GENERIC_REMEDIATION.steps,
      requires: broker?.requires || GENERIC_REMEDIATION.requires,
      typicalTime: broker?.typicalTime || GENERIC_REMEDIATION.typicalTime,
      difficulty: broker?.difficulty || GENERIC_REMEDIATION.difficulty,
      optOutCheckedOn: broker?.checkedOn || null,
      status: 'todo',
    };
  });

  items.sort((a, b) => {
    const byPriority = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (byPriority !== 0) return byPriority;
    // Within a priority band, put the quick wins first.
    const byDifficulty = DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[b.difficulty];
    if (byDifficulty !== 0) return byDifficulty;
    return a.source.localeCompare(b.source);
  });

  return {
    checkedName: name,
    generatedAt: new Date().toISOString(),
    summary: {
      total: items.length,
      brokerListings: items.filter((i) => i.action.type === 'opt-out').length,
      otherPages: items.filter((i) => i.action.type !== 'opt-out').length,
      byPriority: {
        high: items.filter((i) => i.priority === 'high').length,
        medium: items.filter((i) => i.priority === 'medium').length,
        low: items.filter((i) => i.priority === 'low').length,
      },
    },
    items,
  };
}
