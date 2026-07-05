import { Router } from 'express';
import { authenticate, authenticateAny } from '../middleware/authenticate';
import { requireOwner } from '../middleware/authorize';
import { injectRestaurantId } from '../middleware/tenantGuard';
import { tenantStatusGuard } from '../middleware/tenantStatusGuard';
import {
  listCategories, createCategory, updateCategory, deleteCategory,
  listItems, createItem, updateItem, deleteItem, toggleAvailability,
} from '../controllers/menu.controller';

const router = Router();

// Read routes accept both staff and guest tokens
const anyRead = [authenticateAny, injectRestaurantId, tenantStatusGuard];
const ownerWrite = [authenticate, requireOwner, injectRestaurantId, tenantStatusGuard];

router.get('/categories', ...anyRead, listCategories);
router.post('/categories', ...ownerWrite, createCategory);
router.patch('/categories/:id', ...ownerWrite, updateCategory);
router.delete('/categories/:id', ...ownerWrite, deleteCategory);

router.get('/items', ...anyRead, listItems);
router.post('/items', ...ownerWrite, createItem);
router.patch('/items/:id', ...ownerWrite, updateItem);
router.delete('/items/:id', ...ownerWrite, deleteItem);
router.patch('/items/:id/availability', ...ownerWrite, toggleAvailability);

export default router;
