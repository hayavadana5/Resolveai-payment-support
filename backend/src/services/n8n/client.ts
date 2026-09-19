import { env, isN8nConfigured } from '../../config/env';
import { recordAudit } from '../audit.service';
import { publishCaseEvent } from '../realtime';

export type WorkflowName = 'reconciliation' | 'refund' | 'escalation' | 'notification';

export interface WorkflowResult<T = Record<string, unknown>> {
  executedVia: 'N8N' | 'LOCAL_FALLBACK';
  ok: boolean;
  data: T;
  fallbackReason?: string;
}

const TIMEOUT_MS = 12000;

/**
 * Invokes an n8n Cloud webhook. Credentials live only here, on the server.
 * If n8n is unreachable the caller receives a clearly-labelled local simulation
 * rather than a silent pretence that the workflow ran.
 */
export async function invokeWorkflow<T extends Record<string, unknown>>(
  workflow: WorkflowName,
  payload: Record<string, unknown>,
  localFallback: () => T,
  caseId?: string
): Promise<WorkflowResult<T>> {
  const started = Date.now();

  if (!isN8nConfigured()) {
    publishCaseEvent({ caseId: caseId ?? 'unknown', type: 'WORKFLOW', title: `Local ${workflow} simulation started`, detail: 'n8n is not configured; a transparent local execution path is being used.', status: 'STARTED', data: { workflow } });
    const data = localFallback();
    await recordAudit({
      caseId,
      event: 'WORKFLOW_INVOKED',
      actor: 'LOCAL_FALLBACK',
      summary: `Ran ${workflow} locally (n8n not configured)`,
      detail: { workflow, payload, data },
      outcome: 'INFO',
      durationMs: Date.now() - started,
    });
    publishCaseEvent({ caseId: caseId ?? 'unknown', type: 'WORKFLOW', title: `Local ${workflow} simulation completed`, detail: 'The fallback produced a deterministic result.', status: 'SUCCESS', data: { workflow, ...data } });
    return { executedVia: 'LOCAL_FALLBACK', ok: true, data, fallbackReason: 'n8n not configured' };
  }

  const url = `${env.n8nBaseUrl.replace(/\/$/, '')}/webhook/${env.n8nPaths[workflow]}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    publishCaseEvent({ caseId: caseId ?? 'unknown', type: 'WORKFLOW', title: `n8n ${workflow} started`, detail: 'ResolveAI handed the authorized action to the workflow layer.', status: 'STARTED', data: { workflow } });
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-ResolveAI-Signature': env.n8nWebhookSecret,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`n8n responded ${response.status}`);
    const data = (await response.json()) as T;
    await recordAudit({
      caseId,
      event: 'WORKFLOW_INVOKED',
      actor: 'N8N',
      summary: `n8n ${workflow} workflow completed`,
      detail: { workflow, payload, data },
      outcome: 'SUCCESS',
      durationMs: Date.now() - started,
    });
    publishCaseEvent({ caseId: caseId ?? 'unknown', type: 'WORKFLOW', title: `n8n ${workflow} completed`, detail: 'The workflow returned a successful result.', status: 'SUCCESS', data: { workflow, ...data } });
    return { executedVia: 'N8N', ok: true, data };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown n8n error';
    const data = localFallback();
    await recordAudit({
      caseId,
      event: 'WORKFLOW_INVOKED',
      actor: 'LOCAL_FALLBACK',
      summary: `n8n ${workflow} unavailable (${reason}); ran local simulation`,
      detail: { workflow, payload, data, reason },
      outcome: 'FAILURE',
      durationMs: Date.now() - started,
    });
    publishCaseEvent({ caseId: caseId ?? 'unknown', type: 'WORKFLOW', title: `Local ${workflow} fallback completed`, detail: 'A transparent fallback completed after n8n was unavailable.', status: 'SUCCESS', data: { workflow, ...data } });
    return { executedVia: 'LOCAL_FALLBACK', ok: true, data, fallbackReason: reason };
  } finally {
    clearTimeout(timer);
  }
}
