import { AuditLog } from '../models';
import type { AuditEvent } from '../models';

export interface AuditInput {
  caseId?: string;
  event: AuditEvent;
  actor: string;
  actorType?: 'AI' | 'SYSTEM' | 'HUMAN';
  summary: string;
  detail?: Record<string, unknown>;
  outcome?: 'SUCCESS' | 'FAILURE' | 'BLOCKED' | 'INFO';
  durationMs?: number;
}

/**
 * Audit writes must never break a workflow. A failed audit write is logged and
 * swallowed so a support case can still be worked, but that is itself recorded.
 */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await AuditLog.create({
      caseId: input.caseId,
      event: input.event,
      actor: input.actor,
      actorType: input.actorType ?? 'SYSTEM',
      summary: input.summary,
      detail: redact(input.detail ?? {}),
      outcome: input.outcome ?? 'INFO',
      durationMs: input.durationMs,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[audit] failed to write audit log', error);
  }
}

const SECRET_KEYS = ['apikey', 'api_key', 'password', 'passwordhash', 'token', 'secret', 'authorization'];

/** Strips anything that looks like a credential before it reaches the audit trail. */
export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SECRET_KEYS.includes(key.toLowerCase()) ? '[redacted]' : redact(val);
    }
    return out;
  }
  return value;
}
