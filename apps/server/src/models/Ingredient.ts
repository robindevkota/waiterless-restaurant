import mongoose, { Document, Schema } from 'mongoose';

export type IngredientUnit = 'kg' | 'g' | 'litre' | 'ml' | 'piece' | 'packet' | 'bottle';
export type IngredientCategory = 'kitchen' | 'bar' | 'general';

export interface IIngredient extends Document {
  restaurantId: mongoose.Types.ObjectId;
  name: string;
  unit: IngredientUnit;
  stock: number;
  costPrice: number;          // NPR per unit
  lowStockThreshold: number;
  category: IngredientCategory;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const IngredientSchema = new Schema<IIngredient>(
  {
    restaurantId:      { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
    name:              { type: String, required: true, trim: true },
    unit:              { type: String, enum: ['kg', 'g', 'litre', 'ml', 'piece', 'packet', 'bottle'], required: true },
    stock:             { type: Number, required: true, min: 0, default: 0 },
    costPrice:         { type: Number, required: true, min: 0 },
    lowStockThreshold: { type: Number, required: true, min: 0, default: 0 },
    category:          { type: String, enum: ['kitchen', 'bar', 'general'], default: 'kitchen' },
    isActive:          { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Names unique per restaurant (case-sensitive is fine — owner-managed list)
IngredientSchema.index({ restaurantId: 1, name: 1 }, { unique: true });

export default mongoose.model<IIngredient>('Ingredient', IngredientSchema);
