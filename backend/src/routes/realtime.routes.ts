import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { subscribeCase } from '../services/realtime';
import { SupportCase } from '../models';

export const realtimeRouter = Router();

function authenticate(req: Request) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : typeof req.query.token === 'string' ? req.query.token : '';
  if (!token) return null;
  try { return jwt.verify(token, env.jwtSecret); } catch { return null; }
}

realtimeRouter.get('/cases/:caseId/stream', async (req: Request, res: Response) => {
  if (!authenticate(req)) { res.status(401).json({ error: 'Sign in to view live case activity.' }); return; }
  const caseId = String(req.params.caseId);
  const exists = await SupportCase.exists({ caseId });
  if (!exists) { res.status(404).json({ error: `No case with id ${caseId}.` }); return; }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  res.write(`event: connected\ndata: ${JSON.stringify({ caseId, connectedAt: new Date().toISOString() })}\n\n`);

  const unsubscribe = subscribeCase(caseId, (event) => {
    res.write(`event: ${event.type.toLowerCase()}\ndata: ${JSON.stringify(event)}\n\n`);
  });
  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 15000);
  req.on('close', () => { clearInterval(heartbeat); unsubscribe(); });
});
