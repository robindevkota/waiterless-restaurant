import mongoose, { Document, Schema } from 'mongoose';
import type { BillLineItem, BillStatus, PaymentMethod } from '@waiterless/types';

export interface IBill extends Document {
  restaurantId: mongoose.Types.ObjectId;
  sessionId: mongoose.Types.ObjectId;
  lineItems: BillLineItem[];   // immutable snapshot of all ordered items
  subtotal: number;
  vatRate: number;             // snapshotted from restaurant settings at bill creation
  vatAmount: number;
  total: number;
  paymentMethod?: PaymentMethod;
  paymentReference?: string;   // eSewa txn ID, Khalti ref, bank UTR — entered by cashier
  status: BillStatus;
  paidAt?: Date;
  processedBy?: mongoose.Types.ObjectId; // cashier or owner userId
  createdAt: Date;
  updatedAt: Date;
}

const LineItemSchema = new Schema<BillLineItem>(
  {
    menuItemId: { type: String, required: true },
    name:       { type: String, required: true },
    qty:        { type: Number, required: true },
    unitPrice:  { type: Number, required: true },
    subtotal:   { type: Number, required: true },
  },
  { _id: false }
);

const BillSchema = new Schema<IBill>(
  {
    restaurantId:     { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
    sessionId:        { type: Schema.Types.ObjectId, ref: 'TableSession', required: true, unique: true },
    lineItems:        { type: [LineItemSchema], required: true },
    subtotal:         { type: Number, required: true },
    vatRate:          { type: Number, required: true },
    vatAmount:        { type: Number, required: true },
    total:            { type: Number, required: true },
    paymentMethod:    { type: String, enum: ['cash', 'esewa', 'khalti', 'mobile_banking', 'split'] },
    paymentReference: { type: String, trim: true },
    status:           { type: String, enum: ['open', 'paid'], default: 'open' },
    paidAt:           { type: Date },
    processedBy:      { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export default mongoose.model<IBill>('Bill', BillSchema);
