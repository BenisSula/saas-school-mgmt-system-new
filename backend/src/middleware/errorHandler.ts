import { Request, Response } from 'express';

export function errorHandler(err: Error, _req: Request, res: Response) {
  console.error('[error]', err);
  res.status(500).json({ message: 'Internal server error' });
}

