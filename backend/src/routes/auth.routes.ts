import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User } from '../models';
import { signToken, requireAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';
import { recordAudit } from '../services/audit.service';
import { rateLimit } from '../middleware/security';
import type { Role } from '../models/types';

export const authRouter = Router();

// Brute-force protection is deliberately stricter than the global API limit.
const loginLimiter = rateLimit({ windowMs: 10 * 60_000, max: 12, message: 'Too many sign-in attempts. Please wait a few minutes and try again.' });

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const user = await User.findOne({ email: email.toLowerCase() });
    const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;

    if (!user || !valid) {
      await recordAudit({
        event: 'AUTH',
        actor: email,
        actorType: 'HUMAN',
        summary: 'Failed sign-in attempt',
        outcome: 'FAILURE',
      });
      // Same message either way, so the endpoint cannot be used to enumerate accounts.
      res.status(401).json({ error: 'That email and password combination does not match an account.' });
      return;
    }

    const payload = {
      id: String(user._id),
      email: user.email,
      name: user.name,
      role: user.role as Role,
    };
    await recordAudit({
      event: 'AUTH',
      actor: user.email,
      actorType: 'HUMAN',
      summary: `${user.role} signed in`,
      outcome: 'SUCCESS',
    });
    res.json({ token: signToken(payload), user: payload });
  })
);

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});
