import { type Request, type Response, type NextFunction } from 'express';

import { UnauthorizedError } from '../lib/errors.js';
import { verifyToken } from '../lib/jwt.js';

export function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const header = req.headers.authorization;

  if (!header) {
    next(new UnauthorizedError('Missing authorization header'));
    return;
  }

  const parts = header.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    next(new UnauthorizedError('Invalid authorization header format'));
    return;
  }

  const token = parts[1];

  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch (error) {
    next(error);
  }
}