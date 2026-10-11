import { Router } from 'express';

import { authenticate } from '../../middleware/auth.js';
import { create, list, get, update, remove } from './configs.controller.js';

export const configsRouter = Router();

// Todas las rutas requieren autenticación
configsRouter.use(authenticate);

configsRouter.post('/', create);
configsRouter.get('/', list);
configsRouter.get('/:id', get);
configsRouter.patch('/:id', update);
configsRouter.delete('/:id', remove);