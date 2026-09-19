import { Router } from 'express';
import { z } from 'zod';
import { Customer, EmailMessage, SupportCase } from '../models';
import { HttpError, asyncHandler } from '../middleware/error';
import { requireAuth } from '../middleware/auth';
import { env } from '../config/env';
import { newCaseId, newCustomerId, newPortalToken } from '../services/ids';
import { recordAudit } from '../services/audit.service';
import { publishCaseEvent } from '../services/realtime';
import { runAutonomousCase } from '../services/workflow/runCase';
import { rateLimit } from '../middleware/security';

export const intakeRouter = Router();

const emailSchema = z.object({
  messageId: z.string().min(3), threadId: z.string().optional(), from: z.string().email(), fromName: z.string().optional(),
  to: z.string().optional(), subject: z.string().min(1).max(180), body: z.string().min(3).max(12000), receivedAt: z.string().datetime().optional(),
  autoRun: z.boolean().default(true),
});

function checkSecret(req: any) {
  if (env.nodeEnv === 'development' && !env.emailIngestSecret) return;
  if (req.header('X-Email-Ingest-Secret') !== env.emailIngestSecret) throw new HttpError(401, 'Invalid email ingestion secret.');
}

intakeRouter.post('/email', rateLimit({ windowMs: 60_000, max: 60, message: 'Email intake rate limit exceeded.' }), asyncHandler(async (req, res) => {
  checkSecret(req);
  const body = emailSchema.parse(req.body);
  const existing = await EmailMessage.findOne({ messageId: body.messageId }).lean();
  if (existing) return res.json({ duplicate: true, message: existing });

  let customer = await Customer.findOne({ email: body.from.toLowerCase() });
  if (!customer) {
    customer = await Customer.create({ customerId: newCustomerId(), name: body.fromName || body.from.split('@')[0], email: body.from.toLowerCase(), phone: 'Not provided', verified: false });
  }

  const caseId = newCaseId();
  const supportCase = await SupportCase.create({
    caseId, customerId: customer.customerId, caseName: body.subject.trim(), issue: body.body.trim(), source: 'EMAIL',
    priority: /urgent|blocked|fraud|unauthori[sz]ed/i.test(`${body.subject} ${body.body}`) ? 'HIGH' : 'MEDIUM',
    portalToken: newPortalToken(), createdBy: 'EMAIL_INTAKE',
    intake: { channel: 'EMAIL', externalMessageId: body.messageId, senderEmail: body.from.toLowerCase(), senderName: body.fromName || '', receivedAt: body.receivedAt ? new Date(body.receivedAt) : new Date() },
    lifecycle: [{ stage: 'UNDERSTAND', status: 'COMPLETED', title: 'Email converted into a support case', detail: `Inbound email from ${body.from} was accepted and assigned to the AI teammate.`, actor: 'EMAIL_INTAKE' }],
  });
  const message = await EmailMessage.create({ ...body, from: body.from.toLowerCase(), receivedAt: body.receivedAt ? new Date(body.receivedAt) : new Date(), caseId, status: 'CASE_CREATED' });
  await recordAudit({ caseId, event: 'EMAIL_CASE_CREATED', actor: 'EMAIL_INTAKE', actorType: 'SYSTEM', summary: `Email converted to ${caseId}`, detail: { messageId: body.messageId, from: body.from, subject: body.subject }, outcome: 'SUCCESS' });

  let outcome: unknown = null;
  if (body.autoRun) outcome = await runAutonomousCase({ caseId, caller: { type: 'AI', identifier: 'EMAIL_AI_TEAMMATE', role: 'AI' } });
  const updated = await SupportCase.findOne({ caseId }).lean();
  res.status(201).json({ case: updated, message, outcome, portal: { caseId, token: updated?.portalToken } });
}));

intakeRouter.get('/emails', requireAuth, asyncHandler(async (_req, res) => {
  const messages = await EmailMessage.find().sort({ receivedAt: -1 }).limit(100).lean();
  res.json({ messages });
}));


/** n8n can call this endpoint after a long-running workflow or external action. */
intakeRouter.post('/n8n/callback', rateLimit({ windowMs: 60_000, max: 120, message: 'Callback rate limit exceeded.' }), asyncHandler(async (req, res) => {
  const secret = req.headers['x-n8n-callback-secret'];
  if (secret !== env.n8nWebhookSecret || !env.n8nWebhookSecret) throw new HttpError(401, 'Invalid n8n callback signature.');
  const body = z.object({
    caseId: z.string().min(1),
    workflow: z.string().min(1),
    status: z.enum(['STARTED', 'SUCCESS', 'FAILED']),
    message: z.string().max(1000).optional(),
    data: z.record(z.unknown()).optional(),
  }).parse(req.body);
  const supportCase = await SupportCase.findOne({ caseId: body.caseId });
  if (!supportCase) throw new HttpError(404, `No case with id ${body.caseId}.`);
  await recordAudit({ caseId: body.caseId, event: 'N8N_CALLBACK', actor: 'N8N', actorType: 'SYSTEM', summary: `${body.workflow} workflow reported ${body.status}`, detail: body.data ?? {}, outcome: body.status === 'FAILED' ? 'FAILURE' : body.status === 'STARTED' ? 'INFO' : 'SUCCESS' });
  publishCaseEvent({ caseId: body.caseId, type: 'WORKFLOW', title: `n8n ${body.workflow}: ${body.status}`, detail: body.message ?? 'Workflow callback received.', status: body.status, data: body.data });
  res.json({ ok: true, receivedAt: new Date().toISOString() });
}));
