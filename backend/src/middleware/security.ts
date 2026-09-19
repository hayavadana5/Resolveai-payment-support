import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

/** Lightweight dependency-free rate limiter for hackathon/edge deployments. */
export function rateLimit(options: { windowMs: number; max: number; message?: string }) {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + options.windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    res.setHeader('X-RateLimit-Limit', options.max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, options.max - bucket.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(bucket.resetAt / 1000));
    if (bucket.count > options.max) {
      res.status(429).json({ error: options.message ?? 'Too many requests. Please try again shortly.' });
      return;
    }
    next();
  };
}

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const supplied = req.header('X-Request-ID');
  const id = supplied && /^[A-Za-z0-9._:-]{8,100}$/.test(supplied) ? supplied : crypto.randomUUID();
  res.setHeader('X-Request-ID', id);
  res.locals.requestId = id;
  next();
}

export function noStoreForSensitiveRoutes(req: Request, res: Response, next: NextFunction): void {
  if (req.path.startsWith('/api/auth') || req.path.startsWith('/api/intake') || req.path.startsWith('/api/portal')) {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
}
