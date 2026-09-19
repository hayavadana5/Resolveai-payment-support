import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { asyncHandler, HttpError } from '../middleware/error';
import { Merchant, SupportCase, Transaction } from '../models';
import { assessRiskIntelligence } from '../services/risk/intelligence';
import { findSimilarCases } from '../services/memory/outcome';
import { recordAudit } from '../services/audit.service';

export const intelligenceRouter = Router();
intelligenceRouter.use(requireAuth);

intelligenceRouter.get('/risk/:transactionId', asyncHandler(async (req, res) => {
  const transactionId = String(req.params.transactionId);
  const intelligence = await assessRiskIntelligence(transactionId, String(req.query.action ?? 'INVESTIGATE'));
  res.json({ transactionId, intelligence });
}));

intelligenceRouter.get('/memory/similar', asyncHandler(async (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (query.length < 5) throw new HttpError(400, 'Provide a search query with at least 5 characters.');
  const memories = await findSimilarCases(query);
  res.json({ memories });
}));

/** Detect merchant-level payment/order mismatch clusters before customers pile up tickets. */
intelligenceRouter.get('/anomalies', asyncHandler(async (_req, res) => {
  const transactions = await Transaction.find({ status: 'SUCCESS' }).lean();
  const orders = await import('../models/Order').then(({ Order }) => Order.find().lean());
  const orderByTxn = new Set(orders.filter((o) => o.status === 'CREATED').map((o) => o.transactionId));
  const grouped = new Map<string, { merchantId: string; captured: number; missingOrders: number; amounts: number[] }>();
  for (const txn of transactions) {
    const row = grouped.get(txn.merchantId) ?? { merchantId: txn.merchantId, captured: 0, missingOrders: 0, amounts: [] };
    row.captured += 1;
    row.amounts.push(txn.amount);
    if (!orderByTxn.has(txn.transactionId)) row.missingOrders += 1;
    grouped.set(txn.merchantId, row);
  }
  const merchantIds = [...grouped.keys()];
  const merchants = await Merchant.find({ merchantId: { $in: merchantIds } }).lean();
  const merchantNames = new Map(merchants.map((m) => [m.merchantId, m.name]));
  const anomalies = [...grouped.values()]
    .map((g) => ({ ...g, merchantName: merchantNames.get(g.merchantId) ?? g.merchantId, failureRate: g.captured ? Number((g.missingOrders / g.captured * 100).toFixed(1)) : 0, avgAmount: g.amounts.length ? Math.round(g.amounts.reduce((a,b)=>a+b,0)/g.amounts.length) : 0 }))
    .filter((g) => g.missingOrders >= 2 && g.failureRate >= 10)
    .sort((a,b) => b.failureRate - a.failureRate);
  res.json({ anomalies });
}));

intelligenceRouter.post('/anomalies/:merchantId/case', asyncHandler(async (req, res) => {
  const merchantId = String(req.params.merchantId);
  const merchant = await Merchant.findOne({ merchantId }).lean();
  if (!merchant) throw new HttpError(404, 'Merchant not found.');
  const transactions = await Transaction.find({ merchantId, status: 'SUCCESS' }).lean();
  const orders = await import('../models/Order').then(({ Order }) => Order.find({ merchantId, status: 'CREATED' }).lean());
  const createdTxnIds = new Set(orders.map((o) => o.transactionId));
  const affected = transactions.filter((t) => !createdTxnIds.has(t.transactionId));
  if (affected.length < 2) throw new HttpError(409, 'No actionable anomaly remains for this merchant.');
  const existing = await SupportCase.findOne({ merchantId, source: 'SYSTEM', status: { $nin: ['RESOLVED', 'CLOSED'] }, caseName: { $regex: 'Merchant anomaly', $options: 'i' } });
  if (existing) return res.json({ case: existing, duplicate: true });
  const caseId = `INC-${Date.now().toString(36).toUpperCase()}`;
  const supportCase = await SupportCase.create({
    caseId, customerId: affected[0].customerId, merchantId, transactionId: affected[0].transactionId,
    caseName: `Merchant anomaly — ${merchant.name}`,
    issue: `${affected.length} captured payment(s) for ${merchant.name} have no CREATED order. This system-generated incident was detected proactively.`,
    source: 'SYSTEM', category: 'PAYMENT_ORDER_MISMATCH', priority: affected.length >= 5 ? 'CRITICAL' : 'HIGH',
    createdBy: 'PROACTIVE_ANOMALY_ENGINE',
    lifecycle: [{ stage: 'UNDERSTAND', status: 'COMPLETED', title: 'Proactive anomaly detected', detail: `${affected.length} captured payments are missing orders.`, actor: 'ANOMALY_ENGINE' }],
  });
  await recordAudit({ caseId, event: 'PROACTIVE_ANOMALY', actor: 'ANOMALY_ENGINE', actorType: 'SYSTEM', summary: `Detected ${affected.length} payment/order mismatches for ${merchant.name}`, detail: { merchantId, affectedTransactions: affected.map(t => t.transactionId) }, outcome: 'INFO' });
  res.status(201).json({ case: supportCase.toObject(), affectedTransactions: affected.map(t => t.transactionId) });
}));
