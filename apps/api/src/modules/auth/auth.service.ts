import bcrypt from 'bcrypt';

import { prisma } from '../../lib/prisma.js';
import { ConflictError, UnauthorizedError, NotFoundError } from '../../lib/errors.js';
import {
  signAccessToken,
  signRefreshToken,
  type JwtPayload,
} from '../../lib/jwt.js';
import type { RegisterInput, LoginInput } from './auth.schemas.js';

const BCRYPT_ROUNDS = 12;

// ─────────────────────────────────────────────────────────────
// PASSWORD
// ─────────────────────────────────────────────────────────────

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ─────────────────────────────────────────────────────────────
// REGISTER
// ─────────────────────────────────────────────────────────────

export type AuthResult = {
  user: {
    id: string;
    email: string;
    name: string | null;
  };
  accessToken: string;
  refreshToken: string;
};

export async function registerUser(input: RegisterInput): Promise<AuthResult> {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (existing) {
    throw new ConflictError('Email already registered');
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      name: input.name ?? null,
    },
    select: {
      id: true,
      email: true,
      name: true,
    },
  });

  return buildAuthResult(user);
}

// ─────────────────────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────────────────────

export async function loginUser(input: LoginInput): Promise<AuthResult> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (!user) {
    // Mensaje genérico para no revelar si el email existe o no.
    throw new UnauthorizedError('Invalid credentials');
  }

  const passwordOk = await verifyPassword(input.password, user.passwordHash);

  if (!passwordOk) {
    throw new UnauthorizedError('Invalid credentials');
  }

  return buildAuthResult({
    id: user.id,
    email: user.email,
    name: user.name,
  });
}

// ─────────────────────────────────────────────────────────────
// GET USER BY ID
// ─────────────────────────────────────────────────────────────

export async function getUserById(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  return user;
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function buildAuthResult(user: { id: string; email: string; name: string | null }): AuthResult {
  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
  };

  return {
    user,
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
}