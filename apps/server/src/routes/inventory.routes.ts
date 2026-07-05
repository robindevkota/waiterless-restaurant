import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requireOwner, requireKitchen } from '../middleware/authorize';
import { injectRestaurantId } from '../middleware/tenantGuard';
import { tenantStatusGuard } from '../middleware/tenantStatusGuard';
import {
  overview,
  prepForecast,
  createIngredient,
  updateIngredient,
  deleteIngredient,
  restock,
  stocktake,
  importIngredients,
  setRecipe,
  logs,
} from '../controllers/inventory.controller';

const router = Router();

// Prep list is read-only and the kitchen needs it — registered before the
// owner-only gate below.
router.get('/prep', authenticate, requireKitchen, injectRestaurantId, tenantStatusGuard, prepForecast);

router.use(authenticate, requireOwner, injectRestaurantId, tenantStatusGuard);

router.get('/overview', overview);
router.get('/logs', logs);
router.post('/ingredients', createIngredient);
router.put('/ingredients/:id', updateIngredient);
router.delete('/ingredients/:id', deleteIngredient);
router.post('/ingredients/import', importIngredients);
router.post('/ingredients/:id/restock', restock);
router.post('/ingredients/:id/stocktake', stocktake);
router.put('/recipes/:menuItemId', setRecipe);

export default router;
