import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requireOwner } from '../middleware/authorize';
import { injectRestaurantId } from '../middleware/tenantGuard';
import { tenantStatusGuard } from '../middleware/tenantStatusGuard';
import { listStaff, inviteStaff, suspendStaff, removeStaff } from '../controllers/staff.controller';

const router = Router();
router.use(authenticate, requireOwner, injectRestaurantId, tenantStatusGuard);

router.get('/', listStaff);
router.post('/invite', inviteStaff);
router.patch('/:id/suspend', suspendStaff);
router.delete('/:id', removeStaff);

export default router;
