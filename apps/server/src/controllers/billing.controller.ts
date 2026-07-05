import { Response } from 'express';
import mongoose from 'mongoose';
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

// GET /api/billing/paid?page&limit — settled payments, newest first, plus
// today's totals. Backs the cashier "Payments" tab (owner sees it too).
export async function listPaidBills(req: AuthRequest, res: Response): Promise<void> {
  const rid = (req as any).restaurantId as string;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const page = Math.max(parseInt(req.query.page as string) || 1, 1);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [bills, total, todayAgg] = await Promise.all([
    Bill.find({ restaurantId: rid, status: 'paid' })
      .populate({ path: 'sessionId', select: 'tableId', populate: { path: 'tableId', select: 'label' } })
      .populate('processedBy', 'name')
      .sort({ paidAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Bill.countDocuments({ restaurantId: rid, status: 'paid' }),
    Bill.aggregate([
      // aggregate() doesn't cast string ids
      { $match: { restaurantId: new mongoose.Types.ObjectId(rid), status: 'paid', paidAt: { $gte: todayStart } } },
      { $group: { _id: null, revenue: { $sum: '$total' }, count: { $sum: 1 } } },
    ]),
  ]);

  res.json({
    success: true,
    bills,
    total,
    page,
    pages: Math.ceil(total / limit),
    today: todayAgg[0] ? { revenue: todayAgg[0].revenue, count: todayAgg[0].count } : { revenue: 0, count: 0 },
  });
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
