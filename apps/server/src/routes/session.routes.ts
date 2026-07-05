import { Router } from 'express';
import { authenticate, authenticateGuest } from '../middleware/authenticate';
import { requireCashier } from '../middleware/authorize';
import { injectRestaurantId } from '../middleware/tenantGuard';
import { tenantStatusGuard } from '../middleware/tenantStatusGuard';
import {
  openSession,
  listActiveSessions,
  getSession,
  closeSession,
  callWaiter,
  claimPaid,
  clearPaidClaim,
  submitFeedback,
  attendTable,
} from '../controllers/session.controller';

const router = Router();

// Guest routes (QR token) — must be registered before the staff middleware
router.post('/my/call-waiter', authenticateGuest, tenantStatusGuard, callWaiter);
router.post('/my/claim-paid', authenticateGuest, tenantStatusGuard, claimPaid);
router.post('/my/feedback', authenticateGuest, tenantStatusGuard, submitFeedback);

// Staff routes
router.use(authenticate, requireCashier, injectRestaurantId, tenantStatusGuard);

router.post('/', openSession);
router.get('/active', listActiveSessions);
router.get('/:id', getSession);
router.post('/:id/close', closeSession);
router.post('/:id/attend', attendTable);
router.post('/:id/clear-paid-claim', clearPaidClaim);

export default router;
