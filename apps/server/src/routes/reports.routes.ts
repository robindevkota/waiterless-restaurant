import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requireOwner } from '../middleware/authorize';
import { injectRestaurantId } from '../middleware/tenantGuard';
import { tenantStatusGuard } from '../middleware/tenantStatusGuard';
import { revenueReport, sessionHistory, topItems, peakHours, overview } from '../controllers/reports.controller';

const router = Router();
router.use(authenticate, requireOwner, injectRestaurantId, tenantStatusGuard);

router.get('/overview', overview);
router.get('/revenue', revenueReport);
router.get('/sessions', sessionHistory);
router.get('/top-items', topItems);
router.get('/peak-hours', peakHours);

export default router;
