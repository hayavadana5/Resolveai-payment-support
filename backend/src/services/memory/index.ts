import { isCogneeConfigured } from '../../config/env';
import { recordAudit } from '../audit.service';
import { searchCognee } from './cognee.client';
import { searchLocalKnowledge } from './local.fallback';
import type { MemoryResult } from './types';

export * from './types';
export { ingestKnowledge } from './cognee.client';
export { knowledgeBase } from './knowledge.seed';

/**
 * Retrieves organisational knowledge for a case. Cognee is attempted first; if it
 * is unconfigured or unreachable we fall back to local keyword retrieval over the
 * same corpus and say so plainly. The mode is surfaced in the API and the UI, so
 * the system never claims Cognee was used when it was not.
 */
export async function retrieveKnowledge(
  query: string,
  tags: string[] = [],
  caseId?: string
): Promise<MemoryResult> {
  const started = Date.now();

  if (isCogneeConfigured()) {
    try {
      const knowledge = await searchCognee(`${query} ${tags.join(' ')}`.trim());
      await recordAudit({
        caseId,
        event: 'MEMORY_RETRIEVAL',
        actor: 'COGNEE',
        summary: `Retrieved ${knowledge.length} knowledge items from Cognee`,
        detail: { query, tags, titles: knowledge.map((k) => k.title) },
        outcome: 'SUCCESS',
        durationMs: Date.now() - started,
      });
      return { mode: 'COGNEE', knowledge };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown Cognee error';
      const knowledge = searchLocalKnowledge(query, tags);
      await recordAudit({
        caseId,
        event: 'MEMORY_RETRIEVAL',
        actor: 'LOCAL_FALLBACK',
        summary: `Cognee unavailable (${reason}); used local knowledge fallback`,
        detail: { query, tags, titles: knowledge.map((k) => k.title) },
        outcome: 'FAILURE',
        durationMs: Date.now() - started,
      });
      return { mode: 'LOCAL_FALLBACK', knowledge, fallbackReason: reason };
    }
  }

  const knowledge = searchLocalKnowledge(query, tags);
  await recordAudit({
    caseId,
    event: 'MEMORY_RETRIEVAL',
    actor: 'LOCAL_FALLBACK',
    summary: `Retrieved ${knowledge.length} knowledge items from local fallback (Cognee not configured)`,
    detail: { query, tags, titles: knowledge.map((k) => k.title) },
    outcome: 'INFO',
    durationMs: Date.now() - started,
  });
  return { mode: 'LOCAL_FALLBACK', knowledge, fallbackReason: 'Cognee credentials not configured' };
}
