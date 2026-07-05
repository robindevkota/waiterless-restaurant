/**
 * Seeds rule-based inventory for the demo tenants: ingredients at realistic
 * Kathmandu market prices (NPR, mid-2026) and per-serving recipe ratios wired
 * onto existing menu items by name.
 *
 * Demo scenarios baked in (Golden Fork):
 *  - Gulab jamun mix stock = 0  → "Gulab Jamun (3 pcs)" auto-86s (OUT)
 *  - Mutton = 0.6 kg            → "Mutton Curry" shows LOW (2 servings, bottleneck)
 *  - Soda water below threshold → LOW alert on the ingredient list
 *
 * Run: npm run seed:inventory (inside apps/server). Idempotent — clears and
 * re-creates inventory data for the listed restaurants only.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import Restaurant from './models/Restaurant';
import MenuItem from './models/MenuItem';
import Ingredient from './models/Ingredient';
import StockLog from './models/StockLog';
import { syncAutoAvailability } from './services/inventory.service';

type Unit = 'kg' | 'g' | 'litre' | 'ml' | 'piece' | 'packet' | 'bottle';
interface IngredientSeed { name: string; unit: Unit; stock: number; costPrice: number; low: number; category?: 'kitchen' | 'bar' | 'general' }
type RecipeSeed = Record<string, [string, number][]>; // menu item name → [ingredient name, qtyPerServing]

// ── Golden Fork (Nepali) ─────────────────────────────────────────────────────

const GF_INGREDIENTS: IngredientSeed[] = [
  { name: 'Chicken keema',       unit: 'kg',     stock: 8,    costPrice: 480,  low: 1 },
  { name: 'Chicken (cuts)',      unit: 'kg',     stock: 10,   costPrice: 420,  low: 1.5 },
  { name: 'Mutton',              unit: 'kg',     stock: 0.6,  costPrice: 1400, low: 1 },      // LOW demo
  { name: 'Paneer',              unit: 'kg',     stock: 3,    costPrice: 850,  low: 0.5 },
  { name: 'Maida (momo flour)',  unit: 'kg',     stock: 12,   costPrice: 90,   low: 2 },
  { name: 'Basmati rice',        unit: 'kg',     stock: 25,   costPrice: 180,  low: 5 },
  { name: 'Musuro dal',          unit: 'kg',     stock: 8,    costPrice: 190,  low: 1.5 },
  { name: 'Cooking oil',         unit: 'litre',  stock: 10,   costPrice: 250,  low: 2 },
  { name: 'Ghee',                unit: 'kg',     stock: 2,    costPrice: 1300, low: 0.4 },
  { name: 'Onion',               unit: 'kg',     stock: 9,    costPrice: 90,   low: 2 },
  { name: 'Tomato',              unit: 'kg',     stock: 7,    costPrice: 80,   low: 1.5 },
  { name: 'Mixed vegetables',    unit: 'kg',     stock: 10,   costPrice: 120,  low: 2 },
  { name: 'Masala (spice mix)',  unit: 'kg',     stock: 1.5,  costPrice: 900,  low: 0.25 },
  { name: 'Milk',                unit: 'litre',  stock: 15,   costPrice: 110,  low: 3 },
  { name: 'Dahi (yogurt)',       unit: 'kg',     stock: 6,    costPrice: 160,  low: 1 },
  { name: 'Sugar',               unit: 'kg',     stock: 8,    costPrice: 105,  low: 1.5 },
  { name: 'Tea leaves',          unit: 'kg',     stock: 1,    costPrice: 600,  low: 0.15 },
  { name: 'Coffee powder',       unit: 'kg',     stock: 0.8,  costPrice: 1800, low: 0.15 },
  { name: 'Lemon',               unit: 'piece',  stock: 40,   costPrice: 15,   low: 10 },
  { name: 'Soda water',          unit: 'bottle', stock: 4,    costPrice: 60,   low: 6, category: 'bar' }, // LOW demo
  { name: 'Butter',              unit: 'kg',     stock: 1.5,  costPrice: 950,  low: 0.3 },
  { name: 'Cream',               unit: 'litre',  stock: 2,    costPrice: 500,  low: 0.4 },
  { name: 'Gulab jamun mix',     unit: 'packet', stock: 0,    costPrice: 250,  low: 1 },      // OUT demo → auto-86
];

const GF_RECIPES: RecipeSeed = {
  'Momo (8 pcs)':           [['Chicken keema', 0.2], ['Maida (momo flour)', 0.15], ['Onion', 0.03], ['Masala (spice mix)', 0.01], ['Cooking oil', 0.01]],
  'Chicken Sekuwa':         [['Chicken (cuts)', 0.25], ['Masala (spice mix)', 0.015], ['Cooking oil', 0.015]],
  'Vegetable Spring Roll':  [['Mixed vegetables', 0.12], ['Maida (momo flour)', 0.08], ['Cooking oil', 0.04]],
  'Dal Bhat Set':           [['Basmati rice', 0.15], ['Musuro dal', 0.06], ['Mixed vegetables', 0.15], ['Ghee', 0.015], ['Masala (spice mix)', 0.01]],
  'Chicken Thali':          [['Basmati rice', 0.15], ['Musuro dal', 0.05], ['Chicken (cuts)', 0.2], ['Mixed vegetables', 0.1], ['Ghee', 0.015], ['Masala (spice mix)', 0.015]],
  'Mutton Curry':           [['Mutton', 0.25], ['Onion', 0.08], ['Tomato', 0.05], ['Cooking oil', 0.03], ['Masala (spice mix)', 0.02]],
  'Paneer Butter Masala':   [['Paneer', 0.18], ['Butter', 0.03], ['Tomato', 0.12], ['Cream', 0.05], ['Masala (spice mix)', 0.012]],
  'Kheer':                  [['Basmati rice', 0.05], ['Milk', 0.35], ['Sugar', 0.04], ['Ghee', 0.005]],
  'Gulab Jamun (3 pcs)':    [['Gulab jamun mix', 0.1], ['Sugar', 0.05]],
  'Lassi':                  [['Dahi (yogurt)', 0.25], ['Sugar', 0.03]],
  'Masala Tea':             [['Milk', 0.12], ['Tea leaves', 0.007], ['Sugar', 0.015]],
  'Fresh Lime Soda':        [['Lemon', 1], ['Soda water', 1], ['Sugar', 0.02]],
  'Cold Coffee':            [['Milk', 0.2], ['Coffee powder', 0.012], ['Sugar', 0.025]],
};

// ── Spice Garden (Western) ───────────────────────────────────────────────────

const SG_INGREDIENTS: IngredientSeed[] = [
  { name: 'Beef patty',       unit: 'piece',  stock: 30,  costPrice: 120, low: 8 },
  { name: 'Chicken patty',    unit: 'piece',  stock: 35,  costPrice: 90,  low: 8 },
  { name: 'Veg patty',        unit: 'piece',  stock: 25,  costPrice: 60,  low: 6 },
  { name: 'Burger bun',       unit: 'piece',  stock: 60,  costPrice: 30,  low: 15 },
  { name: 'Cheese slice',     unit: 'piece',  stock: 50,  costPrice: 35,  low: 12 },
  { name: 'Lettuce',          unit: 'kg',     stock: 3,   costPrice: 180, low: 0.5 },
  { name: 'Tomato',           unit: 'kg',     stock: 5,   costPrice: 80,  low: 1 },
  { name: 'Potato',           unit: 'kg',     stock: 20,  costPrice: 60,  low: 4 },
  { name: 'Spaghetti',        unit: 'kg',     stock: 6,   costPrice: 350, low: 1 },
  { name: 'Penne',            unit: 'kg',     stock: 6,   costPrice: 350, low: 1 },
  { name: 'Beef keema',       unit: 'kg',     stock: 4,   costPrice: 950, low: 0.8 },
  { name: 'Pasta sauce',      unit: 'litre',  stock: 5,   costPrice: 450, low: 1 },
  { name: 'Cooking oil',      unit: 'litre',  stock: 8,   costPrice: 250, low: 1.5 },
  { name: 'Cola can',         unit: 'piece',  stock: 48,  costPrice: 60,  low: 12, category: 'bar' },
  { name: 'Seasonal fruit',   unit: 'kg',     stock: 6,   costPrice: 200, low: 1 },
  { name: 'Milk',             unit: 'litre',  stock: 10,  costPrice: 110, low: 2 },
  { name: 'Ice cream',        unit: 'litre',  stock: 4,   costPrice: 550, low: 1 },
  { name: 'Sugar',            unit: 'kg',     stock: 5,   costPrice: 105, low: 1 },
];

const SG_RECIPES: RecipeSeed = {
  'Classic Beef Burger':    [['Beef patty', 1], ['Burger bun', 1], ['Cheese slice', 1], ['Lettuce', 0.02], ['Tomato', 0.03]],
  'Spicy Chicken Burger':   [['Chicken patty', 1], ['Burger bun', 1], ['Lettuce', 0.02], ['Tomato', 0.03]],
  'Veggie Burger':          [['Veg patty', 1], ['Burger bun', 1], ['Cheese slice', 1], ['Lettuce', 0.02]],
  'Spaghetti Bolognese':    [['Spaghetti', 0.12], ['Beef keema', 0.1], ['Pasta sauce', 0.08], ['Cooking oil', 0.01]],
  'Penne Arrabbiata':       [['Penne', 0.12], ['Pasta sauce', 0.1], ['Cooking oil', 0.01]],
  'Crispy Fries':           [['Potato', 0.25], ['Cooking oil', 0.05]],
  'Garden Salad':           [['Lettuce', 0.1], ['Tomato', 0.08], ['Cooking oil', 0.01]],
  'Coca Cola':              [['Cola can', 1]],
  'Fresh Juice':            [['Seasonal fruit', 0.3], ['Sugar', 0.02]],
  'Milkshake':              [['Milk', 0.25], ['Ice cream', 0.1], ['Sugar', 0.02]],
};

// ── Runner ───────────────────────────────────────────────────────────────────

async function seedTenant(slug: string, ingredients: IngredientSeed[], recipes: RecipeSeed) {
  const restaurant = await Restaurant.findOne({ slug });
  if (!restaurant) { console.log(`- ${slug}: not found, skipping`); return; }
  const rid = restaurant._id;

  await Promise.all([
    Ingredient.deleteMany({ restaurantId: rid }),
    StockLog.deleteMany({ restaurantId: rid }),
    MenuItem.updateMany({ restaurantId: rid }, { $set: { recipe: [], autoUnavailable: false } }),
  ]);

  const created = await Ingredient.insertMany(
    ingredients.map((i) => ({
      restaurantId: rid,
      name: i.name,
      unit: i.unit,
      stock: i.stock,
      costPrice: i.costPrice,
      lowStockThreshold: i.low,
      category: i.category ?? 'kitchen',
    }))
  );
  const byName = new Map(created.map((i) => [i.name, i]));

  await StockLog.insertMany(
    created.filter((i) => i.stock > 0).map((i) => ({
      restaurantId: rid, ingredientId: i._id, type: 'seed', qty: i.stock, stockAfter: i.stock, note: 'Inventory seed',
    }))
  );

  let wired = 0;
  for (const [itemName, lines] of Object.entries(recipes)) {
    const recipe = lines.map(([ingName, qty]) => {
      const ing = byName.get(ingName);
      if (!ing) throw new Error(`${slug}: ingredient "${ingName}" missing for "${itemName}"`);
      return { ingredientId: ing._id, qtyPerServing: qty };
    });
    const updated = await MenuItem.updateOne({ restaurantId: rid, name: itemName, deleted: false }, { $set: { recipe } });
    if (updated.matchedCount) wired++;
    else console.log(`  ! menu item not found: "${itemName}"`);
  }

  const { disabled } = await syncAutoAvailability(rid);
  console.log(`- ${slug}: ${created.length} ingredients, ${wired} recipes wired, auto-86'd: ${disabled.join(', ') || 'none'}`);
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('Connected. Seeding inventory…');
  await seedTenant('golden-fork', GF_INGREDIENTS, GF_RECIPES);
  await seedTenant('spice-garden', SG_INGREDIENTS, SG_RECIPES);
  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((err) => { console.error(err); process.exit(1); });
