import { Response, NextFunction } from 'express';
import { AuthRequest } from './authenticate';
import { AppError } from './errorHandler';
import Restaurant from '../models/Restaurant';

// In-memory cache: restaurantId → { status, cachedAt }
// Avoids a DB hit on every single request while still reflecting blocks within ~30s
const statusCache = new Map<string, { status: string; cachedAt: number }>();
const CACHE_TTL_MS = 30_000; // 30 seconds

async function getRestaurantStatus(restaurantId: string): Promise<string> {
  const cached = statusCache.get(restaurantId);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.status;
  }

  const restaurant = await Restaurant.findById(restaurantId).select('subscription.status').lean();
  if (!restaurant) throw new AppError('Restaurant not found', 404);

  const status = restaurant.subscription.status;
  statusCache.set(restaurantId, { status, cachedAt: Date.now() });
  return status;
}

/**
 * Blocks all requests (staff AND guests) if the restaurant subscription is 'blocked'.
 * 'past_due' is a warning state — access still allowed but owner should see a banner.
 *
 * Platform admin is exempt — they need access to manage blocked restaurants.
 */
export function tenantStatusGuard(req: AuthRequest, _res: Response, next: NextFunction): void {
  if (!req.user && !req.guestPayload) throw new AppError('Not authenticated', 401);

  // Platform admin bypasses status check
  if (req.user?.role === 'platform_admin') return next();

  const restaurantId =
    req.user?.restaurantId?.toString() ??
    req.guestPayload?.restaurantId ??
    null;

  if (!restaurantId) return next();

  getRestaurantStatus(restaurantId)
    .then((status) => {
      if (status === 'blocked') {
        throw new AppError(
          'This restaurant account is currently suspended. Please contact support.',
          403
        );
      }
      // Attach status so controllers can show a past_due warning banner if needed
      (req as any).subscriptionStatus = status;
      next();
    })
    .catch(next);
}

/** Call this to immediately evict a restaurant from the cache (e.g. after admin blocks it). */
export function evictStatusCache(restaurantId: string): void {
  statusCache.delete(restaurantId);
}
