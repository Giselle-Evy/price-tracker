import { type Request, type Response, type NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors.js';
import { env } from '../config/env.js';

// Middleware de manejo de errores. Debe ser el último en registrarse.
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Error de Zod (validación)
  if (err instanceof ZodError) {
    res.status(422).json({
      error: 'Validation error',
      details: err.flatten().fieldErrors,
    });
    return;
  }

  // Error de aplicación (esperado)
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      ...(err instanceof Error && 'details' in err ? { details: (err as { details: unknown }).details } : {}),
    });
    return;
  }

  // Error inesperado (bug o fallo de infraestructura)
  console.error('[Unhandled error]', err);

  res.status(500).json({
    error: 'Internal server error',
    // En desarrollo mostramos el mensaje real, en producción no.
    ...(env.NODE_ENV === 'development' ? { details: err.message } : {}),
  });
}