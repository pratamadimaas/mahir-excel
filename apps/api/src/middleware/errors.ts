import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError, type ZodType } from 'zod';

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'CSRF_INVALID'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'PREMIUM_REQUIRED';

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what = 'Data'): AppError => new AppError(404, 'NOT_FOUND', `${what} tidak ditemukan.`);

/** Format respons error konsisten: { error: { code, message, details? } } */
export function errorBody(code: ErrorCode, message: string, details?: unknown) {
  return { error: { code, message, ...(details === undefined ? {} : { details }) } };
}

export function parse<T>(schema: ZodType<T>, input: unknown): T {
  const r = schema.safeParse(input);
  if (!r.success) throw validationError(r.error);
  return r.data;
}

function validationError(e: ZodError): AppError {
  const details = e.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
  return new AppError(400, 'VALIDATION_ERROR', 'Data yang dikirim tidak valid.', details);
}

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json(errorBody('NOT_FOUND', 'Endpoint tidak ditemukan.'));
};

export function createErrorHandler(log: boolean): ErrorRequestHandler {
  return (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      res.status(err.status).json(errorBody(err.code, err.message, err.details));
      return;
    }
    if (err instanceof ZodError) {
      const e = validationError(err);
      res.status(e.status).json(errorBody(e.code, e.message, e.details));
      return;
    }
    const e = err as { type?: string; status?: number; code?: string };
    if (e?.type === 'entity.parse.failed') {
      res.status(400).json(errorBody('VALIDATION_ERROR', 'Isi permintaan bukan JSON yang valid.'));
      return;
    }
    if (e?.type === 'entity.too.large') {
      res.status(413).json(errorBody('VALIDATION_ERROR', 'Isi permintaan terlalu besar.'));
      return;
    }
    // Galat database/tak terduga: jangan bocorkan detail ke klien dan jangan log data sensitif.
    const isDb =
      typeof e?.code === 'string' &&
      (e.code.startsWith('ER_') || e.code.startsWith('PROTOCOL_') || e.code === 'ECONNREFUSED' || e.code === 'ETIMEDOUT');
    if (log) console.error('[api-error]', isDb ? `database: ${e.code}` : err instanceof Error ? err.message : 'unknown');
    if (isDb && (e.code === 'ECONNREFUSED' || e.code === 'ETIMEDOUT' || e.code?.startsWith('PROTOCOL_'))) {
      res.status(503).json(errorBody('SERVICE_UNAVAILABLE', 'Layanan sedang tidak tersedia. Coba lagi sebentar lagi.'));
      return;
    }
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Terjadi kesalahan di server. Coba lagi nanti.'));
  };
}
