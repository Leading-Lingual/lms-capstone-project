import type { RequestHandler } from 'express';
import type { Role } from '../generated/prisma/client.js';
import { AppError } from '../lib/errors.js';
export function authorize(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.actor || !roles.includes(req.actor.role))
      throw new AppError(403, 'FORBIDDEN', 'You do not have permission for this action.');
    next();
  };
}
