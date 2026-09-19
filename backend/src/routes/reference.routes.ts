import { Router } from 'express';
import { Customer, Merchant, Transaction } from '../models';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';
import { toolCatalogue } from '../services/tools/registry';
import { policyRuleCatalogue } from '../services/policy/engine';

export const referenceRouter = Router();
referenceRouter.use(requireAuth);

referenceRouter.get(
  '/customers',
  asyncHandler(async (_req, res) => {
    res.json({ customers: await Customer.find().sort({ customerId: 1 }).lean() });
  })
);

referenceRouter.get(
  '/merchants',
  asyncHandler(async (_req, res) => {
    res.json({ merchants: await Merchant.find().sort({ merchantId: 1 }).lean() });
  })
);

referenceRouter.get(
  '/transactions',
  asyncHandler(async (req, res) => {
    const customerId = typeof req.query.customerId === 'string' ? req.query.customerId : undefined;
    res.json({
      transactions: await Transaction.find(customerId ? { customerId } : {})
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),
    });
  })
);

referenceRouter.get('/tools', (_req, res) => res.json({ tools: toolCatalogue }));
referenceRouter.get('/policies', (_req, res) => res.json({ policies: policyRuleCatalogue }));
