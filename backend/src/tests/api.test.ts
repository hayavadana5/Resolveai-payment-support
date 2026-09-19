import request from 'supertest';
import { createApp } from '../app';
import { Escalation, SupportCase, Transaction } from '../models';
import { ADMIN, AGENT, makeCase, seedUsers, seedWorld } from './fixtures';

const app = createApp();

async function tokenFor(user: { email: string; password: string }) {
  const res = await request(app).post('/api/auth/login').send({ email: user.email, password: user.password });
  return res.body.token as string;
}

beforeEach(async () => {
  await seedUsers();
  await seedWorld();
});

describe('authentication', () => {
  it('issues a token for valid credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: AGENT.email, password: AGENT.password });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.role).toBe('SUPPORT_AGENT');
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('rejects a wrong password without revealing whether the account exists', async () => {
    const wrongPassword = await request(app).post('/api/auth/login').send({ email: AGENT.email, password: 'nope' });
    const noAccount = await request(app).post('/api/auth/login').send({ email: 'ghost@test.dev', password: 'nope' });
    expect(wrongPassword.status).toBe(401);
    expect(noAccount.status).toBe(401);
    expect(wrongPassword.body.error).toBe(noAccount.body.error);
  });

  it('refuses unauthenticated access to cases', async () => {
    const res = await request(app).get('/api/cases');
    expect(res.status).toBe(401);
  });
});

describe('support cases', () => {
  it('creates a case and runs it autonomously', async () => {
    const token = await tokenFor(AGENT);
    const created = await request(app)
      .post('/api/cases')
      .set('Authorization', `Bearer ${token}`)
      .send({ customerId: 'CUS-1', transactionId: 'TXN-MISMATCH', issue: '₹2,499 was deducted but my order wasn\u2019t placed.' });

    expect(created.status).toBe(201);
    const caseId = created.body.case.caseId;

    const resolved = await request(app).post(`/api/cases/${caseId}/resolve`).set('Authorization', `Bearer ${token}`);
    expect(resolved.status).toBe(200);
    expect(resolved.body.outcome.resolved).toBe(true);

    const detail = await request(app).get(`/api/cases/${caseId}`).set('Authorization', `Bearer ${token}`);
    expect(detail.body.auditTrail.length).toBeGreaterThan(3);
  });

  it('refuses a case whose transaction belongs to someone else', async () => {
    const token = await tokenFor(AGENT);
    const res = await request(app)
      .post('/api/cases')
      .set('Authorization', `Bearer ${token}`)
      .send({ customerId: 'CUS-1', transactionId: 'TXN-FRAUD', issue: 'Not mine at all.' });
    expect(res.status).toBe(400);
  });
});

describe('human escalation', () => {
  it('lets an admin approve a high-value refund, which then executes and verifies', async () => {
    const agentToken = await tokenFor(AGENT);
    await makeCase('CASE-E1', 'TXN-BIG', 'I want a ₹50,000 refund.');
    await request(app).post('/api/cases/CASE-E1/resolve').set('Authorization', `Bearer ${agentToken}`);

    const escalation = await Escalation.findOne({ caseId: 'CASE-E1' });
    expect(escalation).not.toBeNull();

    const adminToken = await tokenFor(ADMIN);
    const decision = await request(app)
      .post(`/api/escalations/${escalation!.escalationId}/decision`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'APPROVE', note: 'Duplicate charge confirmed.' });

    expect(decision.status).toBe(200);
    const txn = await Transaction.findOne({ transactionId: 'TXN-BIG' });
    expect(txn?.refundedAmount).toBe(50000);
    const supportCase = await SupportCase.findOne({ caseId: 'CASE-E1' });
    expect(supportCase?.status).toBe('RESOLVED');
  });

  it('does not let a support agent approve a high-value refund', async () => {
    const agentToken = await tokenFor(AGENT);
    await makeCase('CASE-E2', 'TXN-BIG', 'I want a ₹50,000 refund.');
    await request(app).post('/api/cases/CASE-E2/resolve').set('Authorization', `Bearer ${agentToken}`);

    const escalation = await Escalation.findOne({ caseId: 'CASE-E2' });
    const res = await request(app)
      .post(`/api/escalations/${escalation!.escalationId}/decision`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ decision: 'APPROVE', note: 'Looks fine to me.' });

    expect(res.status).toBe(403);
    const txn = await Transaction.findOne({ transactionId: 'TXN-BIG' });
    expect(txn?.refundedAmount).toBe(0);
  });
});

describe('analytics', () => {
  it('computes metrics from stored records', async () => {
    const token = await tokenFor(AGENT);
    await makeCase('CASE-A1', 'TXN-MISMATCH', '₹2,499 deducted, no order.');
    await request(app).post('/api/cases/CASE-A1/resolve').set('Authorization', `Bearer ${token}`);

    const res = await request(app).get('/api/analytics').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.totals.cases).toBe(1);
    expect(res.body.totals.autonomousResolutions).toBe(1);
    expect(res.body.totals.verifiedCustomerResolutions).toBe(1);
    expect(res.body.rates.automationRate).toBe(100);
  });
});
