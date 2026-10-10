import { Router } from 'express';

import { analyze } from './analyze.controller.js';

export const analyzeRouter = Router();

analyzeRouter.post('/', analyze);
