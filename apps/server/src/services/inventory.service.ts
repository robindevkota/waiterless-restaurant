/**
 * Rule-based inventory — ported (lighter) from the Royal Suites spec.
 * Pure arithmetic, no AI: servings = floor(stock ÷ qtyPerServing).
 *
 * Waiterless adaptations vs the hotel version:
 *  - multi-tenant: everything scoped by restaurantId
 *  - recipes live ON MenuItems (no parallel catalog, no manual "Sell" button)
 *  - stock deducts automatically when a guest order is placed
 *  - auto-86: servings hit 0 → MenuItem.available=false (autoUnavailable flag so
 *    a restock can re-enable it without clobbering manual owner toggles)
 */
import mongoose from 'mongoose';
import Ingredient, { IIngredient } from '../models/Ingredient';
import MenuItem from '../models/MenuItem';
import StockLog from '../models/StockLog';
import { AppError } from '../middleware/errorHandler';

export interface ServingsResult {
  servingsPossible: number | null;  // null = untracked (no recipe)
  limitingIngredient: string | null;
  status: 'ok' | 'low' | 'out' | 'untracked';
  cogsPerServing: number;           // NPR cost of goods per serving
}

const LOW_SERVINGS = 5;

function computeForRecipe(
  recipe: { ingredientId: mongoose.Types.ObjectId | string; qtyPerServing: number }[],
  ingredientMap: Map<string, Pick<IIngredient, 'name' | 'stock' | 'costPrice'>>
): ServingsResult {
  if (!recipe?.length) {
    return { servingsPossible: null, limitingIngredient: null, status: 'untracked', cogsPerServing: 0 };
  }

  let minServings = Infinity;
  let limitingIngredient: string | null = null;
  let cogsPerServing = 0;

  for (const line of recipe) {
    const ing = ingredientMap.get(String(line.ingredientId));
    if (!ing || line.qtyPerServing <= 0) continue;
    const possible = Math.floor(ing.stock / line.qtyPerServing);
    if (possible < minServings) {
      minServings = possible;
      limitingIngredient = ing.name;
    }
    cogsPerServing += line.qtyPerServing * ing.costPrice;
  }

  if (minServings === Infinity) {
    return { servingsPossible: null, limitingIngredient: null, status: 'untracked', cogsPerServing: 0 };
  }

  const status = minServings === 0 ? 'out' : minServings <= LOW_SERVINGS ? 'low' : 'ok';
  return {
    servingsPossible: minServings,
    limitingIngredient,
    status,
    cogsPerServing: Math.round(cogsPerServing * 100) / 100,
  };
}

async function loadIngredientMap(restaurantId: mongoose.Types.ObjectId | string) {
  const ingredients = await Ingredient.find({ restaurantId, isActive: true }).lean();
  return new Map(ingredients.map((i) => [String(i._id), i]));
}

// ── Overview: every tracked menu item + all stock levels ────────────────────

export async function getInventoryOverview(restaurantId: mongoose.Types.ObjectId | string) {
  const [ingredientMap, menuItems] = await Promise.all([
    loadIngredientMap(restaurantId),
    MenuItem.find({ restaurantId, deleted: false }).select('name price recipe available autoUnavailable').lean(),
  ]);

  const items = menuItems.map((mi) => {
    const r = computeForRecipe(mi.recipe as any[], ingredientMap);
    return {
      menuItemId: String(mi._id),
      name: mi.name,
      price: mi.price,
      available: mi.available,
      autoUnavailable: mi.autoUnavailable ?? false,
      ...r,
      profitPerServing: r.status === 'untracked' ? null : Math.round((mi.price - r.cogsPerServing) * 100) / 100,
    };
  });

  const ingredients = Array.from(ingredientMap.values()).map((i) => {
    const status = i.stock === 0 ? 'out' : i.stock <= i.lowStockThreshold ? 'low' : 'ok';
    const maxBar = i.lowStockThreshold * 3 || 1;
    return {
      _id: String(i._id),
      name: i.name,
      unit: i.unit,
      stock: Math.round(i.stock * 1000) / 1000, // hide float drift from repeated $inc
      costPrice: i.costPrice,
      lowStockThreshold: i.lowStockThreshold,
      category: i.category,
      status,
      pct: Math.min(100, Math.round((i.stock / maxBar) * 100)),
    };
  });

  return {
    items,
    ingredients,
    counts: {
      totalIngredients: ingredients.length,
      lowStock: ingredients.filter((i) => i.status === 'low').length,
      outOfStock: ingredients.filter((i) => i.status === 'out').length,
      tracked: items.filter((i) => i.status !== 'untracked').length,
      auto86: items.filter((i) => i.autoUnavailable).length,
    },
  };
}

// ── Auto-86 sync: flip availability from current stock levels ───────────────

export async function syncAutoAvailability(restaurantId: mongoose.Types.ObjectId | string): Promise<{ disabled: string[]; restored: string[] }> {
  const [ingredientMap, tracked] = await Promise.all([
    loadIngredientMap(restaurantId),
    MenuItem.find({ restaurantId, deleted: false, 'recipe.0': { $exists: true } })
      .select('name recipe available autoUnavailable'),
  ]);

  const disabled: string[] = [];
  const restored: string[] = [];

  for (const mi of tracked) {
    const { servingsPossible } = computeForRecipe(mi.recipe as any[], ingredientMap);
    if (servingsPossible === 0 && mi.available) {
      mi.available = false;
      mi.autoUnavailable = true;
      await mi.save();
      disabled.push(mi.name);
    } else if ((servingsPossible ?? 0) > 0 && !mi.available && mi.autoUnavailable) {
      // only restore items WE disabled — never override a manual owner toggle
      mi.available = true;
      mi.autoUnavailable = false;
      await mi.save();
      restored.push(mi.name);
    }
  }

  return { disabled, restored };
}

// ── Deduct stock for a placed order ──────────────────────────────────────────
// Called from placeOrder AFTER items are validated. Verifies sufficient stock
// for all tracked items first (so guests get a clear error), then deducts with
// per-ingredient atomic guards and logs every movement.

export async function deductForOrder(
  restaurantId: mongoose.Types.ObjectId | string,
  orderItems: { menuItemId: mongoose.Types.ObjectId; name: string; qty: number }[],
  orderId?: mongoose.Types.ObjectId
): Promise<void> {
  const menuItems = await MenuItem.find({
    _id: { $in: orderItems.map((i) => i.menuItemId) },
    restaurantId,
  }).select('name recipe').lean();
  const byId = new Map(menuItems.map((m) => [String(m._id), m]));

  // Aggregate required qty per ingredient across the whole order
  const required = new Map<string, number>();
  for (const item of orderItems) {
    const mi = byId.get(String(item.menuItemId));
    if (!mi?.recipe?.length) continue; // untracked items pass through
    for (const line of mi.recipe as any[]) {
      const key = String(line.ingredientId);
      required.set(key, (required.get(key) ?? 0) + line.qtyPerServing * item.qty);
    }
  }
  if (required.size === 0) return;

  // Pre-check stock so the guest gets a friendly message naming the dish
  const ingredients = await Ingredient.find({ _id: { $in: Array.from(required.keys()) }, restaurantId }).lean();
  const stockById = new Map(ingredients.map((i) => [String(i._id), i]));
  for (const [ingId, qty] of required) {
    const ing = stockById.get(ingId);
    if (!ing || ing.stock < qty) {
      const shortDish = orderItems.find((it) => {
        const mi = byId.get(String(it.menuItemId));
        return mi?.recipe?.some((l: any) => String(l.ingredientId) === ingId);
      });
      throw new AppError(
        `Sorry, "${shortDish?.name ?? 'an item'}" just sold out${ing ? ` (not enough ${ing.name})` : ''}. Please remove it and try again.`,
        409
      );
    }
  }

  // Deduct with atomic per-ingredient guards (stock can never go below zero)
  for (const [ingId, qty] of required) {
    const updated = await Ingredient.findOneAndUpdate(
      { _id: ingId, restaurantId, stock: { $gte: qty } },
      { $inc: { stock: -qty } },
      { new: true }
    );
    if (!updated) {
      // Raced with a concurrent order between pre-check and deduct — very rare.
      // Roll back what we already deducted in this loop and reject.
      for (const [doneId, doneQty] of required) {
        if (doneId === ingId) break;
        await Ingredient.updateOne({ _id: doneId }, { $inc: { stock: doneQty } });
      }
      throw new AppError('An item in your order just sold out. Please try again.', 409);
    }
    await StockLog.create({
      restaurantId,
      ingredientId: ingId,
      type: 'sale',
      qty: -qty,
      stockAfter: updated.stock,
      orderId,
    });
  }

  // Flip menu availability where stock ran dry (and restore is handled on restock)
  await syncAutoAvailability(restaurantId);
}

// ── Restock ──────────────────────────────────────────────────────────────────

export async function restockIngredient(
  restaurantId: mongoose.Types.ObjectId | string,
  ingredientId: string,
  qty: number,
  userId?: mongoose.Types.ObjectId,
  note?: string
) {
  if (!(qty > 0)) throw new AppError('qty must be > 0', 400);
  const updated = await Ingredient.findOneAndUpdate(
    { _id: ingredientId, restaurantId, isActive: true },
    { $inc: { stock: qty } },
    { new: true }
  );
  if (!updated) throw new AppError('Ingredient not found', 404);

  await StockLog.create({
    restaurantId,
    ingredientId,
    type: 'restock',
    qty,
    stockAfter: updated.stock,
    byUser: userId,
    note,
  });

  const { restored } = await syncAutoAvailability(restaurantId);
  return { ingredient: updated, restoredItems: restored };
}
