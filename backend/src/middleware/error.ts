import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: 'That endpoint does not exist.' });
}

/** Never leaks stack traces or driver internals to the client. */
export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: 'Some fields need attention.',
      issues: error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
    return;
  }
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  // eslint-disable-next-line no-console
  console.error('[error]', error);
  res.status(500).json({
    error: 'Something went wrong on our side. The case was not changed.',
    ...(env.nodeEnv === 'development' && error instanceof Error ? { detail: error.message } : {}),
  });
}

export function asyncHandler<T extends Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: T, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}
