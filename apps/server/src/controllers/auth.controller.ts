import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User';
import Restaurant from '../models/Restaurant';
import Table from '../models/Table';
import TableSession from '../models/TableSession';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/authenticate';
import {
  signAccessToken,
  signRefreshToken,
  signGuestToken,
  setRefreshCookie,
  clearRefreshCookie,
} from '../utils/jwt';

// POST /api/auth/signup — self-serve: owner account + restaurant on a 14-day trial
export async function signup(req: Request, res: Response): Promise<void> {
  const { restaurantName, name, email, password } = req.body;
  if (!restaurantName || !name || !email || !password) {
    throw new AppError('restaurantName, name, email and password are required', 400);
  }
  if (password.length < 8) throw new AppError('Password must be at least 8 characters', 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError('Invalid email address', 400);

  const emailExists = await User.findOne({ email: email.toLowerCase().trim() });
  if (emailExists) throw new AppError('Email already registered', 409);

  const baseSlug = String(restaurantName)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'restaurant';
  let slug = baseSlug;
  while (await Restaurant.findOne({ slug })) {
    slug = `${baseSlug}-${crypto.randomBytes(2).toString('hex')}`;
  }

  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  const restaurant = await Restaurant.create({
    name: restaurantName,
    slug,
    ownerId: new (await import('mongoose')).default.Types.ObjectId(), // temp, replaced below
    branding: { restaurantName },
    subscription: { plan: 'trial', status: 'active', trialEndsAt, currentPeriodEnd: trialEndsAt },
    settings: {},
  });

  const user = await User.create({
    restaurantId: restaurant._id,
    name,
    email: email.toLowerCase().trim(),
    passwordHash: password, // pre-save hook hashes it
    role: 'owner',
    status: 'active',
  });

  restaurant.ownerId = user._id as any;
  await restaurant.save();

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  setRefreshCookie(res, refreshToken);

  res.status(201).json({ success: true, accessToken, user, restaurant: { slug, name: restaurantName } });
}

// POST /api/auth/login
export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;
  if (!email || !password) throw new AppError('Email and password are required', 400);

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user || !(await user.comparePassword(password))) {
    throw new AppError('Invalid credentials', 401);
  }
  if (user.status === 'suspended') throw new AppError('Account suspended', 403);

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  setRefreshCookie(res, refreshToken);

  res.json({ success: true, accessToken, user });
}

// POST /api/auth/refresh
export async function refresh(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.refreshToken;
  if (!token) throw new AppError('No refresh token', 401);

  let decoded: { id: string };
  try {
    decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as { id: string };
  } catch {
    throw new AppError('Invalid or expired refresh token', 401);
  }

  const user = await User.findById(decoded.id);
  if (!user || user.status === 'suspended') throw new AppError('User not found', 401);

  const accessToken = signAccessToken(user);
  const newRefresh = signRefreshToken(user);
  setRefreshCookie(res, newRefresh);

  res.json({ success: true, accessToken, user });
}

// POST /api/auth/logout
export async function logout(_req: Request, res: Response): Promise<void> {
  clearRefreshCookie(res);
  res.json({ success: true, message: 'Logged out' });
}

// GET /api/auth/me
export async function me(req: AuthRequest, res: Response): Promise<void> {
  res.json({ success: true, user: req.user });
}

// POST /api/auth/invite/accept
export async function acceptInvite(req: Request, res: Response): Promise<void> {
  const { token, name, password } = req.body;
  if (!token || !name || !password) throw new AppError('token, name and password are required', 400);
  if (password.length < 8) throw new AppError('Password must be at least 8 characters', 400);

  const user = await User.findOne({ inviteToken: token });
  if (!user) throw new AppError('Invalid invite token', 400);
  if (user.inviteExpiry && user.inviteExpiry < new Date()) {
    throw new AppError('Invite token has expired', 400);
  }

  user.name = name;
  user.passwordHash = password; // pre-save hook will hash it
  user.inviteToken = undefined;
  user.inviteExpiry = undefined;
  user.status = 'active';
  await user.save();

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  setRefreshCookie(res, refreshToken);

  res.status(201).json({ success: true, accessToken, user });
}

// POST /api/qr/:tableToken  — issue guest JWT
export async function issueGuestToken(req: Request, res: Response): Promise<void> {
  const { tableToken } = req.params;

  const table = await Table.findOne({ qrToken: tableToken });
  if (!table) throw new AppError('Invalid QR code', 404);

  if (!table.currentSessionId) {
    throw new AppError('No active session at this table. Please ask a staff member.', 404);
  }

  const session = await TableSession.findById(table.currentSessionId);
  if (!session || session.status !== 'open') {
    throw new AppError('Session is no longer active.', 410);
  }

  // Check restaurant is active (tenantStatusGuard not applied here so we check manually)
  const { default: Restaurant } = await import('../models/Restaurant');
  const restaurant = await Restaurant.findById(table.restaurantId).select('subscription.status').lean();
  if (!restaurant) throw new AppError('Restaurant not found', 404);
  if (restaurant.subscription.status === 'blocked') {
    throw new AppError('This restaurant is currently unavailable.', 403);
  }

  const guestToken = signGuestToken(
    session._id.toString(),
    table.restaurantId.toString()
  );

  res.json({
    success: true,
    guestToken,
    session: {
      id: session._id,
      tableLabel: table.label,
      restaurantId: table.restaurantId,
    },
  });
}
