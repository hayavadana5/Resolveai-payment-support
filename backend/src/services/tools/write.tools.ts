import { z } from 'zod';
import {
  Escalation,
  Notification,
  Order,
  SupportCase,
  Transaction,
  Customer,
} from '../../models';
import { invokeWorkflow } from '../n8n/client';
import { newEscalationId, newOrderId, newReconciliationRef, newRefundReference } from '../ids';
import type { ToolDefinition } from './types';

const notFound = (what: string) => ({ ok: false as const, error: `${what} not found`, code: 'NOT_FOUND' as const });

export const reconcilePayment: ToolDefinition = {
  name: 'reconcilePayment',
  description: 'Reconcile a captured payment against the gateway record. Runs the n8n reconciliation workflow.',
  kind: 'WRITE',
  policyAction: 'RECONCILE_PAYMENT',
  allowedRoles: ['AI', 'SUPPORT_AGENT', 'ADMIN'],
  schema: z.object({ transactionId: z.string().min(1) }),
  execute: async ({ transactionId }, ctx) => {
    const txn = await Transaction.findOne({ transactionId });
    if (!txn) return notFound('Transaction');

    const result = await invokeWorkflow(
      'reconciliation',
      { transactionId, amount: txn.amount, gatewayReference: txn.gatewayReference },
      () => ({
        reconciled: true,
        reference: newReconciliationRef(),
        gatewayState: 'CAPTURED',
        discrepancy: false,
      }),
      ctx.caseId
    );

    txn.gatewayStatus = 'RECONCILED';
    if (txn.settlementStatus === 'PENDING') txn.settlementStatus = 'SETTLED';
    await txn.save();

    return {
      ok: true,
      data: { transactionId, ...result.data },
      executedVia: result.executedVia,
      fallbackReason: result.fallbackReason,
    };
  },
};

export const retryOrderCreation: ToolDefinition = {
  name: 'retryOrderCreation',
  description: 'Create the missing order for a captured payment. Only valid when payment succeeded and no order exists.',
  kind: 'WRITE',
  policyAction: 'RETRY_ORDER_CREATION',
  allowedRoles: ['AI', 'SUPPORT_AGENT', 'ADMIN'],
  schema: z.object({ transactionId: z.string().min(1) }),
  execute: async ({ transactionId }, ctx) => {
    const txn = await Transaction.findOne({ transactionId });
    if (!txn) return notFound('Transaction');
    if (txn.status !== 'SUCCESS') {
      return { ok: false, error: `Cannot create an order for a ${txn.status} payment`, code: 'EXECUTION' };
    }

    const existing = await Order.findOne({ transactionId });
    if (existing && existing.status === 'CREATED') {
      return { ok: true, data: { orderId: existing.orderId, alreadyCreated: true, status: 'CREATED' } };
    }

    const result = await invokeWorkflow(
      'reconciliation',
      { transactionId, action: 'RETRY_ORDER_CREATION', amount: txn.amount },
      () => ({ created: true }),
      ctx.caseId
    );

    const orderId = existing?.orderId ?? newOrderId();
    if (existing) {
      existing.status = 'CREATED';
      existing.failureReason = '';
      await existing.save();
    } else {
      await Order.create({
        orderId,
        transactionId,
        customerId: txn.customerId,
        merchantId: txn.merchantId,
        amount: txn.amount,
        items: [{ name: 'Recovered order line', quantity: 1, price: txn.amount }],
        status: 'CREATED',
      });
    }
    txn.orderId = orderId;
    await txn.save();

    return {
      ok: true,
      data: { orderId, status: 'CREATED', alreadyCreated: false, workflow: result.data },
      executedVia: result.executedVia,
      fallbackReason: result.fallbackReason,
    };
  },
};

export const initiateRefund: ToolDefinition = {
  name: 'initiateRefund',
  description: 'Issue a refund against a captured payment. Subject to the refund authority policy.',
  kind: 'WRITE',
  policyAction: 'INITIATE_REFUND',
  allowedRoles: ['AI', 'SUPPORT_AGENT', 'ADMIN'],
  schema: z.object({
    transactionId: z.string().min(1),
    amount: z.number().positive(),
    reason: z.string().min(1).max(500),
  }),
  execute: async ({ transactionId, amount, reason }, ctx) => {
    const txn = await Transaction.findOne({ transactionId });
    if (!txn) return notFound('Transaction');

    const refundable = txn.amount - (txn.refundedAmount ?? 0);
    if (amount > refundable) {
      return { ok: false, error: `Refund of INR ${amount} exceeds refundable INR ${refundable}`, code: 'EXECUTION' };
    }

    const result = await invokeWorkflow(
      'refund',
      { transactionId, amount, reason },
      () => ({ refunded: true, reference: newRefundReference(), settlementDays: 5 }),
      ctx.caseId
    );

    txn.refundedAmount = (txn.refundedAmount ?? 0) + amount;
    txn.status = txn.refundedAmount >= txn.amount ? 'REFUNDED' : txn.status;
    await txn.save();

    return {
      ok: true,
      data: { transactionId, amount, status: txn.status, ...result.data },
      executedVia: result.executedVia,
      fallbackReason: result.fallbackReason,
    };
  },
};

export const updateSupportCase: ToolDefinition = {
  name: 'updateSupportCase',
  description: 'Update the status, priority or resolution text of a support case.',
  kind: 'WRITE',
  policyAction: 'UPDATE_CASE',
  allowedRoles: ['AI', 'SUPPORT_AGENT', 'ADMIN'],
  schema: z.object({
    caseId: z.string().min(1),
    status: z
      .enum(['OPEN', 'INVESTIGATING', 'ACTING', 'VERIFYING', 'RESOLVED', 'ESCALATED', 'CLOSED'])
      .optional(),
    resolution: z.string().max(2000).optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  }),
  execute: async ({ caseId, status, resolution, priority }) => {
    const supportCase = await SupportCase.findOne({ caseId });
    if (!supportCase) return notFound('Support case');
    if (status) supportCase.status = status;
    if (resolution !== undefined) supportCase.resolution = resolution;
    if (priority) supportCase.priority = priority;
    if (status === 'RESOLVED') supportCase.resolvedAt = new Date();
    await supportCase.save();
    return { ok: true, data: { caseId, status: supportCase.status } };
  },
};

export const sendNotification: ToolDefinition = {
  name: 'sendNotification',
  description: 'Notify the customer about the outcome of their case.',
  kind: 'WRITE',
  policyAction: 'NOTIFY_CUSTOMER',
  allowedRoles: ['AI', 'SUPPORT_AGENT', 'ADMIN'],
  schema: z.object({
    caseId: z.string().min(1),
    customerId: z.string().min(1),
    subject: z.string().min(1).max(200),
    body: z.string().min(1).max(2000),
    channel: z.enum(['EMAIL', 'SMS', 'IN_APP']).default('EMAIL'),
  }),
  execute: async ({ caseId, customerId, subject, body, channel }, ctx) => {
    const customer = await Customer.findOne({ customerId }).lean();
    if (!customer) return notFound('Customer');
    const recipient = channel === 'SMS' ? customer.phone : customer.email;

    const result = await invokeWorkflow(
      'notification',
      { caseId, recipient, subject, body, channel },
      () => ({ sent: true }),
      ctx.caseId
    );

    await Notification.create({
      caseId,
      channel,
      recipient,
      subject,
      body,
      status: 'SENT',
      deliveredVia: result.executedVia,
    });
    await SupportCase.updateOne({ caseId }, { $set: { customerNotified: true } });

    return {
      ok: true,
      data: { recipient, channel, sent: true },
      executedVia: result.executedVia,
      fallbackReason: result.fallbackReason,
    };
  },
};

export const createEscalation: ToolDefinition = {
  name: 'createEscalation',
  description: 'Hand the case to a human with the full investigation packet.',
  kind: 'WRITE',
  policyAction: 'ESCALATE_TO_HUMAN',
  allowedRoles: ['AI', 'SUPPORT_AGENT', 'ADMIN'],
  schema: z.object({
    caseId: z.string().min(1),
    reason: z.string().min(1).max(1000),
    riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
    aiSummary: z.string().max(2000).default(''),
    recommendedAction: z.string().max(100).default('NO_ACTION'),
    evidence: z.record(z.unknown()).default({}),
  }),
  execute: async ({ caseId, reason, riskLevel, aiSummary, recommendedAction, evidence }, ctx) => {
    const supportCase = await SupportCase.findOne({ caseId });
    if (!supportCase) return notFound('Support case');

    const existing = await Escalation.findOne({ caseId, status: 'PENDING' });
    if (existing) return { ok: true, data: { escalationId: existing.escalationId, alreadyOpen: true } };

    const escalationId = newEscalationId();
    const result = await invokeWorkflow(
      'escalation',
      { escalationId, caseId, reason, riskLevel, recommendedAction },
      () => ({ queued: true }),
      ctx.caseId
    );

    await Escalation.create({
      escalationId,
      caseId,
      reason,
      riskLevel,
      aiSummary,
      recommendedAction,
      evidence,
      status: 'PENDING',
    });
    supportCase.status = 'ESCALATED';
    await supportCase.save();

    return {
      ok: true,
      data: { escalationId, status: 'PENDING', workflow: result.data },
      executedVia: result.executedVia,
      fallbackReason: result.fallbackReason,
    };
  },
};
