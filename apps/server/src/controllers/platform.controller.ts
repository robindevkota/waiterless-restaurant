import { Response } from 'express';
import crypto from 'crypto';
import Restaurant from '../models/Restaurant';
import User from '../models/User';
import Bill from '../models/Bill';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/authenticate';
import { evictStatusCache } from '../middleware/tenantStatusGuard';

// GET /api/platform/restaurants
export async function listRestaurants(_req: AuthRequest, res: Response): Promise<void> {
  const restaurants = await Restaurant.find()
    .populate('ownerId', 'name email')
    .sort({ createdAt: -1 })
    .lean();
  res.json({ success: true, restaurants });
}

// GET /api/platform/restaurants/:id
export async function getRestaurant(req: AuthRequest, res: Response): Promise<void> {
  const restaurant = await Restaurant.findById(req.params.id)
    .populate('ownerId', 'name email status')
    .lean();
  if (!restaurant) throw new AppError('Restaurant not found', 404);
  res.json({ success: true, restaurant });
}

// POST /api/platform/restaurants
export async function createRestaurant(req: AuthRequest, res: Response): Promise<void> {
  const { name, slug, ownerName, ownerEmail, plan = 'trial' } = req.body;
  if (!name || !slug || !ownerName || !ownerEmail) {
    throw new AppError('name, slug, ownerName, ownerEmail are required', 400);
  }

  const slugExists = await Restaurant.findOne({ slug: slug.toLowerCase().trim() });
  if (slugExists) throw new AppError('Slug already in use', 409);

  const emailExists = await User.findOne({ email: ownerEmail.toLowerCase().trim() });
  if (emailExists) throw new AppError('Email already registered', 409);

  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  const currentPeriodEnd = trialEndsAt;

  // Create restaurant first with placeholder ownerId
  const restaurant = await Restaurant.create({
    name,
    slug: slug.toLowerCase().trim(),
    ownerId: new (await import('mongoose')).default.Types.ObjectId(), // temp
    branding: { restaurantName: name },
    subscription: { plan, status: 'active', trialEndsAt, currentPeriodEnd },
    settings: {},
  });

  // Create owner with invite token
  const inviteToken = crypto.randomBytes(32).toString('hex');
  const owner = await User.create({
    restaurantId: restaurant._id,
    name: ownerName,
    email: ownerEmail.toLowerCase().trim(),
    passwordHash: crypto.randomBytes(16).toString('hex'), // placeholder, replaced on invite accept
    role: 'owner',
    status: 'active',
    inviteToken,
    inviteExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  restaurant.ownerId = owner._id as any;
  await restaurant.save();

  res.status(201).json({
    success: true,
    restaurant,
    owner: { id: owner._id, name: owner.name, email: owner.email },
    inviteToken, // platform admin shares this with the restaurant owner
    inviteUrl: `${process.env.CLIENT_URL}/invite/${inviteToken}`,
  });
}

// PATCH /api/platform/restaurants/:id/block
export async function blockRestaurant(req: AuthRequest, res: Response): Promise<void> {
  const restaurant = await Restaurant.findById(req.params.id);
  if (!restaurant) throw new AppError('Restaurant not found', 404);

  restaurant.subscription.status = 'blocked';
  if (req.body.notes) restaurant.subscription.notes = req.body.notes;
  await restaurant.save();

  evictStatusCache(restaurant._id.toString());

  res.json({ success: true, message: 'Restaurant blocked', restaurant });
}

// PATCH /api/platform/restaurants/:id/unblock
export async function unblockRestaurant(req: AuthRequest, res: Response): Promise<void> {
  const restaurant = await Restaurant.findById(req.params.id);
  if (!restaurant) throw new AppError('Restaurant not found', 404);

  restaurant.subscription.status = 'active';
  if (req.body.notes) restaurant.subscription.notes = req.body.notes;
  await restaurant.save();

  evictStatusCache(restaurant._id.toString());

  res.json({ success: true, message: 'Restaurant unblocked', restaurant });
}

// PATCH /api/platform/restaurants/:id/subscription
export async function updateSubscription(req: AuthRequest, res: Response): Promise<void> {
  const { plan, status, notes, extendDays } = req.body;
  const restaurant = await Restaurant.findById(req.params.id);
  if (!restaurant) throw new AppError('Restaurant not found', 404);

  if (plan) restaurant.subscription.plan = plan;
  if (status) {
    restaurant.subscription.status = status;
    evictStatusCache(restaurant._id.toString());
  }
  if (notes !== undefined) restaurant.subscription.notes = notes;
  if (extendDays) {
    const base = new Date(Math.max(Date.now(), restaurant.subscription.currentPeriodEnd.getTime()));
    restaurant.subscription.currentPeriodEnd = new Date(base.getTime() + extendDays * 86400000);
  }

  await restaurant.save();
  res.json({ success: true, restaurant });
}

// GET /api/platform/revenue
export async function platformRevenue(_req: AuthRequest, res: Response): Promise<void> {
  const result = await Bill.aggregate([
    { $match: { status: 'paid' } },
    {
      $group: {
        _id: '$restaurantId',
        totalRevenue: { $sum: '$total' },
        totalBills: { $sum: 1 },
      },
    },
    {
      $lookup: {
        from: 'restaurants',
        localField: '_id',
        foreignField: '_id',
        as: 'restaurant',
      },
    },
    { $unwind: '$restaurant' },
    {
      $project: {
        restaurantId: '$_id',
        restaurantName: '$restaurant.name',
        slug: '$restaurant.slug',
        plan: '$restaurant.subscription.plan',
        status: '$restaurant.subscription.status',
        totalRevenue: 1,
        totalBills: 1,
      },
    },
    { $sort: { totalRevenue: -1 } },
  ]);

  const grandTotal = result.reduce((sum, r) => sum + r.totalRevenue, 0);
  res.json({ success: true, grandTotal, restaurants: result });
}
