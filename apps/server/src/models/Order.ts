import mongoose, { Document, Schema } from 'mongoose';
import type { OrderItemStatus, OrderStatus } from '@waiterless/types';

export interface IOrderItem {
  _id: mongoose.Types.ObjectId;
  menuItemId: mongoose.Types.ObjectId;
  name: string;       // snapshot at order time
  price: number;      // snapshot at order time
  qty: number;
  note?: string;
  status: OrderItemStatus;
  viaUpsell?: boolean; // added from a "goes well with" suggestion chip
}

export interface IOrder extends Document {
  restaurantId: mongoose.Types.ObjectId;
  sessionId: mongoose.Types.ObjectId;
  tableId: mongoose.Types.ObjectId;
  items: IOrderItem[];
  status: OrderStatus;
  placedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema = new Schema<IOrderItem>(
  {
    menuItemId: { type: Schema.Types.ObjectId, ref: 'MenuItem', required: true },
    name:       { type: String, required: true },   // immutable snapshot
    price:      { type: Number, required: true },   // immutable snapshot
    qty:        { type: Number, required: true, min: 1 },
    note:       { type: String, maxlength: 200 },
    status:     {
      type: String,
      enum: ['pending', 'preparing', 'ready', 'served', 'cancelled'],
      default: 'pending',
    },
    viaUpsell:  { type: Boolean, default: false },
  },
  { _id: true }
);

const OrderSchema = new Schema<IOrder>(
  {
    restaurantId: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
    sessionId:    { type: Schema.Types.ObjectId, ref: 'TableSession', required: true, index: true },
    tableId:      { type: Schema.Types.ObjectId, ref: 'Table', required: true },
    items:        { type: [OrderItemSchema], required: true },
    status:       {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'cancelled'],
      default: 'pending',
    },
    placedAt:     { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

// Kitchen display: active orders for a restaurant
OrderSchema.index({ restaurantId: 1, status: 1 });

export default mongoose.model<IOrder>('Order', OrderSchema);
