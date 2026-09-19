import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import type { Role } from '../models/types';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: AuthUser): string {
  return jwt.sign(user, env.jwtSecret, { expiresIn: env.jwtExpiresIn } as jwt.SignOptions);
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Sign in to continue.' });
    return;
  }
  try {
    const payload = jwt.verify(header.slice(7), env.jwtSecret) as Partial<AuthUser>;
    if (!payload.id || !payload.email || !payload.name || !payload.role || !['SUPPORT_AGENT', 'ADMIN'].includes(payload.role)) {
      throw new Error('Invalid session claims');
    }
    req.user = payload as AuthUser;
    next();
  } catch {
    res.status(401).json({ error: 'Your session has expired. Sign in again.' });
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: `This action requires the ${roles.join(' or ')} role.` });
      return;
    }
    next();
  };
}
