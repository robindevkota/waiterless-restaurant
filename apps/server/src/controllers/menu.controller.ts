import { Response } from 'express';
import { AuthRequest } from '../middleware/authenticate';
import MenuCategory from '../models/MenuCategory';
import MenuItem from '../models/MenuItem';
import Restaurant from '../models/Restaurant';
import { AppError } from '../middleware/errorHandler';
import { assertPlanLimit } from '../utils/planLimits';

// ── Categories ────────────────────────────────────────────────────────────────

export async function listCategories(req: AuthRequest, res: Response): Promise<void> {
  const rid = (req as any).restaurantId;
  const categories = await MenuCategory.find({ restaurantId: rid }).sort({ sortOrder: 1 }).lean();
  res.json({ success: true, categories });
}

export async function createCategory(req: AuthRequest, res: Response): Promise<void> {
  const rid = (req as any).restaurantId;
  const { name, sortOrder, icon } = req.body;
  if (!name) throw new AppError('Category name is required', 400);

  const category = await MenuCategory.create({ restaurantId: rid, name, sortOrder, icon });
  res.status(201).json({ success: true, category });
}

export async function updateCategory(req: AuthRequest, res: Response): Promise<void> {
  const rid = (req as any).restaurantId;
  const category = await MenuCategory.findOneAndUpdate(
    { _id: req.params.id, restaurantId: rid },
    { $set: req.body },
    { new: true }
  );
  if (!category) throw new AppError('Category not found', 404);
  res.json({ success: true, category });
}

export async function deleteCategory(req: AuthRequest, res: Response): Promise<void> {
  const rid = (req as any).restaurantId;
  const hasItems = await MenuItem.exists({ categoryId: req.params.id, restaurantId: rid, deleted: false });
  if (hasItems) throw new AppError('Remove all items from this category before deleting it', 400);
  const category = await MenuCategory.findOneAndDelete({ _id: req.params.id, restaurantId: rid });
  if (!category) throw new AppError('Category not found', 404);
  res.json({ success: true, message: 'Category deleted' });
}

// ── Items ─────────────────────────────────────────────────────────────────────

export async function listItems(req: AuthRequest, res: Response): Promise<void> {
  const rid = (req as any).restaurantId;
  // Guests only see orderable items (auto-86'd / manually disabled ones are hidden);
  // staff see everything so they can manage availability.
  const filter: Record<string, unknown> = { restaurantId: rid, deleted: false };
  if (req.guestPayload) filter.available = true;
  const items = await MenuItem.find(filter)
    .populate('categoryId', 'name')
    .sort({ sortOrder: 1 })
    .lean();
  res.json({ success: true, items });
}

export async function createItem(req: AuthRequest, res: Response): Promise<void> {
  const rid = (req as any).restaurantId;
  const { name, description, price, categoryId, imageUrl, tags, preparationTime, sortOrder } = req.body;
  if (!name || price === undefined || !categoryId) {
    throw new AppError('name, price and categoryId are required', 400);
  }

  const restaurant = await Restaurant.findById(rid).select('subscription').lean();
  if (!restaurant) throw new AppError('Restaurant not found', 404);
  const count = await MenuItem.countDocuments({ restaurantId: rid, deleted: false });
  await assertPlanLimit(restaurant.subscription.plan, 'menuItems', count);

  const item = await MenuItem.create({
    restaurantId: rid, categoryId, name, description, price,
    imageUrl, tags, preparationTime, sortOrder,
  });
  res.status(201).json({ success: true, item });
}

export async function updateItem(req: AuthRequest, res: Response): Promise<void> {
  const rid = (req as any).restaurantId;
  const allowed = ['name','description','price','categoryId','imageUrl','available','tags','preparationTime','sortOrder'];
  const update: Record<string, unknown> = {};
  allowed.forEach((k) => { if (req.body[k] !== undefined) update[k] = req.body[k]; });

  const item = await MenuItem.findOneAndUpdate(
    { _id: req.params.id, restaurantId: rid, deleted: false },
    { $set: update },
    { new: true }
  );
  if (!item) throw new AppError('Item not found', 404);
  res.json({ success: true, item });
}

export async function deleteItem(req: AuthRequest, res: Response): Promise<void> {
  const rid = (req as any).restaurantId;
  // Soft-delete: preserve for order history
  const item = await MenuItem.findOneAndUpdate(
    { _id: req.params.id, restaurantId: rid },
    { $set: { deleted: true, available: false } },
    { new: true }
  );
  if (!item) throw new AppError('Item not found', 404);
  res.json({ success: true, message: 'Item removed from menu' });
}

export async function toggleAvailability(req: AuthRequest, res: Response): Promise<void> {
  const rid = (req as any).restaurantId;
  // Manual toggle always clears the auto-86 flag — the owner's choice wins
  // until inventory changes it again.
  const item = await MenuItem.findOne({ _id: req.params.id, restaurantId: rid, deleted: false });
  if (item) item.autoUnavailable = false;
  if (!item) throw new AppError('Item not found', 404);
  item.available = !item.available;
  await item.save();
  res.json({ success: true, available: item.available });
}
