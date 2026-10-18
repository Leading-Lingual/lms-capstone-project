import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '../generated/prisma/client.js';
import { AppError } from '../lib/errors.js';
export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, _next) => {
  let status = 500,
    code = 'INTERNAL_ERROR',
    message = 'An unexpected error occurred.';
  let fields: unknown;
  if (error instanceof AppError) ({ status, code, message } = error);
  else if (error instanceof ZodError) {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'Check the submitted fields.';
    fields = error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));
  } else if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    ['P2002', 'P2003', 'P2025'].includes(error.code)
  ) {
    status = error.code === 'P2025' ? 404 : 409;
    code = status === 404 ? 'NOT_FOUND' : 'CONFLICT';
    message = 'The requested operation could not be completed.';
  } else if (error instanceof SyntaxError && 'status' in error && error.status === 400) {
    status = 400;
    code = 'INVALID_JSON';
    message = 'The request body is not valid JSON.';
  } else if (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    error.status === 413
  ) {
    status = 413;
    code = 'REQUEST_TOO_LARGE';
    message = 'The request body exceeds the allowed size.';
  }
  if (status === 500) req.log.error({ code, requestId: req.requestId }, 'Request failed');
  res.status(status).json({
    error: { code, message, ...(fields ? { fields } : {}) },
    meta: { requestId: req.requestId },
  });
};
