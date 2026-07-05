import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler';
import User, { IUser } from '../models/User';

export interface AuthRequest extends Request {
  user?: IUser;
  // Guest tokens carry session/restaurant IDs directly — no DB User record
  guestPayload?: { sessionId: string; restaurantId: string; role: 'guest' };
}

interface StaffTokenPayload {
  id: string;
  role: string;
  restaurantId: string | null;
  type: 'staff';
}

interface GuestTokenPayload {
  sessionId: string;
  restaurantId: string;
  role: 'guest';
  type: 'guest';
}

type TokenPayload = StaffTokenPayload | GuestTokenPayload;

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) return authHeader.split(' ')[1];
  return req.cookies?.accessToken ?? null;
}

// ── Staff authentication ────────────────────────────────────────────────────

export function authenticate(req: AuthRequest, _res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) throw new AppError('Not authenticated', 401);

  let decoded: TokenPayload;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload;
  } catch {
    throw new AppError('Invalid or expired token', 401);
  }

  if (decoded.type !== 'staff') throw new AppError('Not authorized', 403);

  User.findById((decoded as StaffTokenPayload).id)
    .select('-passwordHash -inviteToken')
    .then((user) => {
      if (!user) throw new AppError('User not found', 401);
      if (user.status === 'suspended') throw new AppError('Account suspended', 403);
      req.user = user;
      next();
    })
    .catch(next);
}

// ── Staff OR Guest authentication (for public-read routes like menu) ──────────

export function authenticateAny(req: AuthRequest, _res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) throw new AppError('Not authenticated', 401);

  let decoded: TokenPayload;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload;
  } catch {
    throw new AppError('Invalid or expired token', 401);
  }

  if (decoded.type === 'guest') {
    req.guestPayload = decoded as GuestTokenPayload;
    return next();
  }

  // Staff token
  User.findById((decoded as StaffTokenPayload).id)
    .select('-passwordHash -inviteToken')
    .then((user) => {
      if (!user) throw new AppError('User not found', 401);
      if (user.status === 'suspended') throw new AppError('Account suspended', 403);
      req.user = user;
      next();
    })
    .catch(next);
}

// ── Guest authentication (QR-based, no DB user record) ─────────────────────

export function authenticateGuest(req: AuthRequest, _res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) throw new AppError('Not authenticated', 401);

  let decoded: TokenPayload;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload;
  } catch {
    throw new AppError('Invalid or expired token', 401);
  }

  if (decoded.type !== 'guest') throw new AppError('Not authorized', 403);

  req.guestPayload = decoded as GuestTokenPayload;
  next();
}
