import { config } from '../config.js';
import { lookupBroker } from './brokers.js';

/**
 * Google organic results via SerpAPI. Paid per query, ToS-safe, and the only
 * Google path here — nothing in this project scrapes a search page directly.
 */

const ENDPOINT = 'https://serpapi.com/search.json';

export function buildQueries(name) {
  const quoted = `"${name}"`;
  return [
    { id: 'name', q: quoted, label: 'Your name on the open web' },
    // Broker pages are the useful ones: each carries an opt-out path.
    {
      id: 'brokers',
      q: `${quoted} (site:whitepages.com OR site:yellowpages.com OR site:spokeo.com OR site:beenverified.com OR site:radaris.com OR site:truepeoplesearch.com OR site:fastpeoplesearch.com)`,
      label: 'People-search and directory listings',
    },
  ];
}

async function runQuery(q, { fetchImpl = fetch, location } = {}) {
  const params = new URLSearchParams({
    engine: 'google',
    q,
    api_key: config.serpapi.key,
    num: '20',
    hl: 'en',
    gl: 'us',
  });
  if (location) params.set('location', location);

  const res = await fetchImpl(`${ENDPOINT}?${params}`);
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    const err = new Error(`SerpAPI responded ${res.status}: ${detail.slice(0, 200)}`);
    err.status = res.status === 401 ? 502 : 502;
    throw err;
  }
  const data = await res.json();
  if (data.error) throw new Error(`SerpAPI error: ${data.error}`);
  return Array.isArray(data.organic_results) ? data.organic_results : [];
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** Turn raw organic results into normalized findings, deduped by URL. */
export function normalizeResults(results, { queryId }) {
  const seen = new Set();
  const findings = [];
  for (const item of results) {
    const link = item?.link;
    if (!link || seen.has(link)) continue;
    seen.add(link);
    const host = hostOf(link);
    const broker = lookupBroker(host);
    findings.push({
      source: broker?.name || host || 'Unknown source',
      host,
      url: link,
      title: item.title || link,
      snippet: item.snippet || '',
      kind: broker ? 'data-broker' : 'web-result',
      discoveredBy: queryId,
      broker: broker || null,
    });
  }
  return findings;
}

export async function searchGoogle(name, options = {}) {
  if (!config.serpapi.key) {
    const err = new Error('SERPAPI_KEY is not configured; the search layer cannot run.');
    err.status = 503;
    err.code = 'search_unavailable';
    throw err;
  }
  const queries = buildQueries(name);
  const settled = await Promise.allSettled(
    queries.map(async (query) => normalizeResults(await runQuery(query.q, options), { queryId: query.id })),
  );

  const findings = [];
  const errors = [];
  settled.forEach((outcome, i) => {
    if (outcome.status === 'fulfilled') findings.push(...outcome.value);
    else errors.push({ query: queries[i].id, message: outcome.reason?.message || 'Query failed' });
  });

  // Both queries can surface the same URL; the first one wins.
  const byUrl = new Map();
  for (const finding of findings) if (!byUrl.has(finding.url)) byUrl.set(finding.url, finding);
  return { findings: [...byUrl.values()], errors, queriesRun: queries.length };
}
