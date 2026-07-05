import mongoose, { Document, Schema } from 'mongoose';

export interface IMenuCategory extends Document {
  restaurantId: mongoose.Types.ObjectId;
  name: string;
  sortOrder: number;
  icon?: string;
  createdAt: Date;
  updatedAt: Date;
}

const MenuCategorySchema = new Schema<IMenuCategory>(
  {
    restaurantId: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
    name:         { type: String, required: true, trim: true },
    sortOrder:    { type: Number, default: 0 },
    icon:         { type: String },
  },
  { timestamps: true }
);

// Category name unique within a restaurant
MenuCategorySchema.index({ restaurantId: 1, name: 1 }, { unique: true });

export default mongoose.model<IMenuCategory>('MenuCategory', MenuCategorySchema);
