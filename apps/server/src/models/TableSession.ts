import mongoose, { Document, Schema } from 'mongoose';
import type { SessionStatus } from '@waiterless/types';

export interface ITableSession extends Document {
  restaurantId: mongoose.Types.ObjectId;
  tableId: mongoose.Types.ObjectId;
  status: SessionStatus;
  openedBy: mongoose.Types.ObjectId;   // cashier userId
  closedBy?: mongoose.Types.ObjectId;  // cashier or owner userId
  openedAt: Date;
  closedAt?: Date;
  guestCount?: number;
  orders: mongoose.Types.ObjectId[];
  billId?: mongoose.Types.ObjectId;
  rating?: number;      // 1-5, guest feedback after payment
  feedback?: string;
  ratedAt?: Date;
  // Guest tapped "I've paid" — advisory only; the cashier verifies on their
  // merchant app and settles. Never flips bill status by itself.
  paidClaimedAt?: Date;
  paidClaimAmount?: number;
  createdAt: Date;
  updatedAt: Date;
}

const TableSessionSchema = new Schema<ITableSession>(
  {
    restaurantId: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
    tableId:      { type: Schema.Types.ObjectId, ref: 'Table', required: true },
    status:       { type: String, enum: ['open', 'closed'], default: 'open' },
    openedBy:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
    closedBy:     { type: Schema.Types.ObjectId, ref: 'User' },
    openedAt:     { type: Date, default: () => new Date() },
    closedAt:     { type: Date },
    guestCount:   { type: Number },
    orders:       [{ type: Schema.Types.ObjectId, ref: 'Order' }],
    billId:       { type: Schema.Types.ObjectId, ref: 'Bill' },
    rating:       { type: Number, min: 1, max: 5 },
    feedback:     { type: String, maxlength: 500, trim: true },
    ratedAt:      { type: Date },
    paidClaimedAt:   { type: Date },
    paidClaimAmount: { type: Number },
  },
  { timestamps: true }
);

// Index for finding open sessions quickly
TableSessionSchema.index({ restaurantId: 1, status: 1 });

export default mongoose.model<ITableSession>('TableSession', TableSessionSchema);
