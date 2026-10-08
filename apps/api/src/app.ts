import express, { type Application, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { NotFoundError } from './lib/errors.js';

export function createApp(): Application {
  const app = express();

  // Seguridad básica
  app.use(helmet());
  app.use(
    cors({
      origin: env.NODE_ENV === 'production'
        ? ['https://price-tracker.vercel.app']
        : ['http://localhost:5173', 'http://localhost:3000'],
      credentials: true,
    })
  );

  // Parseo de body
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Healthcheck
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      env: env.NODE_ENV,
    });
  });

  // Las rutas de /auth, /configs, /monitors, etc. se añadirán en sub-pasos siguientes.

  // Ruta 404 para cualquier ruta no registrada
  app.use((_req, _res, next) => {
    next(new NotFoundError('Route not found'));
  });

  // Middleware de errores (SIEMPRE el último)
  app.use(errorHandler);

  return app;
}