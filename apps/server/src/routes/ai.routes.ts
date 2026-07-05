import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requireOwner } from '../middleware/authorize';
import { injectRestaurantId } from '../middleware/tenantGuard';
import { tenantStatusGuard } from '../middleware/tenantStatusGuard';
import { generateReport, listReports, getReport, chat } from '../controllers/ai.controller';

const router = Router();
router.use(authenticate, requireOwner, injectRestaurantId, tenantStatusGuard);

router.post('/chat', chat);
router.post('/reports', generateReport);
router.get('/reports', listReports);
router.get('/reports/:id', getReport);

export default router;
