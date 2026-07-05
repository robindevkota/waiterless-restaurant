import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/authenticate';
import { AppError } from '../middleware/errorHandler';
import Ingredient from '../models/Ingredient';
import MenuItem from '../models/MenuItem';
import StockLog from '../models/StockLog';
import { getInventoryOverview, getPrepForecast, restockIngredient, stocktakeIngredient, syncAutoAvailability } from '../services/inventory.service';

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

// GET /api/inventory/prep — tomorrow's prep list (kitchen + owner)
export async function prepForecast(req: AuthRequest, res: Response): Promise<void> {
  const data = await getPrepForecast(rid(req));
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

// POST /api/inventory/ingredients/:id/stocktake — physical count wins
export async function stocktake(req: AuthRequest, res: Response): Promise<void> {
  const countedQty = Number(req.body.countedQty);
  if (!Number.isFinite(countedQty) || countedQty < 0) throw new AppError('countedQty must be a number >= 0', 400);
  const result = await stocktakeIngredient(
    rid(req), req.params.id, countedQty, req.user?._id as mongoose.Types.ObjectId, req.body.note
  );
  res.json({ success: true, ...result });
}

// POST /api/inventory/ingredients/import — bulk rows pasted from Excel/CSV.
// Upserts by name: existing ingredients get fields updated + a stocktake to
// the imported qty; new ones are created.
export async function importIngredients(req: AuthRequest, res: Response): Promise<void> {
  const { rows } = req.body as { rows: unknown };
  if (!Array.isArray(rows) || rows.length === 0) throw new AppError('rows array is required', 400);
  if (rows.length > 200) throw new AppError('Max 200 rows per import', 400);

  let created = 0;
  let updated = 0;
  const errors: { row: number; message: string }[] = [];

  for (let idx = 0; idx < rows.length; idx++) {
    const r = rows[idx] as Record<string, unknown>;
    try {
      const name = String(r.name ?? '').trim();
      const unit = String(r.unit ?? '').trim().toLowerCase();
      const stock = r.stock === undefined || r.stock === '' ? undefined : Number(r.stock);
      const costPrice = Number(r.costPrice);
      const lowStockThreshold = r.lowStockThreshold === undefined || r.lowStockThreshold === '' ? 0 : Number(r.lowStockThreshold);
      const category = r.category ? String(r.category).trim().toLowerCase() : 'kitchen';

      if (!name) throw new Error('name is required');
      if (!UNITS.includes(unit)) throw new Error(`unit must be one of: ${UNITS.join(', ')}`);
      if (!Number.isFinite(costPrice) || costPrice < 0) throw new Error('costPrice must be a number >= 0');
      if (stock !== undefined && (!Number.isFinite(stock) || stock < 0)) throw new Error('stock must be >= 0');
      if (!CATEGORIES.includes(category)) throw new Error(`category must be one of: ${CATEGORIES.join(', ')}`);
      if (!Number.isFinite(lowStockThreshold) || lowStockThreshold < 0) throw new Error('lowStockThreshold must be >= 0');

      const existing = await Ingredient.findOne({ restaurantId: rid(req), name });
      if (existing) {
        existing.set({ unit, costPrice, lowStockThreshold, category, isActive: true });
        await existing.save();
        if (stock !== undefined && stock !== existing.stock) {
          await stocktakeIngredient(rid(req), String(existing._id), stock, req.user?._id as mongoose.Types.ObjectId, 'CSV import');
        }
        updated++;
      } else {
        const ing = await Ingredient.create({
          restaurantId: rid(req), name, unit, stock: stock ?? 0, costPrice, lowStockThreshold, category,
        });
        if ((stock ?? 0) > 0) {
          await StockLog.create({
            restaurantId: rid(req), ingredientId: ing._id,
            type: 'adjustment', qty: stock, stockAfter: stock, byUser: req.user?._id, note: 'CSV import',
          });
        }
        created++;
      }
    } catch (e) {
      errors.push({ row: idx + 1, message: e instanceof Error ? e.message : 'Invalid row' });
    }
  }

  await syncAutoAvailability(rid(req));
  res.json({ success: true, created, updated, errors });
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
