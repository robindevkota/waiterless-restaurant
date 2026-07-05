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
  res.json({ success: true, bill });
}
