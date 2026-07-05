import jwt, { SignOptions } from 'jsonwebtoken';
import { IUser } from '../models/User';

export function signAccessToken(user: IUser): string {
  const options: SignOptions = { expiresIn: (process.env.JWT_ACCESS_EXPIRES || '15m') as SignOptions['expiresIn'] };
  return jwt.sign(
    { id: user._id, role: user.role, restaurantId: user.restaurantId ?? null, type: 'staff' },
    process.env.JWT_SECRET!,
    options
  );
}

export function signRefreshToken(user: IUser): string {
  const options: SignOptions = { expiresIn: (process.env.JWT_REFRESH_EXPIRES || '7d') as SignOptions['expiresIn'] };
  return jwt.sign(
    { id: user._id, type: 'staff' },
    process.env.JWT_REFRESH_SECRET!,
    options
  );
}

export function signGuestToken(sessionId: string, restaurantId: string): string {
  const options: SignOptions = { expiresIn: (process.env.JWT_GUEST_EXPIRES || '2h') as SignOptions['expiresIn'] };
  return jwt.sign(
    { sessionId, restaurantId, role: 'guest', type: 'guest' },
    process.env.JWT_SECRET!,
    options
  );
}

export function setRefreshCookie(res: import('express').Response, token: string): void {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearRefreshCookie(res: import('express').Response): void {
  res.clearCookie('refreshToken', { httpOnly: true, sameSite: 'lax' });
}
