import * as express from 'express';
import { IUser } from '../../core/interface/iuser';

/**
 * Permission enforcement primitives. Resolution (role refs → codes) happens at
 * auth time and lands on `req.user.permissions`; these are pure in-memory checks
 * over that list. Superusers bypass every check (preserves the engine's existing
 * all-or-nothing admin behaviour for superusers).
 */

export function hasPermission(
  actor: IUser | undefined,
  code: string,
): boolean {
  if (actor?.isSuperuser) return true;
  return actor?.permissions?.includes(code) ?? false;
}

/**
 * Express middleware that gates a route on a single permission code. Returns 403
 * when the authenticated principal lacks it. Mounted per route, after
 * `Auth.authenticateGateway` (which resolves `req.user.permissions`).
 */
export function requirePermission(code: string): express.RequestHandler {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (hasPermission(req.user, code)) return next();
    return res.status(403).json({
      success: false,
      error: { code: 'PERMISSION_DENIED', message: `Missing required permission: ${code}` },
    });
  };
}

/**
 * Gates a route on holding AT LEAST ONE of `codes` — for routes shared by an
 * owner-facing and a reviewer-facing permission, where the use case then
 * decides what that caller may actually see.
 */
export function requireAnyPermission(codes: string[]): express.RequestHandler {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (codes.some((code) => hasPermission(req.user, code))) return next();
    return res.status(403).json({
      success: false,
      error: {
        code: 'PERMISSION_DENIED',
        message: `Missing required permission: one of ${codes.join(', ')}`,
      },
    });
  };
}
