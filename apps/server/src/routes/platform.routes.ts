import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requirePlatformAdmin } from '../middleware/authorize';
import {
  listRestaurants,
  getRestaurant,
  createRestaurant,
  blockRestaurant,
  unblockRestaurant,
  updateSubscription,
  platformRevenue,
} from '../controllers/platform.controller';

const router = Router();

router.use(authenticate, requirePlatformAdmin);

router.get('/restaurants', listRestaurants);
router.get('/restaurants/:id', getRestaurant);
router.post('/restaurants', createRestaurant);
router.patch('/restaurants/:id/block', blockRestaurant);
router.patch('/restaurants/:id/unblock', unblockRestaurant);
router.patch('/restaurants/:id/subscription', updateSubscription);
router.get('/revenue', platformRevenue);

export default router;
