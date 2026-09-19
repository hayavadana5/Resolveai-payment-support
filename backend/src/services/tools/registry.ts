import { z } from 'zod';
import { Transaction } from '../../models';
import { recordAudit } from '../audit.service';
import { evaluateAndAudit } from '../policy/engine';
import { captureState, verifyAction } from '../verification/engine';
import * as read from './read.tools';
import * as write from './write.tools';
import type { ToolContext, ToolDefinition, ToolResult } from './types';

export * from './types';

const verifyActionTool: ToolDefinition = {
  name: 'verifyAction',
  description: 'Re-read system state and confirm an executed action actually took effect.',
  kind: 'READ',
  allowedRoles: ['AI', 'SUPPORT_AGENT', 'ADMIN'],
  schema: z.object({
    caseId: z.string().min(1),
    transactionId: z.string().min(1),
    action: z.string().min(1),
    beforeState: z.record(z.unknown()).default({}),
    expectedRefundAmount: z.number().optional(),
  }),
  execute: async (input) => {
    const outcome = await verifyAction({
      caseId: input.caseId,
      transactionId: input.transactionId,
      action: input.action,
      beforeState: input.beforeState,
      expectedRefundAmount: input.expectedRefundAmount,
    });
    return { ok: true, data: outcome };
  },
};

export const toolRegistry: Record<string, ToolDefinition> = Object.fromEntries(
  [
    read.getCustomer,
    read.getMerchant,
    read.getTransaction,
    read.getOrder,
    read.getPaymentStatus,
    read.getSettlementStatus,
    read.getPolicy,
    read.checkRefundEligibility,
    read.checkRisk,
    write.reconcilePayment,
    write.retryOrderCreation,
    write.initiateRefund,
    write.updateSupportCase,
    write.sendNotification,
    write.createEscalation,
    verifyActionTool,
  ].map((tool) => [tool.name, tool])
);

export const toolCatalogue = Object.values(toolRegistry).map((t) => ({
  name: t.name,
  description: t.description,
  kind: t.kind,
}));

/**
 * The single entry point for every tool call, whether requested by the model or
 * by a human. Order matters: validate, authorize, policy-check, execute, audit.
 * Gemini never touches MongoDB — it can only ask this function for a named tool.
 */
export async function callTool(
  name: string,
  rawInput: unknown,
  ctx: ToolContext
): Promise<ToolResult> {
  const started = Date.now();
  const tool = toolRegistry[name];

  if (!tool) {
    await recordAudit({
      caseId: ctx.caseId,
      event: 'ACTION_BLOCKED',
      actor: ctx.caller.identifier,
      actorType: ctx.caller.type === 'AI' ? 'AI' : 'HUMAN',
      summary: `Rejected call to unknown tool "${name}"`,
      outcome: 'BLOCKED',
    });
    return { ok: false, error: `Unknown tool: ${name}`, code: 'VALIDATION' };
  }

  // 1. Validate input.
  const parsed = tool.schema.safeParse(rawInput ?? {});
  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    await recordAudit({
      caseId: ctx.caseId,
      event: 'ACTION_BLOCKED',
      actor: ctx.caller.identifier,
      actorType: ctx.caller.type === 'AI' ? 'AI' : 'HUMAN',
      summary: `Invalid input for ${name}`,
      detail: { issues: message, input: rawInput },
      outcome: 'BLOCKED',
    });
    return { ok: false, error: `Invalid input for ${name}: ${message}`, code: 'VALIDATION' };
  }
  const input = parsed.data as Record<string, unknown>;

  // 2. Check authorization.
  if (!tool.allowedRoles.includes(ctx.caller.role)) {
    await recordAudit({
      caseId: ctx.caseId,
      event: 'ACTION_BLOCKED',
      actor: ctx.caller.identifier,
      actorType: ctx.caller.type === 'AI' ? 'AI' : 'HUMAN',
      summary: `${ctx.caller.role} is not authorized to call ${name}`,
      outcome: 'BLOCKED',
    });
    return { ok: false, error: `Role ${ctx.caller.role} may not call ${name}`, code: 'AUTHORIZATION' };
  }

  // 3. Check policy — write tools only; reads are free.
  if (tool.kind === 'WRITE' && tool.policyAction) {
    const transactionId = typeof input.transactionId === 'string' ? input.transactionId : undefined;
    const txn = transactionId ? await Transaction.findOne({ transactionId }).lean() : null;

    const decision = await evaluateAndAudit(ctx.caseId, {
      action: tool.policyAction,
      amount: typeof input.amount === 'number' ? input.amount : txn?.amount,
      confidence: ctx.caller.type === 'AI' ? ctx.confidence ?? 1 : 1,
      riskLevel: (txn?.riskLevel as 'LOW' | 'MEDIUM' | 'HIGH') ?? 'LOW',
      riskSignals: txn?.riskSignals ?? [],
      transactionStatus: txn?.status,
      failedAttempts: ctx.failedAttempts ?? 0,
      actorRole: ctx.caller.role === 'AI' ? 'AI' : ctx.caller.role,
      humanApproved: ctx.caller.humanApproved,
    });

    if (!decision.allowed) {
      await recordAudit({
        caseId: ctx.caseId,
        event: 'ACTION_BLOCKED',
        actor: ctx.caller.identifier,
        actorType: ctx.caller.type === 'AI' ? 'AI' : 'HUMAN',
        summary: `Policy ${decision.outcome} for ${name}: ${decision.blockingReason}`,
        detail: { evaluations: decision.evaluations, input },
        outcome: 'BLOCKED',
      });
      return {
        ok: false,
        error: decision.blockingReason ?? `Policy prevented ${name}`,
        code: 'POLICY',
      };
    }
  }

  // 4. Execute.
  try {
    const result = await tool.execute(input, ctx);
    await recordAudit({
      caseId: ctx.caseId,
      event: tool.kind === 'WRITE' ? 'ACTION_EXECUTED' : 'TOOL_CALL',
      actor: ctx.caller.identifier,
      actorType: ctx.caller.type === 'AI' ? 'AI' : 'HUMAN',
      summary: result.ok ? `${name} completed` : `${name} failed: ${result.error}`,
      detail: { input, result },
      outcome: result.ok ? 'SUCCESS' : 'FAILURE',
      durationMs: Date.now() - started,
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown execution error';
    await recordAudit({
      caseId: ctx.caseId,
      event: 'ERROR',
      actor: ctx.caller.identifier,
      actorType: ctx.caller.type === 'AI' ? 'AI' : 'HUMAN',
      summary: `${name} threw: ${message}`,
      outcome: 'FAILURE',
      durationMs: Date.now() - started,
    });
    return { ok: false, error: message, code: 'EXECUTION' };
  }
}

export { captureState };
