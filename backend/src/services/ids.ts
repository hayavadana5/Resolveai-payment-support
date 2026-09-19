import crypto from 'crypto';

function suffix(len = 6): string {
  return crypto.randomBytes(8).toString('hex').toUpperCase().slice(0, len);
}

export const newCaseId = () => `CASE-${suffix()}`;
export const newPortalToken = () => `portal_${crypto.randomBytes(24).toString('hex')}`;
export const newCustomerId = () => `CUS-${suffix(8)}`;
export const newEscalationId = () => `ESC-${suffix()}`;
export const newOrderId = () => `ORD-${suffix(8)}`;
export const newRefundReference = () => `RFND-${suffix(8)}`;
export const newReconciliationRef = () => `RECON-${suffix(8)}`;
