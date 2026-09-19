import { Router } from 'express';
import { z } from 'zod';
import { Customer, SupportCase, Transaction } from '../models';
import { asyncHandler, HttpError } from '../middleware/error';
import { newCaseId, newPortalToken } from '../services/ids';
import { recordAudit } from '../services/audit.service';
import { runAutonomousCase } from '../services/workflow/runCase';

export const portalRouter = Router();

const createSchema = z.object({
  name: z.string().min(2).max(100), email: z.string().email(), subject: z.string().min(3).max(180), issue: z.string().min(5).max(3000), transactionId: z.string().optional(),
});

portalRouter.post('/cases', asyncHandler(async (req, res) => {
  const body = createSchema.parse(req.body);
  let customer = await Customer.findOne({ email: body.email.toLowerCase() });
  if (!customer) customer = await Customer.create({ customerId: `CUS-${newCaseId().slice(5)}`, name: body.name, email: body.email.toLowerCase(), phone: 'Not provided', verified: false });
  if (body.transactionId) {
    const txn = await Transaction.findOne({ transactionId: body.transactionId }).lean();
    if (!txn || txn.customerId !== customer.customerId) throw new HttpError(400, 'That transaction could not be linked to this customer.');
  }
  const caseId = newCaseId();
  const created = await SupportCase.create({ caseId, customerId: customer.customerId, transactionId: body.transactionId, caseName: body.subject, issue: body.issue, source: 'CUSTOMER_PORTAL', priority: 'MEDIUM', portalToken: newPortalToken(), createdBy: 'CUSTOMER_PORTAL', intake: { channel: 'CUSTOMER_PORTAL', senderEmail: body.email.toLowerCase(), senderName: body.name, receivedAt: new Date() }, lifecycle: [{ stage: 'UNDERSTAND', status: 'COMPLETED', title: 'Customer request received', detail: 'The request entered the AI teammate queue from the customer portal.', actor: 'CUSTOMER_PORTAL' }] });
  await recordAudit({ caseId, event: 'PORTAL_CASE_CREATED', actor: body.email, actorType: 'HUMAN', summary: `Customer opened ${caseId}`, detail: { subject: body.subject }, outcome: 'SUCCESS' });
  const outcome = await runAutonomousCase({ caseId, caller: { type: 'AI', identifier: 'CUSTOMER_PORTAL_AI_TEAMMATE', role: 'AI' } });
  const updated = await SupportCase.findOne({ caseId }).lean();
  res.status(201).json({ case: updated, outcome, portal: { caseId, token: updated?.portalToken } });
}));

portalRouter.get('/cases/:caseId', asyncHandler(async (req, res) => {
  const supportCase = await SupportCase.findOne({ caseId: req.params.caseId, portalToken: String(req.query.token || '') }).lean();
  if (!supportCase) throw new HttpError(404, 'Case not found or portal access token is invalid.');
  const customer = await Customer.findOne({ customerId: supportCase.customerId }).lean();
  const transaction = supportCase.transactionId ? await Transaction.findOne({ transactionId: supportCase.transactionId }).lean() : null;
  res.json({ case: supportCase, customer, transaction });
}));
