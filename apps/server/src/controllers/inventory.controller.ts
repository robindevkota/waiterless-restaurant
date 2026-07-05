import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/authenticate';
import { AppError } from '../middleware/errorHandler';
import Ingredient from '../models/Ingredient';
import MenuItem from '../models/MenuItem';
import StockLog from '../models/StockLog';
import { getInventoryOverview, restockIngredient, syncAutoAvailability } from '../services/inventory.service';

const UNITS = ['kg', 'g', 'litre', 'ml', 'piece', 'packet', 'bottle'];
const CATEGORIES = ['kitchen', 'bar', 'general'];

function rid(req: AuthRequest): string {
  return (req as any).restaurantId as string;
}

// GET /api/inventory/overview
export async function overview(req: AuthRequest, res: Response): Promise<void> {
  const data = await getInventoryOverview(rid(req));
  res.json({ success: true, ...data });
}

// POST /api/inventory/ingredients
export async function createIngredient(req: AuthRequest, res: Response): Promise<void> {
  const { name, unit, stock = 0, costPrice, lowStockThreshold = 0, category = 'kitchen' } = req.body;
  if (!name || typeof name !== 'string') throw new AppError('name is required', 400);
  if (!UNITS.includes(unit)) throw new AppError(`unit must be one of: ${UNITS.join(', ')}`, 400);
  if (!CATEGORIES.includes(category)) throw new AppError(`category must be one of: ${CATEGORIES.join(', ')}`, 400);
  if (typeof costPrice !== 'number' || costPrice < 0) throw new AppError('costPrice must be a number >= 0', 400);
  if (typeof stock !== 'number' || stock < 0) throw new AppError('stock must be >= 0', 400);

  const existing = await Ingredient.findOne({ restaurantId: rid(req), name: name.trim() });
  if (existing) {
    if (existing.isActive) throw new AppError('An ingredient with this name already exists', 409);
    // reactivate a previously deleted ingredient under the same name
    existing.set({ unit, stock, costPrice, lowStockThreshold, category, isActive: true });
    await existing.save();
    res.status(201).json({ success: true, ingredient: existing });
    return;
  }

  const ingredient = await Ingredient.create({
    restaurantId: rid(req),
    name: name.trim(),
    unit, stock, costPrice, lowStockThreshold, category,
  });
  if (stock > 0) {
    await StockLog.create({
      restaurantId: rid(req), ingredientId: ingredient._id,
      type: 'adjustment', qty: stock, stockAfter: stock, byUser: req.user?._id, note: 'Initial stock',
    });
  }
  res.status(201).json({ success: true, ingredient });
}

// PUT /api/inventory/ingredients/:id
export async function updateIngredient(req: AuthRequest, res: Response): Promise<void> {
  const allowed = ['name', 'unit', 'costPrice', 'lowStockThreshold', 'category'] as const;
  const update: Record<string, unknown> = {};
  for (const k of allowed) if (req.body[k] !== undefined) update[k] = req.body[k];
  if (update.unit !== undefined && !UNITS.includes(update.unit as string)) throw new AppError('Invalid unit', 400);
  if (update.category !== undefined && !CATEGORIES.includes(update.category as string)) throw new AppError('Invalid category', 400);

  const ingredient = await Ingredient.findOneAndUpdate(
    { _id: req.params.id, restaurantId: rid(req), isActive: true },
    { $set: update },
    { new: true, runValidators: true }
  );
  if (!ingredient) throw new AppError('Ingredient not found', 404);
  res.json({ success: true, ingredient });
}

// DELETE /api/inventory/ingredients/:id — soft delete
export async function deleteIngredient(req: AuthRequest, res: Response): Promise<void> {
  const ingredient = await Ingredient.findOneAndUpdate(
    { _id: req.params.id, restaurantId: rid(req) },
    { $set: { isActive: false } },
    { new: true }
  );
  if (!ingredient) throw new AppError('Ingredient not found', 404);
  // Remove it from any recipes so servings math stays truthful
  await MenuItem.updateMany(
    { restaurantId: rid(req) },
    { $pull: { recipe: { ingredientId: ingredient._id } } }
  );
  await syncAutoAvailability(rid(req));
  res.json({ success: true });
}

// POST /api/inventory/ingredients/:id/restock
export async function restock(req: AuthRequest, res: Response): Promise<void> {
  const qty = Number(req.body.qty);
  if (!Number.isFinite(qty) || qty <= 0) throw new AppError('qty must be a positive number', 400);
  const { ingredient, restoredItems } = await restockIngredient(
    rid(req), req.params.id, qty, req.user?._id as mongoose.Types.ObjectId, req.body.note
  );
  res.json({ success: true, ingredient, restoredItems });
}

// PUT /api/inventory/recipes/:menuItemId — set recipe lines for a menu item
export async function setRecipe(req: AuthRequest, res: Response): Promise<void> {
  const { lines } = req.body; // [{ ingredientId, qtyPerServing }]
  if (!Array.isArray(lines)) throw new AppError('lines array is required (empty array clears the recipe)', 400);
  if (lines.length > 20) throw new AppError('A recipe can have at most 20 ingredients', 400);

  for (const line of lines) {
    if (!mongoose.isValidObjectId(line?.ingredientId)) throw new AppError('Each line needs a valid ingredientId', 400);
    if (typeof line.qtyPerServing !== 'number' || line.qtyPerServing <= 0) {
      throw new AppError('Each line needs qtyPerServing > 0', 400);
    }
  }

  // All referenced ingredients must belong to this restaurant
  const ids = lines.map((l: any) => l.ingredientId);
  const count = await Ingredient.countDocuments({ _id: { $in: ids }, restaurantId: rid(req), isActive: true });
  if (count !== new Set(ids.map(String)).size) throw new AppError('One or more ingredients not found', 404);

  const menuItem = await MenuItem.findOneAndUpdate(
    { _id: req.params.menuItemId, restaurantId: rid(req), deleted: false },
    { $set: { recipe: lines.map((l: any) => ({ ingredientId: l.ingredientId, qtyPerServing: l.qtyPerServing })) } },
    { new: true }
  );
  if (!menuItem) throw new AppError('Menu item not found', 404);

  await syncAutoAvailability(rid(req));
  res.json({ success: true, menuItem });
}

// GET /api/inventory/logs?page=1&limit=20
export async function logs(req: AuthRequest, res: Response): Promise<void> {
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const page = Math.max(parseInt(req.query.page as string) || 1, 1);
  const [entries, total] = await Promise.all([
    StockLog.find({ restaurantId: rid(req) })
      .populate('ingredientId', 'name unit')
      .populate('byUser', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    StockLog.countDocuments({ restaurantId: rid(req) }),
  ]);
  res.json({ success: true, logs: entries, total, page, pages: Math.ceil(total / limit) });
}
