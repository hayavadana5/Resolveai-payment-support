import { Router } from 'express';
import { Customer, SupportCase, Transaction } from '../models';
import { requireAuth } from '../middleware/auth';
import { asyncHandler, HttpError } from '../middleware/error';
import { newCaseId, newPortalToken } from '../services/ids';
import { recordAudit } from '../services/audit.service';
import { runAutonomousCase } from '../services/workflow/runCase';

export const demoRouter = Router();
demoRouter.use(requireAuth);

const scenarios = [
  { id: 'payment-mismatch', title: 'Payment captured, order missing', customerId: 'CUS-1001', transactionId: 'TXN-3001', caseName: '₹2,499 deducted but order was not placed', issue: '₹2,499 was deducted from my account, but my order was not placed. Please fix this.', narrative: 'Autonomous resolution: reconcile payment → retry order → verify.' },
  { id: 'eligible-refund', title: 'Eligible ₹3,000 refund', customerId: 'CUS-1002', transactionId: 'TXN-3002', caseName: 'Please refund my ₹3,000 payment', issue: 'I want a refund for my ₹3,000 payment. The transaction is complete and I need my money back.', narrative: 'Autonomous resolution when policy and risk allow the refund.' },
  { id: 'high-value-refund', title: '₹50,000 refund approval', customerId: 'CUS-1004', transactionId: 'TXN-3003', caseName: 'Requesting ₹50,000 refund', issue: 'Please refund my ₹50,000 payment. I need the full amount returned.', narrative: 'AI investigates, but policy authority routes the action to a human.' },
  { id: 'suspicious-payment', title: 'Suspicious ₹45,000 transaction', customerId: 'CUS-1005', transactionId: 'TXN-3004', caseName: 'I do not recognize this ₹45,000 transaction', issue: 'I do not recognize this ₹45,000 transaction. Please investigate it immediately.', narrative: 'High risk blocks autonomous financial action and escalates.' },
] as const;

demoRouter.get('/scenarios', (_req, res) => res.json({ scenarios }));

demoRouter.post('/scenarios/:scenarioId/run', asyncHandler(async (req, res) => {
  const scenario = scenarios.find((item) => item.id === req.params.scenarioId);
  if (!scenario) throw new HttpError(404, 'Demo scenario not found.');
  const customer = await Customer.findOne({ customerId: scenario.customerId }).lean();
  const transaction = await Transaction.findOne({ transactionId: scenario.transactionId }).lean();
  if (!customer || !transaction) throw new HttpError(500, 'Seed data for this demo scenario is missing. Run the seed command first.');

  const caseId = newCaseId();
  const supportCase = await SupportCase.create({
    caseId, customerId: scenario.customerId, merchantId: transaction.merchantId, transactionId: scenario.transactionId,
    caseName: scenario.caseName, issue: scenario.issue, source: 'SYSTEM', priority: 'HIGH', status: 'OPEN',
    portalToken: newPortalToken(), createdBy: 'DEMO_CENTER',
    intake: { channel: 'SYSTEM', senderEmail: customer.email, senderName: customer.name, receivedAt: new Date() },
    lifecycle: [{ stage: 'UNDERSTAND', status: 'COMPLETED', title: 'Demo case launched', detail: `Scenario: ${scenario.title}`, actor: 'DEMO_CENTER' }],
  });
  await recordAudit({ caseId, event: 'DEMO_SCENARIO_STARTED', actor: req.user?.email ?? 'demo', actorType: 'HUMAN', summary: `Started demo scenario: ${scenario.title}`, detail: { scenarioId: scenario.id }, outcome: 'SUCCESS' });
  const outcome = await runAutonomousCase({ caseId, caller: { type: 'AI', identifier: 'DEMO_AI_TEAMMATE', role: 'AI' } });
  const updated = await SupportCase.findOne({ caseId }).lean();
  res.status(201).json({ scenario, case: updated, outcome, portal: { caseId, token: updated?.portalToken } });
}));
