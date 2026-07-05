import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requireOwner } from '../middleware/authorize';
import { injectRestaurantId } from '../middleware/tenantGuard';
import { tenantStatusGuard } from '../middleware/tenantStatusGuard';
import { getMyRestaurant, updateBranding, updateSettings, getPublicBranding } from '../controllers/restaurant.controller';

const router = Router();

// Public (no auth) — guest portal fetches branding by slug before any token exists
router.get('/public/:slug/branding', getPublicBranding);

router.use(authenticate, requireOwner, injectRestaurantId, tenantStatusGuard);

router.get('/me', getMyRestaurant);
router.patch('/me/branding', updateBranding);
router.patch('/me/settings', updateSettings);

export default router;
