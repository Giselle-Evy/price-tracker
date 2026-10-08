import { Router } from 'express';

import { authenticate } from '../../middleware/auth.js';
import { register, login, refresh, me } from './auth.controller.js';

export const authRouter = Router();

authRouter.post('/register', register);
authRouter.post('/login', login);
authRouter.post('/refresh', refresh);
authRouter.get('/me', authenticate, me);