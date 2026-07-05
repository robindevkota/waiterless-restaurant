import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/authenticate';
import Bill from '../models/Bill';
import TableSession from '../models/TableSession';
import Order from '../models/Order';
import Table from '../models/Table';

// injectRestaurantId sets a string; aggregate() does not cast to ObjectId the
// way find() does, so every $match here must use the ObjectId form.
function ridOf(req: AuthRequest): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId((req as any).restaurantId as string);
}

// GET /api/reports/overview — everything the dashboard needs in one call
export async function overview(req: AuthRequest, res: Response): Promise<void> {
  const rid = ridOf(req);
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  const since30 = new Date(now.getTime() - 30 * dayMs);
  const since7 = new Date(now.getTime() - 7 * dayMs);
  const since14 = new Date(now.getTime() - 14 * dayMs);
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);

  const { default: Restaurant } = await import('../models/Restaurant');
  const restaurantDoc = await Restaurant.findById(rid).select('settings.timezone').lean();
  const tz = restaurantDoc?.settings?.timezone || 'Asia/Kathmandu';

  const [daily, weekWindows, todayAgg, topItemsAgg, hoursAgg, paymentAgg, tableCounts] = await Promise.all([
    Bill.aggregate([
      { $match: { restaurantId: rid, status: 'paid', paidAt: { $gte: since30 } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$paidAt', timezone: tz } },
          revenue: { $sum: '$total' },
          bills: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Bill.aggregate([
      { $match: { restaurantId: rid, status: 'paid', paidAt: { $gte: since14 } } },
      {
        $group: {
          _id: { $cond: [{ $gte: ['$paidAt', since7] }, 'current', 'previous'] },
          revenue: { $sum: '$total' },
          bills: { $sum: 1 },
          avgBill: { $avg: '$total' },
        },
      },
    ]),
    Bill.aggregate([
      { $match: { restaurantId: rid, status: 'paid', paidAt: { $gte: todayStart } } },
      { $group: { _id: null, revenue: { $sum: '$total' }, bills: { $sum: 1 }, avgBill: { $avg: '$total' } } },
    ]),
    Order.aggregate([
      { $match: { restaurantId: rid, status: { $ne: 'cancelled' }, createdAt: { $gte: since30 } } },
      { $unwind: '$items' },
      { $match: { 'items.status': { $ne: 'cancelled' } } },
      {
        $group: {
          _id: '$items.menuItemId',
          name: { $first: '$items.name' },
          totalQty: { $sum: '$items.qty' },
          totalRevenue: { $sum: { $multiply: ['$items.price', '$items.qty'] } },
        },
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 7 },
    ]),
    TableSession.aggregate([
      { $match: { restaurantId: rid, openedAt: { $gte: since30 } } },
      { $group: { _id: { $hour: { date: '$openedAt', timezone: tz } }, sessions: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Bill.aggregate([
      { $match: { restaurantId: rid, status: 'paid', paidAt: { $gte: since30 } } },
      { $group: { _id: '$paymentMethod', amount: { $sum: '$total' }, count: { $sum: 1 } } },
      { $sort: { amount: -1 } },
    ]),
    Table.aggregate([
      { $match: { restaurantId: rid } },
      { $group: { _id: null, total: { $sum: 1 }, occupied: { $sum: { $cond: [{ $eq: ['$status', 'occupied'] }, 1, 0] } } } },
    ]),
  ]);

  const ratingAgg = await TableSession.aggregate([
    { $match: { restaurantId: rid, rating: { $gte: 1 }, ratedAt: { $gte: since30 } } },
    { $group: { _id: null, avgRating: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);

  // Revenue from items guests added via "goes well with" upsell chips (30d)
  const upsellAgg = await Order.aggregate([
    { $match: { restaurantId: rid, status: { $ne: 'cancelled' }, createdAt: { $gte: since30 } } },
    { $unwind: '$items' },
    { $match: { 'items.viaUpsell': true, 'items.status': { $ne: 'cancelled' } } },
    { $group: { _id: null, revenue: { $sum: { $multiply: ['$items.price', '$items.qty'] } }, items: { $sum: '$items.qty' } } },
  ]);

  // Fill missing days with zeros so charts have a continuous 30-day series
  const byDay = new Map(daily.map((d: any) => [d._id, d]));
  const days: { date: string; revenue: number; bills: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * dayMs);
    const key = d.toISOString().slice(0, 10);
    const hit = byDay.get(key) as any;
    days.push({ date: key, revenue: hit?.revenue ?? 0, bills: hit?.bills ?? 0 });
  }

  const win = (id: string) => (weekWindows as any[]).find((w) => w._id === id) || { revenue: 0, bills: 0, avgBill: 0 };
  const current = win('current');
  const previous = win('previous');
  const pct = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null);

  const hours = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    sessions: (hoursAgg as any[]).find((x) => x._id === h)?.sessions ?? 0,
  }));

  res.json({
    success: true,
    kpis: {
      today: todayAgg[0] || { revenue: 0, bills: 0, avgBill: 0 },
      week: {
        revenue: current.revenue,
        sessions: current.bills,
        avgBill: Math.round(current.avgBill || 0),
        revenueDelta: pct(current.revenue, previous.revenue),
        sessionsDelta: pct(current.bills, previous.bills),
        avgBillDelta: pct(current.avgBill || 0, previous.avgBill || 0),
      },
      tables: tableCounts[0] || { total: 0, occupied: 0 },
      rating: ratingAgg[0]
        ? { avg: Math.round(ratingAgg[0].avgRating * 10) / 10, count: ratingAgg[0].count }
        : null,
      upsell: upsellAgg[0]
        ? { revenue: upsellAgg[0].revenue, items: upsellAgg[0].items }
        : { revenue: 0, items: 0 },
    },
    days,
    topItems: topItemsAgg,
    hours,
    paymentMix: paymentAgg,
  });
}

// GET /api/reports/revenue?period=daily|weekly|monthly
export async function revenueReport(req: AuthRequest, res: Response): Promise<void> {
  const rid = ridOf(req);
  const period = (req.query.period as string) || 'daily';

  const dateFormat =
    period === 'monthly' ? '%Y-%m' :
    period === 'weekly'  ? '%Y-%U' :
                           '%Y-%m-%d';

  const result = await Bill.aggregate([
    { $match: { restaurantId: rid as any, status: 'paid' } },
    {
      $group: {
        _id: { $dateToString: { format: dateFormat, date: '$paidAt' } },
        revenue: { $sum: '$total' },
        bills: { $sum: 1 },
        avgBill: { $avg: '$total' },
        byMethod: {
          $push: { method: '$paymentMethod', amount: '$total' },
        },
      },
    },
    { $sort: { _id: -1 } },
    { $limit: 30 },
  ]);

  // Total all-time
  const totals = await Bill.aggregate([
    { $match: { restaurantId: rid as any, status: 'paid' } },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$total' },
        totalBills: { $sum: 1 },
      },
    },
  ]);

  res.json({
    success: true,
    period,
    data: result,
    totals: totals[0] || { totalRevenue: 0, totalBills: 0 },
  });
}

// GET /api/reports/sessions?limit=50&page=1
export async function sessionHistory(req: AuthRequest, res: Response): Promise<void> {
  const rid = ridOf(req);
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const page = parseInt(req.query.page as string) || 1;

  const [sessions, total] = await Promise.all([
    TableSession.find({ restaurantId: rid, status: 'closed' })
      .populate('tableId', 'label')
      .populate('openedBy', 'name')
      .populate('closedBy', 'name')
      .populate('billId', 'total paymentMethod paymentReference paidAt')
      .sort({ closedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    TableSession.countDocuments({ restaurantId: rid, status: 'closed' }),
  ]);

  res.json({ success: true, sessions, total, page, pages: Math.ceil(total / limit) });
}

// GET /api/reports/top-items?limit=10
export async function topItems(req: AuthRequest, res: Response): Promise<void> {
  const rid = ridOf(req);
  const limit = parseInt(req.query.limit as string) || 10;

  const result = await Order.aggregate([
    { $match: { restaurantId: rid as any, status: { $ne: 'cancelled' } } },
    { $unwind: '$items' },
    { $match: { 'items.status': { $ne: 'cancelled' } } },
    {
      $group: {
        _id: '$items.menuItemId',
        name: { $first: '$items.name' },
        totalQty: { $sum: '$items.qty' },
        totalRevenue: { $sum: { $multiply: ['$items.price', '$items.qty'] } },
        orderCount: { $sum: 1 },
      },
    },
    { $sort: { totalQty: -1 } },
    { $limit: limit },
  ]);

  res.json({ success: true, items: result });
}

// GET /api/reports/peak-hours
export async function peakHours(req: AuthRequest, res: Response): Promise<void> {
  const rid = ridOf(req);

  const result = await TableSession.aggregate([
    { $match: { restaurantId: rid as any, status: 'closed' } },
    {
      $group: {
        _id: { $hour: '$openedAt' },
        sessionCount: { $sum: 1 },
        avgDurationMin: {
          $avg: {
            $divide: [
              { $subtract: ['$closedAt', '$openedAt'] },
              60000,
            ],
          },
        },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  res.json({ success: true, hours: result });
}
