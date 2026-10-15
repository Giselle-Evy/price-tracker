import { type Request, type Response } from 'express';

import { asyncHandler } from '../../lib/asyncHandler.js';
import { UnauthorizedError } from '../../lib/errors.js';
import {
  createOfferSchema,
  listOffersQuerySchema,
  offerIdParamSchema,
  updateOfferSchema,
} from './offers.schemas.js';
import {
  createOffer,
  deleteOffer as deleteOfferRecord,
  getOffer,
  listOffers,
  updateOffer,
} from './offers.service.js';

export const create = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError('Not authenticated');

  const input = createOfferSchema.parse(req.body);
  const offer = await createOffer(req.user.userId, input);
  res.status(201).json(offer);
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit } = listOffersQuerySchema.parse(req.query);
  res.status(200).json(await listOffers(page, limit));
});

export const get = asyncHandler(async (req: Request, res: Response) => {
  const { id } = offerIdParamSchema.parse(req.params);
  res.status(200).json(await getOffer(id, req.user?.userId));
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError('Not authenticated');

  const { id } = offerIdParamSchema.parse(req.params);
  const input = updateOfferSchema.parse(req.body);
  res.status(200).json(await updateOffer(req.user.userId, id, input));
});

export const deleteOffer = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError('Not authenticated');

  const { id } = offerIdParamSchema.parse(req.params);
  await deleteOfferRecord(req.user.userId, id);
  res.status(204).send();
});
