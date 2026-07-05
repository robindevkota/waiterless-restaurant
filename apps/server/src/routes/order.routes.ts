import { Router } from 'express';
import { authenticate, authenticateGuest } from '../middleware/authenticate';
import { requireKitchen, requireCashier } from '../middleware/authorize';
import { injectRestaurantId } from '../middleware/tenantGuard';
import { tenantStatusGuard } from '../middleware/tenantStatusGuard';
import {
  placeOrder, myOrders, activeOrders, sessionOrders, updateItemStatus,
} from '../controllers/order.controller';

const router = Router();

// Guest places order
router.post('/', authenticateGuest, tenantStatusGuard, placeOrder);

// Guest views their orders
router.get('/my', authenticateGuest, tenantStatusGuard, myOrders);

// Kitchen views active orders
router.get('/active', authenticate, requireKitchen, injectRestaurantId, tenantStatusGuard, activeOrders);

// Cashier/owner views all orders in a session
router.get('/session/:sessionId', authenticate, requireCashier, injectRestaurantId, tenantStatusGuard, sessionOrders);

// Kitchen updates item status
router.patch('/:id/items/:itemId', authenticate, requireKitchen, injectRestaurantId, tenantStatusGuard, updateItemStatus);

export default router;
