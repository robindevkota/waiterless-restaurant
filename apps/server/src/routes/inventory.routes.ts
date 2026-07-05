import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requireOwner } from '../middleware/authorize';
import { injectRestaurantId } from '../middleware/tenantGuard';
import { tenantStatusGuard } from '../middleware/tenantStatusGuard';
import {
  overview,
  createIngredient,
  updateIngredient,
  deleteIngredient,
  restock,
  setRecipe,
  logs,
} from '../controllers/inventory.controller';

const router = Router();
router.use(authenticate, requireOwner, injectRestaurantId, tenantStatusGuard);

router.get('/overview', overview);
router.get('/logs', logs);
router.post('/ingredients', createIngredient);
router.put('/ingredients/:id', updateIngredient);
router.delete('/ingredients/:id', deleteIngredient);
router.post('/ingredients/:id/restock', restock);
router.put('/recipes/:menuItemId', setRecipe);

export default router;
