import { Router } from 'express';

import { authenticate } from '../../middleware/auth.js';
import {
  create,
  list,
  get,
  update,
  remove,
} from './monitors.controller.js';

export const monitorsRouter = Router();

// Todas las rutas requieren autenticacion
monitorsRouter.use(authenticate);

monitorsRouter.post('/', create);
monitorsRouter.get('/', list);
monitorsRouter.get('/:id', get);
monitorsRouter.patch('/:id', update);
monitorsRouter.delete('/:id', remove);