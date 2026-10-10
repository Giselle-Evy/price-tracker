import { type Request, type Response } from 'express';

import { asyncHandler } from '../../lib/asyncHandler.js';
import { analyzeSchema } from './analyze.schemas.js';
import { analyzeUrl } from './analyze.service.js';

export const analyze = asyncHandler(async (req: Request, res: Response) => {
  const input = analyzeSchema.parse(req.body);
  const result = await analyzeUrl(input);
  res.status(200).json(result);
});