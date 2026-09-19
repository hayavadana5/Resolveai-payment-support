import { isGeminiConfigured } from '../../config/env';
import { recordAudit } from '../audit.service';
import { requestDecision } from './gemini.client';
import { decideWithoutModel } from './fallback';
import type { InvestigationContext } from './prompt';
import type { AiDecision } from './schemas';
import type { AiMode } from '../../models/types';

export interface OrchestratedDecision extends AiDecision {
  aiMode: AiMode;
  fallbackReason?: string;
}

/**
 * Produces a structured decision for a case. Gemini is the reasoning engine when
 * configured and reachable; otherwise a deterministic rule engine stands in and
 * the mode is reported honestly as DEMO_FALLBACK everywhere it surfaces.
 */
export async function decide(
  ctx: InvestigationContext,
  caseId?: string
): Promise<OrchestratedDecision> {
  const started = Date.now();

  if (isGeminiConfigured()) {
    try {
      const decision = await requestDecision(ctx);
      await recordAudit({
        caseId,
        event: 'AI_DECISION',
        actor: 'GEMINI',
        actorType: 'AI',
        summary: `Gemini classified the case as ${decision.intent} with ${(decision.confidence * 100).toFixed(0)}% confidence and proposed ${decision.recommendedAction}`,
        detail: { decision },
        outcome: 'SUCCESS',
        durationMs: Date.now() - started,
      });
      return { ...decision, aiMode: 'GEMINI' };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown Gemini error';
      const decision = decideWithoutModel(ctx);
      await recordAudit({
        caseId,
        event: 'AI_DECISION',
        actor: 'DEMO_FALLBACK',
        actorType: 'AI',
        summary: `Gemini unavailable (${reason}); rule-based fallback proposed ${decision.recommendedAction}`,
        detail: { decision, reason },
        outcome: 'FAILURE',
        durationMs: Date.now() - started,
      });
      return { ...decision, aiMode: 'DEMO_FALLBACK', fallbackReason: reason };
    }
  }

  const decision = decideWithoutModel(ctx);
  await recordAudit({
    caseId,
    event: 'AI_DECISION',
    actor: 'DEMO_FALLBACK',
    actorType: 'AI',
    summary: `Rule-based fallback classified the case as ${decision.intent} and proposed ${decision.recommendedAction} (Gemini not configured)`,
    detail: { decision },
    outcome: 'INFO',
    durationMs: Date.now() - started,
  });
  return { ...decision, aiMode: 'DEMO_FALLBACK', fallbackReason: 'Gemini API key not configured' };
}

export type { InvestigationContext } from './prompt';
export type { AiDecision } from './schemas';
export { extractAmount } from './fallback';
