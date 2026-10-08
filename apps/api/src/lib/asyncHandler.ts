import { type Request, type Response, type NextFunction, type RequestHandler } from 'express';

// Envuelve un handler async para que sus promesas rechazadas lleguen
// automáticamente al errorHandler de Express.
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};