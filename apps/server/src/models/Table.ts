import mongoose, { Document, Schema } from 'mongoose';
import type { TableStatus } from '@waiterless/types';

export interface ITable extends Document {
  restaurantId: mongoose.Types.ObjectId;
  label: string;           // e.g. "G7", "Patio 2" — unique across the restaurant, not per zone
  zone: string;            // e.g. "Ground floor" — soft grouping for filter tabs; '' = unzoned
  capacity: number;
  qrToken: string;         // signed token embedded in QR URL, regeneratable
  currentSessionId: mongoose.Types.ObjectId | null;
  status: TableStatus;
  createdAt: Date;
  updatedAt: Date;
}

const TableSchema = new Schema<ITable>(
  {
    restaurantId:      { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
    label:             { type: String, required: true, trim: true },
    zone:              { type: String, trim: true, default: '' },
    capacity:          { type: Number, default: 4 },
    qrToken:           { type: String, required: true, unique: true },
    currentSessionId:  { type: Schema.Types.ObjectId, ref: 'TableSession', default: null },
    status:            { type: String, enum: ['available', 'occupied', 'needs_attention'], default: 'available' },
  },
  { timestamps: true }
);

// Compound index: label must be unique within a restaurant
TableSchema.index({ restaurantId: 1, label: 1 }, { unique: true });

export default mongoose.model<ITable>('Table', TableSchema);
