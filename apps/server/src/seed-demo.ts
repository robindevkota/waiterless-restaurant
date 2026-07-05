/**
 * Generates 30 days of realistic order/bill history for the Golden Fork demo
 * restaurant so dashboards, reports and AI analysis have data to work with.
 * Idempotent-ish: clears previous demo history for the restaurant first.
 *
 * Run: npm run seed:demo (inside apps/server)
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import Restaurant from './models/Restaurant';
import User from './models/User';
import Table from './models/Table';
import MenuItem from './models/MenuItem';
import TableSession from './models/TableSession';
import Order from './models/Order';
import Bill from './models/Bill';

const DAY = 24 * 60 * 60 * 1000;
const PAYMENT_METHODS = ['cash', 'cash', 'cash', 'esewa', 'esewa', 'khalti', 'mobile_banking'] as const;

function rand(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick<T>(arr: readonly T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('Connected to MongoDB');

  const restaurant = await Restaurant.findOne({ slug: 'golden-fork' });
  if (!restaurant) throw new Error('Run npm run seed first — golden-fork not found');
  const rid = restaurant._id;

  const cashier = await User.findOne({ restaurantId: rid, role: 'cashier' });
  const tables = await Table.find({ restaurantId: rid });
  const menu = await MenuItem.find({ restaurantId: rid });
  if (!cashier || !tables.length || !menu.length) throw new Error('Seed data incomplete');

  await Promise.all([
    TableSession.deleteMany({ restaurantId: rid }),
    Order.deleteMany({ restaurantId: rid }),
    Bill.deleteMany({ restaurantId: rid }),
  ]);
  console.log('Cleared previous history for Golden Fork');

  // Popularity weights so top-items and menu engineering have signal:
  // momo and thali are stars; desserts drag.
  const weights = menu.map((m) => {
    const n = m.name.toLowerCase();
    if (n.includes('momo')) return 10;
    if (n.includes('thali') || n.includes('dal bhat')) return 7;
    if (n.includes('sekuwa') || n.includes('lassi')) return 5;
    if (n.includes('tea') || n.includes('curry')) return 4;
    if (n.includes('kheer') || n.includes('gulab')) return 1;
    return 3;
  });
  const weightedPick = () => {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < menu.length; i++) { r -= weights[i]; if (r <= 0) return menu[i]; }
    return menu[menu.length - 1];
  };

  const vatRate = restaurant.settings.vatRate ?? 13;
  let sessionCount = 0;
  let billTotal = 0;

  for (let dayOffset = 29; dayOffset >= 0; dayOffset--) {
    const dayStart = new Date(Date.now() - dayOffset * DAY);
    dayStart.setHours(0, 0, 0, 0);
    const weekday = dayStart.getDay(); // 0 Sun … 6 Sat
    const isWeekend = weekday === 5 || weekday === 6; // Fri/Sat busier in Nepal

    // Upward trend over the month + weekend bump + noise
    const base = 6 + Math.round((29 - dayOffset) * 0.15);
    const sessionsToday = Math.max(3, base + (isWeekend ? 4 : 0) + rand(-2, 2));

    for (let s = 0; s < sessionsToday; s++) {
      // Lunch (11–14) and dinner (18–21) peaks
      const hour = Math.random() < 0.4 ? rand(11, 14) : rand(18, 21);
      const openedAt = new Date(dayStart.getTime() + hour * 3600_000 + rand(0, 59) * 60_000);
      const durationMin = rand(35, 110);
      const closedAt = new Date(openedAt.getTime() + durationMin * 60_000);
      if (closedAt > new Date()) continue; // don't create future history

      const table = pick(tables);
      const session = await TableSession.create({
        restaurantId: rid,
        tableId: table._id,
        status: 'closed',
        openedBy: cashier._id,
        closedBy: cashier._id,
        openedAt,
        closedAt,
        guestCount: rand(1, 6),
        orders: [],
      });

      // 1–3 orders per session, 1–4 items per order
      const lineMap = new Map<string, { menuItemId: string; name: string; qty: number; unitPrice: number }>();
      const orderIds: mongoose.Types.ObjectId[] = [];
      const orderCount = rand(1, 3);
      for (let o = 0; o < orderCount; o++) {
        const items = Array.from({ length: rand(1, 4) }, () => {
          const mi = weightedPick();
          return { menuItemId: mi._id, name: mi.name, price: mi.price, qty: rand(1, 3), status: 'served' as const };
        });
        const order = await Order.create({
          restaurantId: rid,
          sessionId: session._id,
          tableId: table._id,
          items,
          status: 'completed',
          placedAt: new Date(openedAt.getTime() + o * rand(8, 20) * 60_000),
        });
        orderIds.push(order._id as mongoose.Types.ObjectId);
        for (const it of items) {
          const key = String(it.menuItemId);
          const line = lineMap.get(key);
          if (line) line.qty += it.qty;
          else lineMap.set(key, { menuItemId: key, name: it.name, qty: it.qty, unitPrice: it.price });
        }
      }

      const lineItems = Array.from(lineMap.values()).map((l) => ({ ...l, subtotal: l.qty * l.unitPrice }));
      const subtotal = lineItems.reduce((a, l) => a + l.subtotal, 0);
      const vatAmount = Math.round(subtotal * (vatRate / 100));
      const total = subtotal + vatAmount;

      const bill = await Bill.create({
        restaurantId: rid,
        sessionId: session._id,
        lineItems,
        subtotal,
        vatRate,
        vatAmount,
        total,
        paymentMethod: pick(PAYMENT_METHODS),
        status: 'paid',
        paidAt: closedAt,
        processedBy: cashier._id,
      });

      session.orders = orderIds;
      session.billId = bill._id as mongoose.Types.ObjectId;
      await session.save();

      sessionCount++;
      billTotal += total;
    }
  }

  console.log(`Created ${sessionCount} closed sessions with paid bills, NPR ${billTotal.toLocaleString()} total revenue over 30 days.`);
  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
