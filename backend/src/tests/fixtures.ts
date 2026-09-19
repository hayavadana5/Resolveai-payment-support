import bcrypt from 'bcryptjs';
import { Customer, Merchant, Order, SupportCase, Transaction, User } from '../models';

export const AGENT = { email: 'agent@test.dev', password: 'Agent@12345', role: 'SUPPORT_AGENT' as const };
export const ADMIN = { email: 'admin@test.dev', password: 'Admin@12345', role: 'ADMIN' as const };

export async function seedUsers() {
  await User.insertMany([
    { name: 'Test Agent', email: AGENT.email, passwordHash: await bcrypt.hash(AGENT.password, 4), role: AGENT.role },
    { name: 'Test Admin', email: ADMIN.email, passwordHash: await bcrypt.hash(ADMIN.password, 4), role: ADMIN.role },
  ]);
}

export async function seedWorld() {
  await Customer.create({ customerId: 'CUS-1', name: 'Test Customer', email: 'c@test.dev', phone: '+91-00000-00000', accountAgeDays: 500, verified: true });
  await Customer.create({ customerId: 'CUS-2', name: 'New Customer', email: 'n@test.dev', phone: '+91-00000-00001', accountAgeDays: 5, verified: false });
  await Merchant.create({ merchantId: 'MRC-1', businessName: 'Test Merchant', email: 'm@test.dev', phone: '+91-00000-00002', riskLevel: 'LOW' });
  await Merchant.create({ merchantId: 'MRC-2', businessName: 'Risky Merchant', email: 'r@test.dev', phone: '+91-00000-00003', riskLevel: 'HIGH' });

  // Payment captured, order missing — scenario 1.
  await Transaction.create({ transactionId: 'TXN-MISMATCH', customerId: 'CUS-1', merchantId: 'MRC-1', amount: 2499, status: 'SUCCESS', gatewayStatus: 'CAPTURED', settlementStatus: 'PENDING', riskLevel: 'LOW', riskSignals: [] });

  // Eligible refund — scenario 2.
  await Transaction.create({ transactionId: 'TXN-REFUND', customerId: 'CUS-1', merchantId: 'MRC-1', amount: 3000, status: 'SUCCESS', gatewayStatus: 'CAPTURED', settlementStatus: 'SETTLED', riskLevel: 'LOW', riskSignals: [], orderId: 'ORD-R' });
  await Order.create({ orderId: 'ORD-R', transactionId: 'TXN-REFUND', customerId: 'CUS-1', merchantId: 'MRC-1', amount: 3000, status: 'CREATED' });

  // High-value refund — scenario 3.
  await Transaction.create({ transactionId: 'TXN-BIG', customerId: 'CUS-1', merchantId: 'MRC-1', amount: 50000, status: 'SUCCESS', gatewayStatus: 'CAPTURED', settlementStatus: 'SETTLED', riskLevel: 'MEDIUM', riskSignals: ['HIGH_VALUE_TRANSACTION'], orderId: 'ORD-B' });
  await Order.create({ orderId: 'ORD-B', transactionId: 'TXN-BIG', customerId: 'CUS-1', merchantId: 'MRC-1', amount: 50000, status: 'CREATED' });

  // Suspicious — scenario 4.
  await Transaction.create({ transactionId: 'TXN-FRAUD', customerId: 'CUS-2', merchantId: 'MRC-2', amount: 45000, status: 'SUCCESS', gatewayStatus: 'CAPTURED', settlementStatus: 'ON_HOLD', riskLevel: 'HIGH', riskSignals: ['UNUSUAL_GEOGRAPHY', 'VELOCITY_SPIKE'], orderId: 'ORD-F' });
  await Order.create({ orderId: 'ORD-F', transactionId: 'TXN-FRAUD', customerId: 'CUS-2', merchantId: 'MRC-2', amount: 45000, status: 'CREATED' });
}

export async function makeCase(caseId: string, transactionId: string, issue: string, customerId = 'CUS-1') {
  return SupportCase.create({ caseId, customerId, merchantId: 'MRC-1', transactionId, issue, status: 'OPEN' });
}

export const AI_CALLER = { type: 'AI' as const, identifier: 'AI_ORCHESTRATOR', role: 'AI' as const };
