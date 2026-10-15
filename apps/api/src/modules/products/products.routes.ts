import { Router } from 'express';

import { authenticate } from '../../middleware/auth.js';
import { create, get, update } from './products.controller.js';

export const productsRouter = Router();

productsRouter.use(authenticate);
productsRouter.post('/', create);
productsRouter.get('/:id', get);
productsRouter.put('/:id', update);
