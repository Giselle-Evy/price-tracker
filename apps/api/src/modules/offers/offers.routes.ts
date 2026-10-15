import { Router } from 'express';

import { authenticate, authenticateOptional } from '../../middleware/auth.js';
import { create, deleteOffer, get, list, update } from './offers.controller.js';

export const offersRouter = Router();

offersRouter.get('/', list);
offersRouter.get('/:id', authenticateOptional, get);
offersRouter.post('/', authenticate, create);
offersRouter.patch('/:id', authenticate, update);
offersRouter.delete('/:id', authenticate, deleteOffer);
