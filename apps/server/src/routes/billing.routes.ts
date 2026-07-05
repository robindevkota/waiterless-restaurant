import { Router } from 'express';
import { authenticate, authenticateGuest } from '../middleware/authenticate';
import { requireCashier } from '../middleware/authorize';
import { injectRestaurantId } from '../middleware/tenantGuard';
import { tenantStatusGuard } from '../middleware/tenantStatusGuard';
import { getBill, myBill } from '../controllers/billing.controller';

const router = Router();

// Guest views running bill
router.get('/my', authenticateGuest, tenantStatusGuard, myBill);

// Cashier/owner views bill for a session
router.get('/session/:sessionId', authenticate, requireCashier, injectRestaurantId, tenantStatusGuard, getBill);

export default router;
