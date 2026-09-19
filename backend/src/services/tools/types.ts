import { z } from 'zod';
import type { Role } from '../../models/types';

export interface ToolCaller {
  /** Who is asking. The AI orchestrator is not a user and never gets ADMIN. */
  type: 'AI' | 'HUMAN';
  identifier: string;
  role: Role | 'AI';
  humanApproved?: boolean;
}

export interface ToolContext {
  caller: ToolCaller;
  caseId?: string;
  failedAttempts?: number;
  /** The AI's own confidence in this action, fed to the confidence-floor policy. */
  confidence?: number;
}

export type ToolResult<T = unknown> =
  | { ok: true; data: T; executedVia?: 'N8N' | 'LOCAL_FALLBACK'; fallbackReason?: string }
  | { ok: false; error: string; code: 'VALIDATION' | 'AUTHORIZATION' | 'POLICY' | 'NOT_FOUND' | 'EXECUTION' };

export interface ToolDefinition<S extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  description: string;
  schema: S;
  /** READ tools never change state; WRITE tools go through the policy engine. */
  kind: 'READ' | 'WRITE';
  allowedRoles: Array<Role | 'AI'>;
  /** Maps validated input to a policy context. WRITE tools must implement this. */
  policyAction?: string;
  execute: (input: z.infer<S>, ctx: ToolContext) => Promise<ToolResult>;
}
