import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { authRouter } from './routes/auth.routes';
import { casesRouter } from './routes/cases.routes';
import { escalationsRouter } from './routes/escalations.routes';
import { auditRouter } from './routes/audit.routes';
import { analyticsRouter } from './routes/analytics.routes';
import { referenceRouter } from './routes/reference.routes';
import { intakeRouter } from './routes/intake.routes';
import { portalRouter } from './routes/portal.routes';
import { intelligenceRouter } from './routes/intelligence.routes';
import { operationsRouter } from './routes/operations.routes';
import { realtimeRouter } from './routes/realtime.routes';
import { demoRouter } from './routes/demo.routes';
import { errorHandler, notFound } from './middleware/error';
import { noStoreForSensitiveRoutes, rateLimit, requestId } from './middleware/security';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(requestId);
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }));
  app.use(cors({
    origin: env.corsOrigin.split(',').map((origin) => origin.trim()).filter(Boolean),
    credentials: true,
  }));
  app.use(noStoreForSensitiveRoutes);
  app.use(rateLimit({ windowMs: 60_000, max: 240 }));
  app.use(express.json({ limit: '256kb' }));
  if (env.nodeEnv !== 'test') app.use(morgan('dev'));

  app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'resolveai', time: new Date().toISOString() }));

  app.use('/api/intake', intakeRouter);
  app.use('/api/portal', portalRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/cases', casesRouter);
  app.use('/api/escalations', escalationsRouter);
  app.use('/api/audit', auditRouter);
  app.use('/api/analytics', analyticsRouter);
  app.use('/api/reference', referenceRouter);
  app.use('/api/intelligence', intelligenceRouter);
  app.use('/api/operations', operationsRouter);
  app.use('/api/realtime', realtimeRouter);
  app.use('/api/demo', demoRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
