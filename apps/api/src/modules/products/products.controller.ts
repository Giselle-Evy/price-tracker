import { type Request, type Response } from 'express';

import { asyncHandler } from '../../lib/asyncHandler.js';
import { UnauthorizedError } from '../../lib/errors.js';
import { getProduct, saveProduct, updateProduct } from './products.service.js';
import { productIdParamSchema, saveProductSchema } from './products.schemas.js';

export const create = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError('Not authenticated');

  const input = saveProductSchema.parse(req.body);
  const product = await saveProduct(input);
  res.status(201).json(product);
});

export const get = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError('Not authenticated');

  const { id } = productIdParamSchema.parse(req.params);
  const product = await getProduct(id);
  res.status(200).json(product);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError('Not authenticated');

  const { id } = productIdParamSchema.parse(req.params);
  const input = saveProductSchema.parse(req.body);
  const product = await updateProduct(id, input);
  res.status(200).json(product);
});
