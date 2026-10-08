import { type Request, type Response } from 'express';

import { asyncHandler } from '../../lib/asyncHandler.js';
import { UnauthorizedError } from '../../lib/errors.js';
import { verifyToken } from '../../lib/jwt.js';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
} from './auth.schemas.js';
import {
  registerUser,
  loginUser,
  getUserById,
} from './auth.service.js';
import { signAccessToken, type JwtPayload } from '../../lib/jwt.js';

// ─────────────────────────────────────────────────────────────
// REGISTER
// ─────────────────────────────────────────────────────────────

export const register = asyncHandler(async (req: Request, res: Response) => {
  const input = registerSchema.parse(req.body);
  const result = await registerUser(input);
  res.status(201).json(result);
});

// ─────────────────────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────────────────────

export const login = asyncHandler(async (req: Request, res: Response) => {
  const input = loginSchema.parse(req.body);
  const result = await loginUser(input);
  res.status(200).json(result);
});

// ─────────────────────────────────────────────────────────────
// REFRESH
// ─────────────────────────────────────────────────────────────

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = refreshSchema.parse(req.body);

  const payload = verifyToken(refreshToken);

  const newPayload: JwtPayload = {
    userId: payload.userId,
    email: payload.email,
  };

  const accessToken = signAccessToken(newPayload);

  res.status(200).json({ accessToken });
});

// ─────────────────────────────────────────────────────────────
// ME
// ─────────────────────────────────────────────────────────────

export const me = asyncHandler(async (req: Request, res: Response) => {
  // authenticate garantiza que req.user existe.
  if (!req.user) {
    throw new UnauthorizedError('Not authenticated');
  }

  const profile = await getUserById(req.user.userId);
  res.status(200).json(profile);
});