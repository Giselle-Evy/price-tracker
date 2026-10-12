import { type Request, type Response } from 'express';

import { asyncHandler } from '../../lib/asyncHandler.js';
import { UnauthorizedError } from '../../lib/errors.js';
import {
  createMonitorSchema,
  updateMonitorSchema,
  monitorIdParamSchema,
} from './monitors.schemas.js';
import {
  createMonitor,
  listMonitors,
  getMonitor,
  updateMonitor,
  deleteMonitor,
} from './monitors.service.js';

// ─────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────

export const create = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError('Not authenticated');
  }

  const input = createMonitorSchema.parse(req.body);
  const monitor = await createMonitor(req.user.userId, input);

  res.status(201).json(monitor);
});

// ─────────────────────────────────────────────────────────────
// LIST
// ─────────────────────────────────────────────────────────────

export const list = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError('Not authenticated');
  }

  const monitors = await listMonitors(req.user.userId);

  res.status(200).json({ monitors });
});

// ─────────────────────────────────────────────────────────────
// GET
// ─────────────────────────────────────────────────────────────

export const get = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError('Not authenticated');
  }

  const { id } = monitorIdParamSchema.parse(req.params);
  const monitor = await getMonitor(req.user.userId, id);

  res.status(200).json(monitor);
});

// ─────────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────────

export const update = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError('Not authenticated');
  }

  const { id } = monitorIdParamSchema.parse(req.params);
  const input = updateMonitorSchema.parse(req.body);
  const monitor = await updateMonitor(req.user.userId, id, input);

  res.status(200).json(monitor);
});

// ─────────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────────

export const remove = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError('Not authenticated');
  }

  const { id } = monitorIdParamSchema.parse(req.params);
  await deleteMonitor(req.user.userId, id);

  res.status(204).send();
});