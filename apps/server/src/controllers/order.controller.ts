import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/authenticate';
import Order from '../models/Order';
import MenuItem from '../models/MenuItem';
import TableSession from '../models/TableSession';
import Bill from '../models/Bill';
import { AppError } from '../middleware/errorHandler';
import { getIO } from '../services/socket.service';
import { SocketEvents } from '@waiterless/types';
import { deductForOrder } from '../services/inventory.service';

// POST /api/orders  — guest places an order
export async function placeOrder(req: AuthRequest, res: Response): Promise<void> {
  const { sessionId, restaurantId } = req.guestPayload!;
  const { items } = req.body; // [{ menuItemId, qty, note }]

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new AppError('items array is required', 400);
  }

  const session = await TableSession.findOne({ _id: sessionId, restaurantId });
  if (!session || session.status !== 'open') {
    throw new AppError('Session is no longer active', 410);
  }

  // Validate items and snapshot price/name
  const orderItems = [];
  for (const entry of items) {
    if (!entry.menuItemId || !entry.qty || entry.qty < 1) {
      throw new AppError('Each item needs menuItemId and qty >= 1', 400);
    }
    const menuItem = await MenuItem.findOne({
      _id: entry.menuItemId,
      restaurantId,
      deleted: false,
      available: true,
    });
    if (!menuItem) {
      throw new AppError(`Item "${entry.menuItemId}" is unavailable or not found`, 422);
    }
    orderItems.push({
      menuItemId: menuItem._id,
      name: menuItem.name,       // snapshot
      price: menuItem.price,     // snapshot
      qty: entry.qty,
      note: entry.note || undefined,
      status: 'pending' as const,
      viaUpsell: entry.viaUpsell === true,
    });
  }

  // Inventory: verify stock and deduct BEFORE creating the order — throws a
  // guest-friendly 409 naming the dish if something just sold out (auto-86
  // flips the item unavailable as a side effect).
  await deductForOrder(restaurantId, orderItems as any, undefined);

  const order = await Order.create({
    restaurantId,
    sessionId,
    tableId: session.tableId,
    items: orderItems,
    status: 'pending',
  });

  // Link order to session
  session.orders.push(order._id as any);
  await session.save();

  // Update running bill
  await recalculateBill(sessionId, restaurantId);

  const populated = await Order.findById(order._id).lean();

  // Emit to kitchen and cashier
  const io = getIO();
  io.to(`kitchen:${restaurantId}`).emit(SocketEvents.ORDER_NEW, populated);
  io.to(`cashier:${restaurantId}`).emit(SocketEvents.ORDER_NEW, populated);

  res.status(201).json({ success: true, order: populated });
}

// GET /api/orders/upsell?with=id,id — "goes well with" suggestions for the cart.
// Pure order-history co-occurrence (no LLM): sessions that ordered any cart item,
// ranked by what else those sessions ordered. aggregate() doesn't cast string ids.
export async function upsellSuggestions(req: AuthRequest, res: Response): Promise<void> {
  const { restaurantId } = req.guestPayload!;
  const rid = new mongoose.Types.ObjectId(restaurantId);

  const cartIds = String(req.query.with || '')
    .split(',')
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .slice(0, 30)
    .map((id) => new mongoose.Types.ObjectId(id));
  if (!cartIds.length) {
    res.json({ success: true, suggestions: [] });
    return;
  }

  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const ranked = await Order.aggregate([
    { $match: { restaurantId: rid, status: { $ne: 'cancelled' }, createdAt: { $gte: since }, 'items.menuItemId': { $in: cartIds } } },
    { $group: { _id: '$sessionId' } },
    { $lookup: { from: 'orders', localField: '_id', foreignField: 'sessionId', as: 'orders' } },
    { $unwind: '$orders' },
    { $match: { 'orders.status': { $ne: 'cancelled' } } },
    { $unwind: '$orders.items' },
    { $match: { 'orders.items.status': { $ne: 'cancelled' }, 'orders.items.menuItemId': { $nin: cartIds } } },
    // Count distinct sessions per item, not raw qty — one table ordering
    // 10 teas shouldn't outrank an item 8 tables paired with.
    { $group: { _id: '$orders.items.menuItemId', sessions: { $addToSet: '$_id' } } },
    { $project: { pairCount: { $size: '$sessions' } } },
    { $sort: { pairCount: -1 } },
    { $limit: 10 },
  ]);

  // Keep only items a guest can actually order right now
  const candidates = await MenuItem.find({
    _id: { $in: ranked.map((r) => r._id) },
    restaurantId,
    deleted: false,
    available: true,
  }).select('name price').lean();
  const byId = new Map(candidates.map((c) => [String(c._id), c]));

  const suggestions = ranked
    .filter((r) => byId.has(String(r._id)) && r.pairCount >= 2)
    .slice(0, 3)
    .map((r) => {
      const item = byId.get(String(r._id))!;
      return { menuItemId: String(r._id), name: item.name, price: item.price, pairCount: r.pairCount };
    });

  res.json({ success: true, suggestions });
}

// GET /api/orders/my  — guest views their session orders
export async function myOrders(req: AuthRequest, res: Response): Promise<void> {
  const { sessionId, restaurantId } = req.guestPayload!;
  const orders = await Order.find({ sessionId, restaurantId })
    .sort({ createdAt: 1 })
    .lean();
  res.json({ success: true, orders });
}

// GET /api/orders/active  — kitchen sees all active orders
export async function activeOrders(req: AuthRequest, res: Response): Promise<void> {
  const rid = (req as any).restaurantId;
  const orders = await Order.find({
    restaurantId: rid,
    status: { $in: ['pending', 'in_progress'] },
  })
    .populate('tableId', 'label')
    .sort({ createdAt: 1 })
    .lean();
  res.json({ success: true, orders });
}

// GET /api/orders/session/:sessionId — cashier/owner sees all orders in a session
export async function sessionOrders(req: AuthRequest, res: Response): Promise<void> {
  const rid = (req as any).restaurantId;
  const orders = await Order.find({ sessionId: req.params.sessionId, restaurantId: rid })
    .sort({ createdAt: 1 })
    .lean();
  res.json({ success: true, orders });
}

// PATCH /api/orders/:id/items/:itemId  — kitchen updates single item status
export async function updateItemStatus(req: AuthRequest, res: Response): Promise<void> {
  const rid = (req as any).restaurantId;
  const { status } = req.body;
  const validStatuses = ['pending', 'preparing', 'ready', 'served', 'cancelled'];
  if (!validStatuses.includes(status)) {
    throw new AppError(`status must be one of: ${validStatuses.join(', ')}`, 400);
  }

  const order = await Order.findOne({ _id: req.params.id, restaurantId: rid });
  if (!order) throw new AppError('Order not found', 404);

  // Check session not closed
  const session = await TableSession.findById(order.sessionId);
  if (!session || session.status === 'closed') {
    throw new AppError('Cannot update items in a closed session', 409);
  }

  const item = order.items.find((i) => i._id?.toString() === req.params.itemId);
  if (!item) throw new AppError('Order item not found', 404);

  item.status = status;

  // Derive order-level status
  const statuses = order.items.map((i) => i.status);
  if (statuses.every((s) => s === 'served' || s === 'cancelled')) {
    order.status = 'completed';
  } else if (statuses.some((s) => s === 'preparing' || s === 'ready')) {
    order.status = 'in_progress';
  }

  await order.save();

  // Notify guest
  getIO().to(`table:${order.sessionId}`).emit(SocketEvents.ITEM_STATUS_CHANGED, {
    orderId: order._id,
    itemId: item._id,
    status,
    orderStatus: order.status,
  });

  // If all orders in session are completed, notify cashier
  if (order.status === 'completed') {
    const pendingOrders = await Order.countDocuments({
      sessionId: order.sessionId,
      status: { $in: ['pending', 'in_progress'] },
    });
    if (pendingOrders === 0) {
      getIO().to(`cashier:${order.restaurantId}`).emit(SocketEvents.ORDER_COMPLETED, {
        sessionId: order.sessionId,
      });
    }
  }

  res.json({ success: true, order });
}

// Helper: recalculate running bill total (called after each order)
async function recalculateBill(sessionId: string, restaurantId: string): Promise<void> {
  const orders = await Order.find({
    sessionId,
    restaurantId,
    status: { $ne: 'cancelled' },
  }).lean();

  const lineItemMap = new Map<string, { menuItemId: string; name: string; qty: number; unitPrice: number; subtotal: number }>();
  for (const order of orders) {
    for (const item of order.items) {
      if (item.status === 'cancelled') continue;
      const key = item.menuItemId.toString();
      if (lineItemMap.has(key)) {
        const ex = lineItemMap.get(key)!;
        ex.qty += item.qty;
        ex.subtotal += item.price * item.qty;
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
  const bill = await Bill.findOne({ sessionId });
  if (!bill) return;
  const vatAmount = Math.round((subtotal * bill.vatRate) / 100 * 100) / 100;
  const total = Math.round((subtotal + vatAmount) * 100) / 100;

  bill.lineItems = lineItems as any;
  bill.subtotal = subtotal;
  bill.vatAmount = vatAmount;
  bill.total = total;
  await bill.save();

  // Notify guest of updated running total
  getIO().to(`table:${sessionId}`).emit(SocketEvents.BILL_UPDATED, { subtotal, vatAmount, total });
}
