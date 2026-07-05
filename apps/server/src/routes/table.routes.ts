import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requireOwner, requireCashier } from '../middleware/authorize';
import { injectRestaurantId } from '../middleware/tenantGuard';
import { tenantStatusGuard } from '../middleware/tenantStatusGuard';
import {
  listTables, createTable, updateTable, deleteTable, getTableQr, regenerateQr,
} from '../controllers/table.controller';

const router = Router();

const staffAccess = [authenticate, requireCashier, injectRestaurantId, tenantStatusGuard];
const ownerAccess = [authenticate, requireOwner, injectRestaurantId, tenantStatusGuard];

router.get('/', ...staffAccess, listTables);
router.post('/', ...ownerAccess, createTable);
router.patch('/:id', ...ownerAccess, updateTable);
router.delete('/:id', ...ownerAccess, deleteTable);
router.get('/:id/qr', ...ownerAccess, getTableQr);
router.post('/:id/qr/regenerate', ...ownerAccess, regenerateQr);

export default router;
