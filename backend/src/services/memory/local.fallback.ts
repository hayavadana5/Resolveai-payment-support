import { knowledgeBase, KnowledgeRecord } from './knowledge.seed';
import type { RetrievedKnowledge } from './types';

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'was', 'were', 'is', 'my', 'i', 'but', 'and', 'for', 'of', 'to', 'in', 'on',
  'it', 'this', 'that', 'not', 'placed', 'want', 'have',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

function score(record: KnowledgeRecord, tokens: string[], tags: string[]): number {
  const haystack = `${record.title} ${record.content} ${record.tags.join(' ')}`.toLowerCase();
  let s = 0;
  for (const token of tokens) if (haystack.includes(token)) s += 1;
  for (const tag of tags) if (record.tags.some((t) => t.toLowerCase() === tag.toLowerCase())) s += 4;
  return s;
}

/** Keyword retrieval over the same corpus that is loaded into Cognee. */
export function searchLocalKnowledge(query: string, tags: string[] = [], limit = 4): RetrievedKnowledge[] {
  const tokens = tokenize(query);
  const maxScore = Math.max(1, tokens.length + tags.length * 4);
  return knowledgeBase
    .map((record) => ({ record, raw: score(record, tokens, tags) }))
    .filter((r) => r.raw > 0)
    .sort((a, b) => b.raw - a.raw)
    .slice(0, limit)
    .map(({ record, raw }) => ({
      title: record.title,
      content: record.content,
      source: record.source,
      relevance: Number(Math.min(0.99, raw / maxScore).toFixed(2)),
    }));
}
