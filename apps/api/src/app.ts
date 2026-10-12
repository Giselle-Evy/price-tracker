import express, { type Application, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { NotFoundError } from './lib/errors.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { analyzeRouter } from './modules/analyze/analyze.routes.js';
import { configsRouter } from './modules/configs/configs.routes.js';
import { monitorsRouter } from './modules/monitors/monitors.routes.js';

export function createApp(): Application {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.NODE_ENV === 'production'
        ? ['https://price-tracker.vercel.app']
        : ['http://localhost:5173', 'http://localhost:3000'],
      credentials: true,
    })
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      env: env.NODE_ENV,
    });
  });

  // Rutas
  app.use('/auth', authRouter);
  app.use('/analyze', analyzeRouter);
  app.use('/configs', configsRouter);
  app.use('/monitors', monitorsRouter);

  // 404
  app.use((_req, _res, next) => {
    next(new NotFoundError('Route not found'));
  });

  // Error handler
  app.use(errorHandler);

  return app;
}