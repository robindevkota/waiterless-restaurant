import { Response, NextFunction } from 'express';
import { AuthRequest } from './authenticate';
import { AppError } from './errorHandler';

/**
 * Ensures a staff user can only access their own restaurant's data.
 * platform_admin bypasses this check (they can access all tenants).
 *
 * Reads restaurantId from:
 *   - req.params.restaurantId  (explicit in URL)
 *   - req.body.restaurantId    (in POST body)
 *
 * For routes that work purely on the authenticated user's restaurant
 * (e.g. GET /api/tables — cashier sees their own tables), use
 * injectRestaurantId instead, which sets req.body.restaurantId from the JWT.
 */
export function tenantGuard(req: AuthRequest, _res: Response, next: NextFunction): void {
  if (!req.user) throw new AppError('Not authenticated', 401);

  // Platform admin can access any tenant
  if (req.user.role === 'platform_admin') return next();

  const resourceRestaurantId =
    req.params.restaurantId ||
    req.body?.restaurantId ||
    null;

  if (!resourceRestaurantId) return next(); // no explicit tenant to guard — handled elsewhere

  if (req.user.restaurantId?.toString() !== resourceRestaurantId.toString()) {
    throw new AppError('Access denied', 403);
  }

  next();
}

/**
 * Injects req.restaurantId from the authenticated user's JWT payload.
 * Use this on all tenant-scoped routes so controllers never trust client-supplied restaurantId.
 */
export function injectRestaurantId(req: AuthRequest, _res: Response, next: NextFunction): void {
  // Guest token path
  if (req.guestPayload) {
    (req as any).restaurantId = req.guestPayload.restaurantId;
    return next();
  }
  if (!req.user) throw new AppError('Not authenticated', 401);
  if (req.user.role !== 'platform_admin' && !req.user.restaurantId) {
    throw new AppError('No restaurant associated with this account', 403);
  }
  // Attach as a typed property controllers can read
  (req as any).restaurantId = req.user.restaurantId?.toString() ?? null;
  next();
}
