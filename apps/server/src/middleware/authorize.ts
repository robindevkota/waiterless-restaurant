import { Response, NextFunction } from 'express';
import { AuthRequest } from './authenticate';
import { AppError } from './errorHandler';
import type { UserRole } from '@waiterless/types';

/**
 * Role guard for staff routes.
 * Usage: router.get('/route', authenticate, authorize('owner', 'cashier'), handler)
 */
export function authorize(...roles: UserRole[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) throw new AppError('Not authenticated', 401);
    if (!roles.includes(req.user.role)) {
      throw new AppError('Insufficient permissions', 403);
    }
    next();
  };
}

// Convenience shorthands
export const requirePlatformAdmin = authorize('platform_admin');
export const requireOwner         = authorize('owner', 'platform_admin');
export const requireCashier       = authorize('cashier', 'owner', 'platform_admin');
export const requireKitchen       = authorize('kitchen', 'owner', 'platform_admin');
