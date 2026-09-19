import { z } from 'zod';

export const decisionSchema = z.object({
  intent: z.enum([
    'PAYMENT_ORDER_MISMATCH',
    'REFUND_REQUEST',
    'HIGH_VALUE_REFUND',
    'SUSPICIOUS_TRANSACTION',
    'SETTLEMENT_DELAY',
    'GENERAL_QUERY',
    'UNKNOWN',
  ]),
  confidence: z.number().min(0).max(1),
  risk: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  reasoningSummary: z.string().min(1).max(1200),
  recommendedAction: z.enum([
    'RETRY_ORDER_CREATION',
    'RECONCILE_PAYMENT',
    'INITIATE_REFUND',
    'NOTIFY_CUSTOMER',
    'ESCALATE_TO_HUMAN',
    'NO_ACTION',
  ]),
  refundAmount: z.number().nonnegative().optional(),
  customerMessage: z.string().max(600).optional(),
});

export type AiDecision = z.infer<typeof decisionSchema>;

/** Response schema handed to Gemini so it returns JSON rather than prose. */
export const geminiResponseSchema = {
  type: 'object',
  properties: {
    intent: {
      type: 'string',
      enum: [
        'PAYMENT_ORDER_MISMATCH',
        'REFUND_REQUEST',
        'HIGH_VALUE_REFUND',
        'SUSPICIOUS_TRANSACTION',
        'SETTLEMENT_DELAY',
        'GENERAL_QUERY',
        'UNKNOWN',
      ],
    },
    confidence: { type: 'number' },
    risk: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
    reasoningSummary: { type: 'string' },
    recommendedAction: {
      type: 'string',
      enum: [
        'RETRY_ORDER_CREATION',
        'RECONCILE_PAYMENT',
        'INITIATE_REFUND',
        'NOTIFY_CUSTOMER',
        'ESCALATE_TO_HUMAN',
        'NO_ACTION',
      ],
    },
    refundAmount: { type: 'number' },
    customerMessage: { type: 'string' },
  },
  required: ['intent', 'confidence', 'risk', 'reasoningSummary', 'recommendedAction'],
} as const;
