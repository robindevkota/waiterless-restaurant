import mongoose, { Document, Schema } from 'mongoose';

export type StockLogType = 'restock' | 'sale' | 'adjustment' | 'seed';

export interface IStockLog extends Document {
  restaurantId: mongoose.Types.ObjectId;
  ingredientId: mongoose.Types.ObjectId;
  type: StockLogType;
  qty: number;               // positive = added, negative = deducted
  stockAfter: number;
  note?: string;
  orderId?: mongoose.Types.ObjectId;   // for sale deductions
  byUser?: mongoose.Types.ObjectId;    // for restock/adjustment
  createdAt: Date;
}

const StockLogSchema = new Schema<IStockLog>(
  {
    restaurantId: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
    ingredientId: { type: Schema.Types.ObjectId, ref: 'Ingredient', required: true },
    type:         { type: String, enum: ['restock', 'sale', 'adjustment', 'seed'], required: true },
    qty:          { type: Number, required: true },
    stockAfter:   { type: Number, required: true },
    note:         { type: String, trim: true, maxlength: 300 },
    orderId:      { type: Schema.Types.ObjectId, ref: 'Order' },
    byUser:       { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

StockLogSchema.index({ restaurantId: 1, createdAt: -1 });

export default mongoose.model<IStockLog>('StockLog', StockLogSchema);
