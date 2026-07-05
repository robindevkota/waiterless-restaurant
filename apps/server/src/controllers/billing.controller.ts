import { Response } from 'express';
import { AuthRequest } from '../middleware/authenticate';
import Bill from '../models/Bill';
import { AppError } from '../middleware/errorHandler';

// GET /api/billing/session/:sessionId  — cashier/owner views bill
export async function getBill(req: AuthRequest, res: Response): Promise<void> {
  const rid = (req as any).restaurantId;
  const bill = await Bill.findOne({ sessionId: req.params.sessionId, restaurantId: rid })
    .populate('processedBy', 'name')
    .lean();
  if (!bill) throw new AppError('Bill not found', 404);
  res.json({ success: true, bill });
}

// GET /api/billing/my  — guest views their running bill
export async function myBill(req: AuthRequest, res: Response): Promise<void> {
  const { sessionId, restaurantId } = req.guestPayload!;
  const bill = await Bill.findOne({ sessionId, restaurantId }).lean();
  if (!bill) throw new AppError('Bill not found', 404);

  // Merchant payment QR travels with the bill so the guest can pay from the
  // table (always fresh — the SSR branding payload is cached for 60s)
  const { default: Restaurant } = await import('../models/Restaurant');
  const restaurant = await Restaurant.findById(restaurantId).select('settings.paymentQrUrl').lean();

  res.json({ success: true, bill, paymentQrUrl: restaurant?.settings?.paymentQrUrl || undefined });
}
