import { type Request, type Response } from 'express';

import { asyncHandler } from '../../lib/asyncHandler.js';
import { UnauthorizedError } from '../../lib/errors.js';
import {
  createConfigSchema,
  updateConfigSchema,
  configIdParamSchema,
} from './configs.schemas.js';
import {
  createConfig,
  listConfigs,
  getConfig,
  updateConfig,
  deleteConfig,
} from './configs.service.js';

// ─────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────

export const create = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError('Not authenticated');
  }

  const input = createConfigSchema.parse(req.body);
  const config = await createConfig(req.user.userId, input);

  res.status(201).json(config);
});

// ─────────────────────────────────────────────────────────────
// LIST
// ─────────────────────────────────────────────────────────────

export const list = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError('Not authenticated');
  }

  const configs = await listConfigs(req.user.userId);

  res.status(200).json({ configs });
});

// ─────────────────────────────────────────────────────────────
// GET
// ─────────────────────────────────────────────────────────────

export const get = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError('Not authenticated');
  }

  const { id } = configIdParamSchema.parse(req.params);
  const config = await getConfig(req.user.userId, id);

  res.status(200).json(config);
});

// ─────────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────────

export const update = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError('Not authenticated');
  }

  const { id } = configIdParamSchema.parse(req.params);
  const input = updateConfigSchema.parse(req.body);
  const config = await updateConfig(req.user.userId, id, input);

  res.status(200).json(config);
});

// ─────────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────────

export const remove = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError('Not authenticated');
  }

  const { id } = configIdParamSchema.parse(req.params);
  await deleteConfig(req.user.userId, id);

  res.status(204).send();
});