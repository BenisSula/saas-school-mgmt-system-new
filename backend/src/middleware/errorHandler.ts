import { Request, Response } from 'express';

type HttpError = Error & { status?: number; statusCode?: number; expose?: boolean };

export function errorHandler(err: Error, _req: Request, res: Response) {
  const httpError = err as HttpError;
  const status = httpError.status ?? httpError.statusCode ?? 500;
  if (status >= 500) {
    console.error('[error]', err);
  } else {
    console.warn('[warn]', err.message);
  }
  const message =
    status >= 500 && httpError.expose !== true
      ? 'Internal server error'
      : (httpError.message ?? 'Request failed');
  res.status(status).json({ message });
}
