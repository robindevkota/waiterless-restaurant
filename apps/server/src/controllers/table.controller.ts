import { Response } from 'express';
import crypto from 'crypto';
import QRCode from 'qrcode';
import { AuthRequest } from '../middleware/authenticate';
import Table from '../models/Table';
import Restaurant from '../models/Restaurant';
import { AppError } from '../middleware/errorHandler';
import { assertPlanLimit } from '../utils/planLimits';

function generateQrToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

// GET /api/tables
export async function listTables(req: AuthRequest, res: Response): Promise<void> {
  const rid = (req as any).restaurantId;
  const tables = await Table.find({ restaurantId: rid })
    .populate('currentSessionId', 'status openedAt')
    .sort({ zone: 1, label: 1 })
    .lean();
  res.json({ success: true, tables });
}

// POST /api/tables
export async function createTable(req: AuthRequest, res: Response): Promise<void> {
  const rid = (req as any).restaurantId;
  const { label, capacity, zone } = req.body;
  if (!label) throw new AppError('Table label is required', 400);

  const restaurant = await Restaurant.findById(rid).select('subscription').lean();
  if (!restaurant) throw new AppError('Restaurant not found', 404);
  const count = await Table.countDocuments({ restaurantId: rid });
  await assertPlanLimit(restaurant.subscription.plan, 'tables', count);

  const duplicate = await Table.findOne({ restaurantId: rid, label: String(label).trim() }).lean();
  if (duplicate) throw new AppError(`A table labelled "${String(label).trim()}" already exists`, 409);

  const qrToken = generateQrToken();
  const table = await Table.create({ restaurantId: rid, label, zone, capacity, qrToken });
  res.status(201).json({ success: true, table });
}

// POST /api/tables/bulk — "generate G1–G10" helper. Labels stay unique across
// the restaurant (never per zone); existing labels are skipped, not overwritten.
export async function bulkCreateTables(req: AuthRequest, res: Response): Promise<void> {
  const rid = (req as any).restaurantId;
  const { prefix, from, to, zone, capacity } = req.body;

  const start = Number(from), end = Number(to);
  if (typeof prefix !== 'string' || !prefix.trim()) throw new AppError('prefix is required (e.g. "G")', 400);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) {
    throw new AppError('from/to must be positive integers with to ≥ from', 400);
  }
  if (end - start + 1 > 50) throw new AppError('Cannot generate more than 50 tables at once', 400);

  const labels = Array.from({ length: end - start + 1 }, (_, i) => `${prefix.trim()}${start + i}`);
  const existing = await Table.find({ restaurantId: rid, label: { $in: labels } }).select('label').lean();
  const taken = new Set(existing.map((t) => t.label));
  const toCreate = labels.filter((l) => !taken.has(l));

  const restaurant = await Restaurant.findById(rid).select('subscription').lean();
  if (!restaurant) throw new AppError('Restaurant not found', 404);
  const count = await Table.countDocuments({ restaurantId: rid });
  // Plan limit must hold for the whole batch, not just the first table
  await assertPlanLimit(restaurant.subscription.plan, 'tables', count + toCreate.length - 1);

  const tables = await Table.insertMany(toCreate.map((label) => ({
    restaurantId: rid, label, zone, capacity, qrToken: generateQrToken(),
  })));

  res.status(201).json({ success: true, created: tables.length, skipped: labels.length - toCreate.length, tables });
}

// PATCH /api/tables/:id
export async function updateTable(req: AuthRequest, res: Response): Promise<void> {
  const rid = (req as any).restaurantId;
  const $set: Record<string, unknown> = {};
  if (req.body.label !== undefined) $set.label = req.body.label;
  if (req.body.capacity !== undefined) $set.capacity = req.body.capacity;
  if (req.body.zone !== undefined) $set.zone = req.body.zone;
  if ($set.label !== undefined) {
    const duplicate = await Table.findOne({
      restaurantId: rid, label: String($set.label).trim(), _id: { $ne: req.params.id },
    }).lean();
    if (duplicate) throw new AppError(`A table labelled "${String($set.label).trim()}" already exists`, 409);
  }
  const table = await Table.findOneAndUpdate(
    { _id: req.params.id, restaurantId: rid },
    { $set },
    { new: true }
  );
  if (!table) throw new AppError('Table not found', 404);
  res.json({ success: true, table });
}

// DELETE /api/tables/:id
export async function deleteTable(req: AuthRequest, res: Response): Promise<void> {
  const rid = (req as any).restaurantId;
  const table = await Table.findOne({ _id: req.params.id, restaurantId: rid });
  if (!table) throw new AppError('Table not found', 404);
  if (table.currentSessionId) throw new AppError('Cannot delete a table with an active session', 400);
  await table.deleteOne();
  res.json({ success: true, message: 'Table deleted' });
}

// GET /api/tables/:id/qr  — returns QR as base64 PNG data URL
export async function getTableQr(req: AuthRequest, res: Response): Promise<void> {
  const rid = (req as any).restaurantId;
  const table = await Table.findOne({ _id: req.params.id, restaurantId: rid }).lean();
  if (!table) throw new AppError('Table not found', 404);

  const restaurant = await Restaurant.findById(rid).select('slug').lean();
  if (!restaurant) throw new AppError('Restaurant not found', 404);

  const qrUrl = `${process.env.CLIENT_URL}/r/${restaurant.slug}/table/${table.qrToken}`;
  const qrDataUrl = await QRCode.toDataURL(qrUrl, { width: 400, margin: 2 });

  res.json({ success: true, qrUrl, qrDataUrl, tableLabel: table.label });
}

// POST /api/tables/:id/qr/regenerate
export async function regenerateQr(req: AuthRequest, res: Response): Promise<void> {
  const rid = (req as any).restaurantId;
  const table = await Table.findOne({ _id: req.params.id, restaurantId: rid });
  if (!table) throw new AppError('Table not found', 404);
  if (table.currentSessionId) throw new AppError('Cannot regenerate QR while session is active', 400);

  table.qrToken = generateQrToken();
  await table.save();

  const restaurant = await Restaurant.findById(rid).select('slug').lean();
  if (!restaurant) throw new AppError('Restaurant not found', 404);

  const qrUrl = `${process.env.CLIENT_URL}/r/${restaurant.slug}/table/${table.qrToken}`;
  const qrDataUrl = await QRCode.toDataURL(qrUrl, { width: 400, margin: 2 });

  res.json({ success: true, qrUrl, qrDataUrl, tableLabel: table.label });
}
