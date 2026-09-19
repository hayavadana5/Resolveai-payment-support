import { env, isCogneeConfigured } from '../../config/env';
import { knowledgeBase } from './knowledge.seed';
import type { RetrievedKnowledge } from './types';

const TIMEOUT_MS = 8000;

async function cogneeRequest<T>(path: string, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${env.cogneeApiUrl.replace(/\/$/, '')}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.cogneeApiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Cognee responded ${response.status} ${response.statusText}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Pushes the organisational knowledge corpus into Cognee. Run from the seed script. */
export async function ingestKnowledge(): Promise<{ ingested: number }> {
  if (!isCogneeConfigured()) throw new Error('Cognee is not configured');
  const documents = knowledgeBase.map((record) => ({
    id: record.title,
    text: `${record.title}\n\n${record.content}\n\nTags: ${record.tags.join(', ')}\nSource: ${record.source}`,
    metadata: { tags: record.tags, source: record.source, title: record.title },
  }));
  await cogneeRequest('/api/v1/add', { dataset: env.cogneeDataset, data: documents });
  await cogneeRequest('/api/v1/cognify', { datasets: [env.cogneeDataset] });
  return { ingested: documents.length };
}

interface CogneeSearchResponse {
  results?: Array<{
    text?: string;
    score?: number;
    metadata?: { title?: string; source?: string };
  }>;
}

export async function searchCognee(query: string, limit = 4): Promise<RetrievedKnowledge[]> {
  if (!isCogneeConfigured()) throw new Error('Cognee is not configured');
  const data = await cogneeRequest<CogneeSearchResponse>('/api/v1/search', {
    dataset: env.cogneeDataset,
    query,
    searchType: 'GRAPH_COMPLETION',
    limit,
  });
  const results = data.results ?? [];
  if (results.length === 0) throw new Error('Cognee returned no results');
  return results.slice(0, limit).map((r) => ({
    title: r.metadata?.title ?? 'Retrieved knowledge',
    content: (r.text ?? '').trim(),
    source: r.metadata?.source ?? 'Cognee knowledge graph',
    relevance: Number((r.score ?? 0.5).toFixed(2)),
  }));
}
