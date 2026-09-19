export const customers = [
  { customerId: 'CUS-1001', name: 'Ananya Rao', email: 'ananya.rao@example.in', phone: '+91-98450-11001', accountAgeDays: 820, verified: true },
  { customerId: 'CUS-1002', name: 'Vikram Shetty', email: 'vikram.shetty@example.in', phone: '+91-98450-11002', accountAgeDays: 410, verified: true },
  { customerId: 'CUS-1003', name: 'Fatima Qureshi', email: 'fatima.q@example.in', phone: '+91-98450-11003', accountAgeDays: 95, verified: true },
  { customerId: 'CUS-1004', name: 'Joseph Mathew', email: 'joseph.mathew@example.in', phone: '+91-98450-11004', accountAgeDays: 1240, verified: true },
  { customerId: 'CUS-1005', name: 'Neha Bhatt', email: 'neha.bhatt@example.in', phone: '+91-98450-11005', accountAgeDays: 18, verified: false },
  { customerId: 'CUS-1006', name: 'Rohit Kulkarni', email: 'rohit.k@example.in', phone: '+91-98450-11006', accountAgeDays: 600, verified: true },
  { customerId: 'CUS-1007', name: 'Sneha Iyer', email: 'sneha.iyer@example.in', phone: '+91-98450-11007', accountAgeDays: 340, verified: true },
  { customerId: 'CUS-1008', name: 'Arjun Nair', email: 'arjun.nair@example.in', phone: '+91-98450-11008', accountAgeDays: 210, verified: true },
  { customerId: 'CUS-1009', name: 'Priyanka Das', email: 'priyanka.das@example.in', phone: '+91-98450-11009', accountAgeDays: 75, verified: true },
  { customerId: 'CUS-1010', name: 'Imran Sheikh', email: 'imran.sheikh@example.in', phone: '+91-98450-11010', accountAgeDays: 12, verified: false },
  { customerId: 'CUS-1011', name: 'Kavya Reddy', email: 'kavya.reddy@example.in', phone: '+91-98450-11011', accountAgeDays: 980, verified: true },
];

export const merchants = [
  { merchantId: 'MRC-2201', businessName: 'Urban Cart Retail', email: 'ops@urbancart.in', phone: '+91-80-4001-2201', category: 'ECOMMERCE', riskLevel: 'LOW', knownIssues: ['Order service occasionally drops payment webhooks'] },
  { merchantId: 'MRC-2202', businessName: 'Bengaluru Bites', email: 'support@bengalurubites.in', phone: '+91-80-4001-2202', category: 'FOOD_DELIVERY', riskLevel: 'LOW', knownIssues: [] },
  { merchantId: 'MRC-2203', businessName: 'Peak Gear Outdoors', email: 'help@peakgear.in', phone: '+91-80-4001-2203', category: 'RETAIL', riskLevel: 'MEDIUM', knownIssues: ['Slow settlement cycle'] },
  { merchantId: 'MRC-2204', businessName: 'QuickCash Digital', email: 'ops@quickcash.in', phone: '+91-80-4001-2204', category: 'DIGITAL_GOODS', riskLevel: 'HIGH', knownIssues: ['Elevated chargeback ratio', 'Under enhanced monitoring'] },
  { merchantId: 'MRC-2205', businessName: 'Lotus Wellness', email: 'care@lotuswellness.in', phone: '+91-80-4001-2205', category: 'SERVICES', riskLevel: 'LOW', knownIssues: [] },
];

interface SeedTxn {
  transactionId: string; customerId: string; merchantId: string; amount: number;
  status: string; paymentMethod: string; gatewayStatus: string; settlementStatus: string;
  riskLevel: string; riskSignals: string[]; orderId: string | null; refundedAmount?: number;
}

export const transactions: SeedTxn[] = [
  // --- Demo scenario 1: payment captured, order missing ---
  { transactionId: 'TXN-3001', customerId: 'CUS-1001', merchantId: 'MRC-2201', amount: 2499, status: 'SUCCESS', paymentMethod: 'UPI', gatewayStatus: 'CAPTURED', settlementStatus: 'PENDING', riskLevel: 'LOW', riskSignals: [], orderId: null },
  // --- Demo scenario 2: eligible refund ---
  { transactionId: 'TXN-3002', customerId: 'CUS-1002', merchantId: 'MRC-2202', amount: 3000, status: 'SUCCESS', paymentMethod: 'CARD', gatewayStatus: 'CAPTURED', settlementStatus: 'SETTLED', riskLevel: 'LOW', riskSignals: [], orderId: 'ORD-4002' },
  // --- Demo scenario 3: high-value refund ---
  { transactionId: 'TXN-3003', customerId: 'CUS-1004', merchantId: 'MRC-2203', amount: 50000, status: 'SUCCESS', paymentMethod: 'NETBANKING', gatewayStatus: 'CAPTURED', settlementStatus: 'SETTLED', riskLevel: 'MEDIUM', riskSignals: ['HIGH_VALUE_TRANSACTION'], orderId: 'ORD-4003' },
  // --- Demo scenario 4: suspicious transaction ---
  { transactionId: 'TXN-3004', customerId: 'CUS-1005', merchantId: 'MRC-2204', amount: 45000, status: 'SUCCESS', paymentMethod: 'CARD', gatewayStatus: 'CAPTURED', settlementStatus: 'ON_HOLD', riskLevel: 'HIGH', riskSignals: ['UNUSUAL_GEOGRAPHY', 'VELOCITY_SPIKE', 'NEW_ACCOUNT'], orderId: 'ORD-4004' },

  { transactionId: 'TXN-3005', customerId: 'CUS-1003', merchantId: 'MRC-2201', amount: 1299, status: 'SUCCESS', paymentMethod: 'UPI', gatewayStatus: 'CAPTURED', settlementStatus: 'SETTLED', riskLevel: 'LOW', riskSignals: [], orderId: 'ORD-4005' },
  { transactionId: 'TXN-3006', customerId: 'CUS-1006', merchantId: 'MRC-2202', amount: 780, status: 'SUCCESS', paymentMethod: 'UPI', gatewayStatus: 'CAPTURED', settlementStatus: 'SETTLED', riskLevel: 'LOW', riskSignals: [], orderId: 'ORD-4006' },
  { transactionId: 'TXN-3007', customerId: 'CUS-1007', merchantId: 'MRC-2205', amount: 4500, status: 'SUCCESS', paymentMethod: 'CARD', gatewayStatus: 'CAPTURED', settlementStatus: 'PENDING', riskLevel: 'LOW', riskSignals: [], orderId: null },
  { transactionId: 'TXN-3008', customerId: 'CUS-1008', merchantId: 'MRC-2203', amount: 8900, status: 'SUCCESS', paymentMethod: 'CARD', gatewayStatus: 'CAPTURED', settlementStatus: 'SETTLED', riskLevel: 'LOW', riskSignals: [], orderId: 'ORD-4008' },
  { transactionId: 'TXN-3009', customerId: 'CUS-1009', merchantId: 'MRC-2201', amount: 2150, status: 'FAILED', paymentMethod: 'UPI', gatewayStatus: 'DECLINED', settlementStatus: 'NOT_APPLICABLE', riskLevel: 'LOW', riskSignals: [], orderId: null },
  { transactionId: 'TXN-3010', customerId: 'CUS-1010', merchantId: 'MRC-2204', amount: 32000, status: 'SUCCESS', paymentMethod: 'CARD', gatewayStatus: 'CAPTURED', settlementStatus: 'ON_HOLD', riskLevel: 'HIGH', riskSignals: ['NEW_ACCOUNT', 'HIGH_VALUE_TRANSACTION'], orderId: 'ORD-4010' },
  { transactionId: 'TXN-3011', customerId: 'CUS-1011', merchantId: 'MRC-2205', amount: 1800, status: 'REFUNDED', paymentMethod: 'UPI', gatewayStatus: 'REFUNDED', settlementStatus: 'SETTLED', riskLevel: 'LOW', riskSignals: [], orderId: 'ORD-4011', refundedAmount: 1800 },
  { transactionId: 'TXN-3012', customerId: 'CUS-1001', merchantId: 'MRC-2202', amount: 640, status: 'SUCCESS', paymentMethod: 'UPI', gatewayStatus: 'CAPTURED', settlementStatus: 'SETTLED', riskLevel: 'LOW', riskSignals: [], orderId: 'ORD-4012' },
  { transactionId: 'TXN-3013', customerId: 'CUS-1002', merchantId: 'MRC-2201', amount: 5600, status: 'SUCCESS', paymentMethod: 'CARD', gatewayStatus: 'CAPTURED', settlementStatus: 'SETTLED', riskLevel: 'LOW', riskSignals: [], orderId: 'ORD-4013' },
  { transactionId: 'TXN-3014', customerId: 'CUS-1004', merchantId: 'MRC-2202', amount: 1120, status: 'SUCCESS', paymentMethod: 'UPI', gatewayStatus: 'CAPTURED', settlementStatus: 'SETTLED', riskLevel: 'LOW', riskSignals: [], orderId: 'ORD-4014' },
  { transactionId: 'TXN-3015', customerId: 'CUS-1006', merchantId: 'MRC-2203', amount: 15750, status: 'SUCCESS', paymentMethod: 'NETBANKING', gatewayStatus: 'CAPTURED', settlementStatus: 'PENDING', riskLevel: 'MEDIUM', riskSignals: ['HIGH_VALUE_TRANSACTION'], orderId: 'ORD-4015' },
  { transactionId: 'TXN-3016', customerId: 'CUS-1007', merchantId: 'MRC-2201', amount: 3499, status: 'SUCCESS', paymentMethod: 'UPI', gatewayStatus: 'CAPTURED', settlementStatus: 'SETTLED', riskLevel: 'LOW', riskSignals: [], orderId: null },
  { transactionId: 'TXN-3017', customerId: 'CUS-1008', merchantId: 'MRC-2205', amount: 990, status: 'PENDING', paymentMethod: 'UPI', gatewayStatus: 'AUTHORIZING', settlementStatus: 'NOT_APPLICABLE', riskLevel: 'LOW', riskSignals: [], orderId: null },
  { transactionId: 'TXN-3018', customerId: 'CUS-1009', merchantId: 'MRC-2202', amount: 450, status: 'SUCCESS', paymentMethod: 'UPI', gatewayStatus: 'CAPTURED', settlementStatus: 'SETTLED', riskLevel: 'LOW', riskSignals: [], orderId: 'ORD-4018' },
  { transactionId: 'TXN-3019', customerId: 'CUS-1011', merchantId: 'MRC-2201', amount: 7200, status: 'SUCCESS', paymentMethod: 'CARD', gatewayStatus: 'CAPTURED', settlementStatus: 'SETTLED', riskLevel: 'LOW', riskSignals: [], orderId: 'ORD-4019' },
  { transactionId: 'TXN-3020', customerId: 'CUS-1003', merchantId: 'MRC-2204', amount: 27500, status: 'SUCCESS', paymentMethod: 'CARD', gatewayStatus: 'CAPTURED', settlementStatus: 'ON_HOLD', riskLevel: 'HIGH', riskSignals: ['DEVICE_MISMATCH', 'HIGH_VALUE_TRANSACTION'], orderId: 'ORD-4020' },
  { transactionId: 'TXN-3021', customerId: 'CUS-1010', merchantId: 'MRC-2203', amount: 2300, status: 'REVERSED', paymentMethod: 'UPI', gatewayStatus: 'REVERSED', settlementStatus: 'NOT_APPLICABLE', riskLevel: 'MEDIUM', riskSignals: ['NEW_ACCOUNT'], orderId: null },
];

export const orders = [
  { orderId: 'ORD-4002', transactionId: 'TXN-3002', amount: 3000, status: 'CREATED', items: [{ name: 'Weekend grocery bundle', quantity: 1, price: 3000 }] },
  { orderId: 'ORD-4003', transactionId: 'TXN-3003', amount: 50000, status: 'CREATED', items: [{ name: 'Expedition tent system', quantity: 1, price: 50000 }] },
  { orderId: 'ORD-4004', transactionId: 'TXN-3004', amount: 45000, status: 'CREATED', items: [{ name: 'Digital voucher pack', quantity: 9, price: 5000 }] },
  { orderId: 'ORD-4005', transactionId: 'TXN-3005', amount: 1299, status: 'CREATED', items: [{ name: 'Cotton bedsheet set', quantity: 1, price: 1299 }] },
  { orderId: 'ORD-4006', transactionId: 'TXN-3006', amount: 780, status: 'CREATED', items: [{ name: 'Thali for two', quantity: 1, price: 780 }] },
  { orderId: 'ORD-4008', transactionId: 'TXN-3008', amount: 8900, status: 'CREATED', items: [{ name: 'Trail running shoes', quantity: 1, price: 8900 }] },
  { orderId: 'ORD-4010', transactionId: 'TXN-3010', amount: 32000, status: 'CREATED', items: [{ name: 'Gift card bundle', quantity: 4, price: 8000 }] },
  { orderId: 'ORD-4011', transactionId: 'TXN-3011', amount: 1800, status: 'CANCELLED', items: [{ name: 'Yoga class pack', quantity: 1, price: 1800 }] },
  { orderId: 'ORD-4012', transactionId: 'TXN-3012', amount: 640, status: 'CREATED', items: [{ name: 'Breakfast combo', quantity: 2, price: 320 }] },
  { orderId: 'ORD-4013', transactionId: 'TXN-3013', amount: 5600, status: 'CREATED', items: [{ name: 'Cookware set', quantity: 1, price: 5600 }] },
  { orderId: 'ORD-4014', transactionId: 'TXN-3014', amount: 1120, status: 'CREATED', items: [{ name: 'Family dinner', quantity: 1, price: 1120 }] },
  { orderId: 'ORD-4015', transactionId: 'TXN-3015', amount: 15750, status: 'CREATED', items: [{ name: 'Camping pack', quantity: 1, price: 15750 }] },
  { orderId: 'ORD-4018', transactionId: 'TXN-3018', amount: 450, status: 'CREATED', items: [{ name: 'Filter coffee pack', quantity: 3, price: 150 }] },
  { orderId: 'ORD-4019', transactionId: 'TXN-3019', amount: 7200, status: 'CREATED', items: [{ name: 'Study desk', quantity: 1, price: 7200 }] },
  { orderId: 'ORD-4020', transactionId: 'TXN-3020', amount: 27500, status: 'CREATED', items: [{ name: 'Premium voucher pack', quantity: 5, price: 5500 }] },
  { orderId: 'ORD-4021', transactionId: 'TXN-3009', amount: 2150, status: 'FAILED', items: [{ name: 'Wireless earbuds', quantity: 1, price: 2150 }], failureReason: 'Payment declined by issuer' },
];

export const policies = [
  { policyId: 'POL-REFUND-AUTONOMOUS', name: 'Autonomous refund ceiling', description: 'Refunds up to INR 5,000 may be issued without human approval when the payment was captured and not already refunded.', conditions: { action: 'INITIATE_REFUND', maxAmount: 5000 }, allowedAction: 'INITIATE_REFUND', approvalRequired: false, riskLevel: 'LOW' },
  { policyId: 'POL-REFUND-APPROVAL', name: 'High-value refund approval', description: 'Refunds above INR 5,000 require approval from a payments lead with the ADMIN role.', conditions: { action: 'INITIATE_REFUND', minAmount: 5001 }, allowedAction: 'ESCALATE_TO_HUMAN', approvalRequired: true, riskLevel: 'MEDIUM' },
  { policyId: 'POL-RISK-SUSPICIOUS', name: 'Suspicious transaction hold', description: 'Transactions carrying two or more risk signals, or flagged HIGH risk, block all autonomous financial action.', conditions: { minRiskSignals: 2 }, allowedAction: 'ESCALATE_TO_HUMAN', approvalRequired: true, riskLevel: 'HIGH' },
  { policyId: 'POL-CONFIDENCE-FLOOR', name: 'Confidence floor', description: 'The teammate may only act autonomously at confidence of 0.80 or above.', conditions: { minConfidence: 0.8 }, allowedAction: 'ANY', approvalRequired: true, riskLevel: 'MEDIUM' },
  { policyId: 'POL-REPEATED-FAILURE', name: 'Repeated action failure', description: 'After two failed attempts the case escalates rather than retrying.', conditions: { maxAttempts: 2 }, allowedAction: 'ESCALATE_TO_HUMAN', approvalRequired: true, riskLevel: 'MEDIUM' },
  { policyId: 'POL-REFUND-ELIGIBILITY', name: 'Refund eligibility', description: 'Only a SUCCESS transaction with remaining refundable balance may be refunded.', conditions: { transactionStatus: 'SUCCESS' }, allowedAction: 'INITIATE_REFUND', approvalRequired: false, riskLevel: 'LOW' },
];
