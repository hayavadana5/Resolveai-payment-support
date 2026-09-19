import { recordAudit } from '../audit.service';
import { policyRules } from './rules';
import type { PolicyContext, PolicyDecision, PolicyEvaluation } from './types';

/**
 * The policy engine is the authority on what may happen. The model only ever
 * *proposes* an action; nothing executes unless this function allows it.
 */
export function evaluatePolicies(ctx: PolicyContext): PolicyDecision {
  const evaluations: PolicyEvaluation[] = policyRules
    .filter((rule) => rule.appliesTo(ctx))
    .map((rule) => rule.evaluate(ctx));

  const blocked = evaluations.find((e) => e.outcome === 'BLOCK');
  if (blocked) {
    return {
      outcome: 'BLOCK',
      allowed: false,
      approvalRequired: false,
      blockingReason: blocked.reason,
      evaluations,
    };
  }

  const needsApproval = evaluations.find((e) => e.outcome === 'REQUIRE_APPROVAL');
  if (needsApproval) {
    // A human who has already approved satisfies the approval requirement.
    if (ctx.humanApproved) {
      return { outcome: 'ALLOW', allowed: true, approvalRequired: true, evaluations };
    }
    return {
      outcome: 'REQUIRE_APPROVAL',
      allowed: false,
      approvalRequired: true,
      blockingReason: needsApproval.reason,
      evaluations,
    };
  }

  return { outcome: 'ALLOW', allowed: true, approvalRequired: false, evaluations };
}

export async function evaluateAndAudit(
  caseId: string | undefined,
  ctx: PolicyContext
): Promise<PolicyDecision> {
  const decision = evaluatePolicies(ctx);
  await recordAudit({
    caseId,
    event: 'POLICY_EVALUATION',
    actor: 'POLICY_ENGINE',
    actorType: 'SYSTEM',
    summary: `Policy check for ${ctx.action}: ${decision.outcome}`,
    detail: { context: ctx, evaluations: decision.evaluations },
    outcome: decision.allowed ? 'SUCCESS' : decision.outcome === 'BLOCK' ? 'BLOCKED' : 'INFO',
  });
  return decision;
}

export * from './types';
export { policyRuleCatalogue } from './rules';
