import { Response } from 'express';
import { AuthRequest } from '../middleware/authenticate';
import Table from '../models/Table';
import TableSession from '../models/TableSession';
import Order from '../models/Order';
import Bill from '../models/Bill';
import Restaurant from '../models/Restaurant';
import { AppError } from '../middleware/errorHandler';
import { getIO } from '../services/socket.service';
import { SocketEvents } from '@waiterless/types';

// POST /api/sessions/my/call-waiter — guest asks for staff attention
export async function callWaiter(req: AuthRequest, res: Response): Promise<void> {
  const { sessionId, restaurantId } = req.guestPayload!;

  const session = await TableSession.findOne({ _id: sessionId, restaurantId });
  if (!session || session.status !== 'open') throw new AppError('Session is no longer active', 410);

  const table = await Table.findById(session.tableId);
  if (!table) throw new AppError('Table not found', 404);

  const alreadyCalled = table.status === 'needs_attention';
  if (!alreadyCalled) {
    table.status = 'needs_attention';
    await table.save();
    // Emit only on the first call — repeated taps don't spam the floor
    getIO().to(`cashier:${restaurantId}`).emit(SocketEvents.WAITER_CALLED, {
      sessionId,
      tableId: table._id,
      tableLabel: table.label,
      at: new Date().toISOString(),
    });
  }

  res.json({ success: true, message: alreadyCalled ? 'Staff already notified' : 'Staff notified' });
}

// POST /api/sessions/my/claim-paid — guest says "I've paid" after scanning the
// static merchant QR. Advisory only: flags the session for the cashier to
// verify on their merchant app; never touches bill status.
export async function claimPaid(req: AuthRequest, res: Response): Promise<void> {
  const { sessionId, restaurantId } = req.guestPayload!;

  const session = await TableSession.findOne({ _id: sessionId, restaurantId });
  if (!session || session.status !== 'open') throw new AppError('Session is no longer active', 410);

  const bill = await Bill.findOne({ sessionId }).lean();
  const amount = bill?.total ?? 0;

  // One notification per minute — repeated taps don't spam the floor
  const recentlyClaimed = session.paidClaimedAt &&
    Date.now() - session.paidClaimedAt.getTime() < 60_000;

  session.paidClaimedAt = new Date();
  session.paidClaimAmount = amount;
  await session.save();

  if (!recentlyClaimed) {
    const table = await Table.findById(session.tableId).lean();
    getIO().to(`cashier:${restaurantId}`).emit(SocketEvents.PAYMENT_CLAIMED, {
      sessionId,
      tableId: session.tableId,
      tableLabel: table?.label ?? '',
      amount,
      at: session.paidClaimedAt.toISOString(),
    });
  }

  res.json({ success: true, message: 'Cashier notified — they will confirm your payment shortly' });
}

// POST /api/sessions/my/feedback — guest rates the visit (works after close too)
export async function submitFeedback(req: AuthRequest, res: Response): Promise<void> {
  const { sessionId, restaurantId } = req.guestPayload!;
  const { rating, comment } = req.body;

  const parsed = Number(rating);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) {
    throw new AppError('rating must be an integer from 1 to 5', 400);
  }
  if (comment !== undefined && (typeof comment !== 'string' || comment.length > 500)) {
    throw new AppError('comment must be a string of at most 500 characters', 400);
  }

  const session = await TableSession.findOne({ _id: sessionId, restaurantId });
  if (!session) throw new AppError('Session not found', 404);

  session.rating = parsed;
  session.feedback = comment?.trim() || undefined;
  session.ratedAt = new Date();
  await session.save();

  res.json({ success: true, message: 'Thanks for the feedback!' });
}

// POST /api/sessions/:id/attend — cashier acknowledges a waiter call
export async function attendTable(req: AuthRequest, res: Response): Promise<void> {
  const rid = (req as any).restaurantId;
  const session = await TableSession.findOne({ _id: req.params.id, restaurantId: rid });
  if (!session) throw new AppError('Session not found', 404);

  await Table.findByIdAndUpdate(session.tableId, {
    $set: { status: session.status === 'open' ? 'occupied' : 'available' },
  });

  res.json({ success: true });
}

// POST /api/sessions  — cashier opens a session
export async function openSession(req: AuthRequest, res: Response): Promise<void> {
  const rid = (req as any).restaurantId;
  const { tableId, guestCount } = req.body;
  if (!tableId) throw new AppError('tableId is required', 400);

  const table = await Table.findOne({ _id: tableId, restaurantId: rid });
  if (!table) throw new AppError('Table not found', 404);
  if (table.currentSessionId) throw new AppError('Table already has an active session', 409);

  const session = await TableSession.create({
    restaurantId: rid,
    tableId: table._id,
    openedBy: req.user!._id,
    guestCount,
  });

  table.currentSessionId = session._id as any;
  table.status = 'occupied';
  await table.save();

  // Also create an open bill immediately so guest can track running total
  const restaurant = await Restaurant.findById(rid).select('settings.vatRate').lean();
  await Bill.create({
    restaurantId: rid,
    sessionId: session._id,
    lineItems: [],
    subtotal: 0,
    vatRate: restaurant?.settings?.vatRate ?? 13,
    vatAmount: 0,
    total: 0,
    status: 'open',
  });

  res.status(201).json({ success: true, session, tableLabel: table.label });
}

// GET /api/sessions/active
export async function listActiveSessions(req: AuthRequest, res: Response): Promise<void> {
  const rid = (req as any).restaurantId;
  const sessions = await TableSession.find({ restaurantId: rid, status: 'open' })
    .populate('tableId', 'label capacity')
    .populate('openedBy', 'name')
    .sort({ openedAt: 1 })
    .lean();
  res.json({ success: true, sessions });
}

// GET /api/sessions/:id
export async function getSession(req: AuthRequest, res: Response): Promise<void> {
  const rid = (req as any).restaurantId;
  const session = await TableSession.findOne({ _id: req.params.id, restaurantId: rid })
    .populate('tableId', 'label capacity')
    .populate('openedBy', 'name')
    .populate('closedBy', 'name')
    .lean();
  if (!session) throw new AppError('Session not found', 404);
  res.json({ success: true, session });
}

// POST /api/sessions/:id/close  — cashier or owner closes + pays
export async function closeSession(req: AuthRequest, res: Response): Promise<void> {
  const rid = (req as any).restaurantId;
  const { paymentMethod, paymentReference } = req.body;
  if (!paymentMethod) throw new AppError('paymentMethod is required', 400);

  const validMethods = ['cash', 'esewa', 'khalti', 'mobile_banking', 'split'];
  if (!validMethods.includes(paymentMethod)) {
    throw new AppError(`paymentMethod must be one of: ${validMethods.join(', ')}`, 400);
  }

  const session = await TableSession.findOne({ _id: req.params.id, restaurantId: rid });
  if (!session) throw new AppError('Session not found', 404);
  if (session.status === 'closed') throw new AppError('Session is already closed', 409);

  // Build bill snapshot from all orders in session
  const orders = await Order.find({ sessionId: session._id, status: { $ne: 'cancelled' } }).lean();

  const lineItemMap = new Map<string, { menuItemId: string; name: string; qty: number; unitPrice: number; subtotal: number }>();
  for (const order of orders) {
    for (const item of order.items) {
      if (item.status === 'cancelled') continue;
      const key = item.menuItemId.toString();
      if (lineItemMap.has(key)) {
        const existing = lineItemMap.get(key)!;
        existing.qty += item.qty;
        existing.subtotal += item.price * item.qty;
      } else {
        lineItemMap.set(key, {
          menuItemId: key,
          name: item.name,
          qty: item.qty,
          unitPrice: item.price,
          subtotal: item.price * item.qty,
        });
      }
    }
  }

  const lineItems = Array.from(lineItemMap.values());
  const subtotal = lineItems.reduce((s, i) => s + i.subtotal, 0);
  const restaurant = await Restaurant.findById(rid).select('settings.vatRate').lean();
  const vatRate = restaurant?.settings?.vatRate ?? 13;
  const vatAmount = Math.round((subtotal * vatRate) / 100 * 100) / 100;
  const total = Math.round((subtotal + vatAmount) * 100) / 100;

  // Update or create bill
  const bill = await Bill.findOneAndUpdate(
    { sessionId: session._id },
    {
      $set: {
        lineItems,
        subtotal,
        vatRate,
        vatAmount,
        total,
        paymentMethod,
        paymentReference: paymentReference || undefined,
        status: 'paid',
        paidAt: new Date(),
        processedBy: req.user!._id,
      },
    },
    { new: true, upsert: true }
  );

  // Close session
  session.status = 'closed';
  session.closedBy = req.user!._id as any;
  session.closedAt = new Date();
  session.billId = bill._id as any;
  await session.save();

  // Free the table
  await Table.findByIdAndUpdate(session.tableId, {
    $set: { currentSessionId: null, status: 'available' },
  });

  // Notify guest via socket
  getIO().to(`table:${session._id}`).emit(SocketEvents.SESSION_CLOSED, {
    sessionId: session._id,
    bill: { total, paymentMethod },
  });

  res.json({ success: true, session, bill });
}
