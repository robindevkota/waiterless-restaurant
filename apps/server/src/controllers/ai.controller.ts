import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/authenticate';
import { AppError } from '../middleware/errorHandler';
import Bill from '../models/Bill';
import Order from '../models/Order';
import TableSession from '../models/TableSession';
import Restaurant from '../models/Restaurant';
import AiReport from '../models/AiReport';
import { generateBusinessReport, chatWithAnalyst, ChatMessage } from '../services/ai.service';
import { getInventoryOverview } from '../services/inventory.service';
import { openSecret } from '../utils/secretBox';
import type { AiProvider } from '@waiterless/types';

const MAX_REPORTS_PER_DAY = 10;
const MAX_CHATS_PER_DAY = 60;

// In-memory per-tenant daily chat counter (single-instance dev; move to Redis for prod)
const chatCounters = new Map<string, { day: string; count: number }>();
function bumpChatCounter(rid: string): number {
  const day = new Date().toISOString().slice(0, 10);
  const cur = chatCounters.get(rid);
  const next = cur && cur.day === day ? { day, count: cur.count + 1 } : { day, count: 1 };
  chatCounters.set(rid, next);
  return next.count;
}

function ridOf(req: AuthRequest): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId((req as any).restaurantId as string);
}

/** Aggregates 30 days of business data into a compact snapshot for the LLM. */
async function buildSnapshot(rid: mongoose.Types.ObjectId) {
  const restaurant = await Restaurant.findById(rid).lean();
  if (!restaurant) throw new AppError('Restaurant not found', 404);
  const tz = restaurant.settings?.timezone || 'Asia/Kathmandu';
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  const since30 = new Date(now.getTime() - 30 * dayMs);

  const [daily, items, hours, payments, sessionStats, cancelStats] = await Promise.all([
    Bill.aggregate([
      { $match: { restaurantId: rid, status: 'paid', paidAt: { $gte: since30 } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$paidAt', timezone: tz } },
          revenue: { $sum: '$total' },
          bills: { $sum: 1 },
          avgBill: { $avg: '$total' },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Order.aggregate([
      { $match: { restaurantId: rid, status: { $ne: 'cancelled' }, createdAt: { $gte: since30 } } },
      { $unwind: '$items' },
      { $match: { 'items.status': { $ne: 'cancelled' } } },
      {
        $group: {
          _id: '$items.menuItemId',
          name: { $first: '$items.name' },
          unitPrice: { $first: '$items.price' },
          qtySold: { $sum: '$items.qty' },
          revenue: { $sum: { $multiply: ['$items.price', '$items.qty'] } },
        },
      },
      { $sort: { revenue: -1 } },
      { $project: { _id: 0, name: 1, unitPrice: 1, qtySold: 1, revenue: 1 } },
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
    TableSession.aggregate([
      { $match: { restaurantId: rid, status: 'closed', openedAt: { $gte: since30 } } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          avgDurationMin: { $avg: { $divide: [{ $subtract: ['$closedAt', '$openedAt'] }, 60000] } },
          avgGuests: { $avg: '$guestCount' },
        },
      },
    ]),
    Order.aggregate([
      { $match: { restaurantId: rid, createdAt: { $gte: since30 } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
        },
      },
    ]),
  ]);

  const [ratingAgg, recentComments] = await Promise.all([
    TableSession.aggregate([
      { $match: { restaurantId: rid, rating: { $gte: 1 }, ratedAt: { $gte: since30 } } },
      { $group: { _id: null, avgRating: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]),
    TableSession.find({ restaurantId: rid, feedback: { $exists: true, $ne: '' }, ratedAt: { $gte: since30 } })
      .select('rating feedback')
      .sort({ ratedAt: -1 })
      .limit(5)
      .lean(),
  ]);

  // Weekly buckets (4 full weeks, oldest → newest) for trend analysis
  const weekly: { week: string; revenue: number; bills: number }[] = [];
  for (let w = 3; w >= 0; w--) {
    const start = new Date(now.getTime() - (w + 1) * 7 * dayMs);
    const end = new Date(now.getTime() - w * 7 * dayMs);
    const inWeek = daily.filter((d: any) => {
      const dt = new Date(d._id);
      return dt >= start && dt < end;
    });
    weekly.push({
      week: `${start.toISOString().slice(0, 10)} to ${end.toISOString().slice(0, 10)}`,
      revenue: inWeek.reduce((a: number, d: any) => a + d.revenue, 0),
      bills: inWeek.reduce((a: number, d: any) => a + d.bills, 0),
    });
  }

  const sess = sessionStats[0] || { count: 0, avgDurationMin: 0, avgGuests: null };
  const cancels = cancelStats[0] || { total: 0, cancelled: 0 };
  const totalRevenue = daily.reduce((a: number, d: any) => a + d.revenue, 0);

  return {
    restaurant: {
      name: restaurant.name,
      currency: restaurant.settings?.currency || 'NPR',
      vatRatePct: restaurant.settings?.vatRate ?? 13,
      plan: restaurant.subscription?.plan,
    },
    periodDays: 30,
    totals: {
      revenue: totalRevenue,
      bills: daily.reduce((a: number, d: any) => a + d.bills, 0),
      avgSessionDurationMin: Math.round(sess.avgDurationMin || 0),
      avgGuestsPerSession: sess.avgGuests ? Math.round(sess.avgGuests * 10) / 10 : null,
      orderCancellationRatePct: cancels.total ? Math.round((cancels.cancelled / cancels.total) * 1000) / 10 : 0,
    },
    weeklyTrend: weekly,
    dailyRevenue: daily.map((d: any) => ({ date: d._id, revenue: d.revenue, bills: d.bills })),
    menuItems: items, // full list with unitPrice, qtySold, revenue — for menu engineering
    sessionsByHour: hours.map((h: any) => ({ hour: h._id, sessions: h.sessions })),
    paymentMix: payments.map((p: any) => ({ method: p._id ?? 'unknown', amount: p.amount, bills: p.count })),
    guestFeedback: {
      avgRating: ratingAgg[0] ? Math.round(ratingAgg[0].avgRating * 10) / 10 : null,
      ratingsCount: ratingAgg[0]?.count ?? 0,
      recentComments: recentComments.map((c: any) => ({ rating: c.rating, comment: c.feedback })),
    },
    inventory: await (async () => {
      // Rule-based inventory feeds the analyst too: what's scarce, what's dead money
      const inv = await getInventoryOverview(rid);
      if (!inv.counts.totalIngredients) return null;
      return {
        lowStockIngredients: inv.ingredients.filter((i) => i.status === 'low').map((i) => i.name),
        outOfStockIngredients: inv.ingredients.filter((i) => i.status === 'out').map((i) => i.name),
        dishesCurrentlyUnavailable: inv.items.filter((i) => i.autoUnavailable).map((i) => i.name),
        lowestServingDishes: inv.items
          .filter((i) => typeof i.servingsPossible === 'number')
          .sort((a, b) => (a.servingsPossible as number) - (b.servingsPossible as number))
          .slice(0, 5)
          .map((i) => ({ dish: i.name, servingsLeft: i.servingsPossible, bottleneck: i.limitingIngredient })),
      };
    })(),
  };
}

// POST /api/ai/reports — generate a new AI business report
export async function generateReport(req: AuthRequest, res: Response): Promise<void> {
  const rid = ridOf(req);

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const usedToday = await AiReport.countDocuments({ restaurantId: rid, createdAt: { $gte: todayStart } });
  if (usedToday >= MAX_REPORTS_PER_DAY) {
    throw new AppError(`Daily limit reached (${MAX_REPORTS_PER_DAY} reports). Try again tomorrow.`, 429);
  }

  // Keys are select:false — pull them explicitly, never send them to the client
  const withKeys = await Restaurant.findById(rid)
    .select('+settings.ai.geminiApiKey +settings.ai.groqApiKey')
    .lean();
  if (!withKeys) throw new AppError('Restaurant not found', 404);
  const ai = withKeys.settings?.ai;

  const snapshot = await buildSnapshot(rid);
  if (!snapshot.totals.bills) {
    throw new AppError('Not enough data yet — settle some bills first, then generate a report.', 400);
  }

  const { content, provider, model } = await generateBusinessReport(
    snapshot,
    (ai?.provider as AiProvider) || 'groq',
    { geminiApiKey: openSecret(ai?.geminiApiKey), groqApiKey: openSecret(ai?.groqApiKey) }
  );

  const report = await AiReport.create({
    restaurantId: rid,
    provider,
    model,
    periodDays: 30,
    snapshot,
    content,
    generatedBy: req.user!._id,
  });

  res.status(201).json({
    success: true,
    report: { _id: report._id, provider, model, content, createdAt: report.createdAt },
    remainingToday: MAX_REPORTS_PER_DAY - usedToday - 1,
  });
}

// POST /api/ai/chat — conversational Q&A over the live business snapshot
export async function chat(req: AuthRequest, res: Response): Promise<void> {
  const rid = ridOf(req);

  const { messages } = req.body as { messages: ChatMessage[] };
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new AppError('messages array is required', 400);
  }
  const trimmed = messages.slice(-10); // bound the context we forward
  for (const m of trimmed) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') {
      throw new AppError('Each message needs role (user|assistant) and string content', 400);
    }
    if (m.content.length > 1000) throw new AppError('Messages are limited to 1000 characters', 400);
  }
  if (trimmed[trimmed.length - 1].role !== 'user') {
    throw new AppError('Last message must be from the user', 400);
  }

  if (bumpChatCounter(String(rid)) > MAX_CHATS_PER_DAY) {
    throw new AppError(`Daily chat limit reached (${MAX_CHATS_PER_DAY} messages). Try again tomorrow.`, 429);
  }

  const withKeys = await Restaurant.findById(rid)
    .select('+settings.ai.geminiApiKey +settings.ai.groqApiKey')
    .lean();
  if (!withKeys) throw new AppError('Restaurant not found', 404);
  const ai = withKeys.settings?.ai;

  const snapshot = await buildSnapshot(rid);
  const { answer, provider } = await chatWithAnalyst(
    snapshot,
    trimmed,
    (ai?.provider as AiProvider) || 'groq',
    { geminiApiKey: openSecret(ai?.geminiApiKey), groqApiKey: openSecret(ai?.groqApiKey) }
  );

  res.json({ success: true, answer, provider });
}

// GET /api/ai/reports — history (no snapshots, they're heavy)
export async function listReports(req: AuthRequest, res: Response): Promise<void> {
  const rid = ridOf(req);
  const reports = await AiReport.find({ restaurantId: rid })
    .select('-snapshot')
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();
  res.json({ success: true, reports });
}

// GET /api/ai/reports/:id
export async function getReport(req: AuthRequest, res: Response): Promise<void> {
  const rid = ridOf(req);
  if (!mongoose.isValidObjectId(req.params.id)) throw new AppError('Invalid report id', 400);
  const report = await AiReport.findOne({ _id: req.params.id, restaurantId: rid }).select('-snapshot').lean();
  if (!report) throw new AppError('Report not found', 404);
  res.json({ success: true, report });
}
