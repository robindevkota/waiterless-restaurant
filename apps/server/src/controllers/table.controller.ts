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
    .sort({ label: 1 })
    .lean();
  res.json({ success: true, tables });
}

// POST /api/tables
export async function createTable(req: AuthRequest, res: Response): Promise<void> {
  const rid = (req as any).restaurantId;
  const { label, capacity } = req.body;
  if (!label) throw new AppError('Table label is required', 400);

  const restaurant = await Restaurant.findById(rid).select('subscription').lean();
  if (!restaurant) throw new AppError('Restaurant not found', 404);
  const count = await Table.countDocuments({ restaurantId: rid });
  await assertPlanLimit(restaurant.subscription.plan, 'tables', count);

  const qrToken = generateQrToken();
  const table = await Table.create({ restaurantId: rid, label, capacity, qrToken });
  res.status(201).json({ success: true, table });
}

// PATCH /api/tables/:id
export async function updateTable(req: AuthRequest, res: Response): Promise<void> {
  const rid = (req as any).restaurantId;
  const table = await Table.findOneAndUpdate(
    { _id: req.params.id, restaurantId: rid },
    { $set: { label: req.body.label, capacity: req.body.capacity } },
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
