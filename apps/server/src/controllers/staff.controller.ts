import { Response } from 'express';
import crypto from 'crypto';
import { AuthRequest } from '../middleware/authenticate';
import User from '../models/User';
import Restaurant from '../models/Restaurant';
import { AppError } from '../middleware/errorHandler';
import { assertPlanLimit } from '../utils/planLimits';
import type { UserRole } from '@waiterless/types';

// GET /api/staff
export async function listStaff(req: AuthRequest, res: Response): Promise<void> {
  const rid = (req as any).restaurantId;
  const staff = await User.find({ restaurantId: rid, role: { $ne: 'platform_admin' } })
    .select('-passwordHash -inviteToken')
    .sort({ createdAt: -1 })
    .lean();
  res.json({ success: true, staff });
}

// POST /api/staff/invite
export async function inviteStaff(req: AuthRequest, res: Response): Promise<void> {
  const rid = (req as any).restaurantId;
  const { email, role, name } = req.body;

  if (!email || !role) throw new AppError('email and role are required', 400);
  const allowedRoles: UserRole[] = ['cashier', 'kitchen'];
  if (!allowedRoles.includes(role)) {
    throw new AppError(`role must be one of: ${allowedRoles.join(', ')}`, 400);
  }

  const exists = await User.findOne({ email: email.toLowerCase().trim() });
  if (exists) throw new AppError('Email already registered', 409);

  const restaurant = await Restaurant.findById(rid).select('subscription').lean();
  if (!restaurant) throw new AppError('Restaurant not found', 404);
  const count = await User.countDocuments({ restaurantId: rid });
  await assertPlanLimit(restaurant.subscription.plan, 'staff', count);

  const inviteToken = crypto.randomBytes(32).toString('hex');
  const user = await User.create({
    restaurantId: rid,
    name: name || email,
    email: email.toLowerCase().trim(),
    passwordHash: crypto.randomBytes(16).toString('hex'), // placeholder
    role,
    status: 'active',
    inviteToken,
    inviteExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  res.status(201).json({
    success: true,
    user: { id: user._id, email: user.email, role: user.role },
    inviteToken,
    inviteUrl: `${process.env.CLIENT_URL}/invite/${inviteToken}`,
  });
}

// PATCH /api/staff/:id/suspend
export async function suspendStaff(req: AuthRequest, res: Response): Promise<void> {
  const rid = (req as any).restaurantId;
  const user = await User.findOne({ _id: req.params.id, restaurantId: rid });
  if (!user) throw new AppError('Staff member not found', 404);
  if (user.role === 'owner') throw new AppError('Cannot suspend the owner', 403);

  user.status = user.status === 'suspended' ? 'active' : 'suspended';
  await user.save();
  res.json({ success: true, status: user.status });
}

// DELETE /api/staff/:id
export async function removeStaff(req: AuthRequest, res: Response): Promise<void> {
  const rid = (req as any).restaurantId;
  const user = await User.findOne({ _id: req.params.id, restaurantId: rid });
  if (!user) throw new AppError('Staff member not found', 404);
  if (user.role === 'owner') throw new AppError('Cannot remove the owner', 403);
  await user.deleteOne();
  res.json({ success: true, message: 'Staff member removed' });
}
