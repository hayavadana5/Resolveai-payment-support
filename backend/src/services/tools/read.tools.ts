import { z } from 'zod';
import { Customer, Merchant, Order, Transaction, Policy } from '../../models';
import { policyRuleCatalogue } from '../policy/engine';
import { env } from '../../config/env';
import type { ToolDefinition } from './types';

const notFound = (what: string) => ({ ok: false as const, error: `${what} not found`, code: 'NOT_FOUND' as const });

export const getCustomer: ToolDefinition = {
  name: 'getCustomer',
  description: 'Look up a customer record by customerId.',
  kind: 'READ',
  allowedRoles: ['AI', 'SUPPORT_AGENT', 'ADMIN'],
  schema: z.object({ customerId: z.string().min(1) }),
  execute: async ({ customerId }) => {
    const customer = await Customer.findOne({ customerId }).lean();
    return customer ? { ok: true, data: customer } : notFound('Customer');
  },
};

export const getMerchant: ToolDefinition = {
  name: 'getMerchant',
  description: 'Look up a merchant record, including risk level and known issues.',
  kind: 'READ',
  allowedRoles: ['AI', 'SUPPORT_AGENT', 'ADMIN'],
  schema: z.object({ merchantId: z.string().min(1) }),
  execute: async ({ merchantId }) => {
    const merchant = await Merchant.findOne({ merchantId }).lean();
    return merchant ? { ok: true, data: merchant } : notFound('Merchant');
  },
};

export const getTransaction: ToolDefinition = {
  name: 'getTransaction',
  description: 'Retrieve a payment transaction by transactionId.',
  kind: 'READ',
  allowedRoles: ['AI', 'SUPPORT_AGENT', 'ADMIN'],
  schema: z.object({ transactionId: z.string().min(1) }),
  execute: async ({ transactionId }) => {
    const txn = await Transaction.findOne({ transactionId }).lean();
    return txn ? { ok: true, data: txn } : notFound('Transaction');
  },
};

export const getOrder: ToolDefinition = {
  name: 'getOrder',
  description: 'Retrieve the order linked to a transaction. Returns exists:false when no order was created.',
  kind: 'READ',
  allowedRoles: ['AI', 'SUPPORT_AGENT', 'ADMIN'],
  schema: z.object({ transactionId: z.string().min(1) }),
  execute: async ({ transactionId }) => {
    const order = await Order.findOne({ transactionId }).lean();
    return order
      ? { ok: true, data: { exists: true, order } }
      : { ok: true, data: { exists: false, order: null, status: 'NOT_CREATED' } };
  },
};

export const getPaymentStatus: ToolDefinition = {
  name: 'getPaymentStatus',
  description: 'Inspect gateway-level payment state for a transaction.',
  kind: 'READ',
  allowedRoles: ['AI', 'SUPPORT_AGENT', 'ADMIN'],
  schema: z.object({ transactionId: z.string().min(1) }),
  execute: async ({ transactionId }) => {
    const txn = await Transaction.findOne({ transactionId }).lean();
    if (!txn) return notFound('Transaction');
    return {
      ok: true,
      data: {
        transactionId: txn.transactionId,
        status: txn.status,
        gatewayStatus: txn.gatewayStatus,
        gatewayReference: txn.gatewayReference,
        amount: txn.amount,
        currency: txn.currency,
        capturedAt: txn.createdAt,
      },
    };
  },
};

export const getSettlementStatus: ToolDefinition = {
  name: 'getSettlementStatus',
  description: 'Check whether funds for a transaction have settled to the merchant.',
  kind: 'READ',
  allowedRoles: ['AI', 'SUPPORT_AGENT', 'ADMIN'],
  schema: z.object({ transactionId: z.string().min(1) }),
  execute: async ({ transactionId }) => {
    const txn = await Transaction.findOne({ transactionId }).lean();
    if (!txn) return notFound('Transaction');
    return {
      ok: true,
      data: {
        transactionId: txn.transactionId,
        settlementStatus: txn.settlementStatus,
        customerCharged: txn.status === 'SUCCESS',
      },
    };
  },
};

export const getPolicy: ToolDefinition = {
  name: 'getPolicy',
  description: 'Read the policies the backend enforces. The AI cannot change these.',
  kind: 'READ',
  allowedRoles: ['AI', 'SUPPORT_AGENT', 'ADMIN'],
  schema: z.object({ policyId: z.string().optional() }),
  execute: async ({ policyId }) => {
    const stored = await Policy.find(policyId ? { policyId } : { active: true }).lean();
    return { ok: true, data: { enforced: policyRuleCatalogue, stored } };
  },
};

export const checkRefundEligibility: ToolDefinition = {
  name: 'checkRefundEligibility',
  description: 'Determine whether a transaction can be refunded and for how much.',
  kind: 'READ',
  allowedRoles: ['AI', 'SUPPORT_AGENT', 'ADMIN'],
  schema: z.object({ transactionId: z.string().min(1), amount: z.number().positive().optional() }),
  execute: async ({ transactionId, amount }) => {
    const txn = await Transaction.findOne({ transactionId }).lean();
    if (!txn) return notFound('Transaction');
    const refundable = txn.amount - (txn.refundedAmount ?? 0);
    const requested = amount ?? refundable;
    const reasons: string[] = [];
    if (txn.status !== 'SUCCESS') reasons.push(`Transaction status is ${txn.status}, not SUCCESS`);
    if (requested > refundable) reasons.push(`Requested INR ${requested} exceeds refundable INR ${refundable}`);
    if (txn.riskLevel === 'HIGH') reasons.push('Transaction is flagged HIGH risk');
    return {
      ok: true,
      data: {
        eligible: reasons.length === 0,
        reasons,
        refundableAmount: refundable,
        requestedAmount: requested,
        withinAutonomousAuthority: requested <= env.autonomousRefundCeiling,
        autonomousCeiling: env.autonomousRefundCeiling,
      },
    };
  },
};

export const checkRisk: ToolDefinition = {
  name: 'checkRisk',
  description: 'Assess fraud/risk signals across the transaction, customer and merchant.',
  kind: 'READ',
  allowedRoles: ['AI', 'SUPPORT_AGENT', 'ADMIN'],
  schema: z.object({ transactionId: z.string().min(1) }),
  execute: async ({ transactionId }) => {
    const txn = await Transaction.findOne({ transactionId }).lean();
    if (!txn) return notFound('Transaction');
    const [customer, merchant] = await Promise.all([
      Customer.findOne({ customerId: txn.customerId }).lean(),
      Merchant.findOne({ merchantId: txn.merchantId }).lean(),
    ]);

    const signals = [...(txn.riskSignals ?? [])];
    if (txn.amount >= 25000) signals.push('HIGH_VALUE_TRANSACTION');
    if (merchant?.riskLevel === 'HIGH') signals.push('HIGH_RISK_MERCHANT');
    if (customer && (customer.accountAgeDays ?? 0) < 30) signals.push('NEW_ACCOUNT');
    if (!customer?.verified) signals.push('UNVERIFIED_CUSTOMER');

    const unique = Array.from(new Set(signals));
    const level = unique.length >= 2 || txn.riskLevel === 'HIGH' ? 'HIGH' : unique.length === 1 ? 'MEDIUM' : 'LOW';
    return { ok: true, data: { riskLevel: level, signals: unique, storedRiskLevel: txn.riskLevel } };
  },
};
