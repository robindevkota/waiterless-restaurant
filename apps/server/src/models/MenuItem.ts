import mongoose, { Document, Schema } from 'mongoose';
import type { MenuItemTag } from '@waiterless/types';

export interface IRecipeLine {
  ingredientId: mongoose.Types.ObjectId;
  qtyPerServing: number;     // in the ingredient's unit
}

export interface IMenuItem extends Document {
  restaurantId: mongoose.Types.ObjectId;
  categoryId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  available: boolean;
  deleted: boolean;          // soft-delete: hidden from menu but preserved in order history
  tags: MenuItemTag[];
  preparationTime?: number;  // minutes, shown to guest
  sortOrder: number;
  recipe: IRecipeLine[];     // inventory ratios; empty = untracked item
  autoUnavailable: boolean;  // true when auto-86'd by inventory (vs owner toggling manually)
  createdAt: Date;
  updatedAt: Date;
}

const MenuItemSchema = new Schema<IMenuItem>(
  {
    restaurantId:    { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
    categoryId:      { type: Schema.Types.ObjectId, ref: 'MenuCategory', required: true },
    name:            { type: String, required: true, trim: true },
    description:     { type: String, trim: true },
    price:           { type: Number, required: true, min: 0 },
    imageUrl:        { type: String },
    available:       { type: Boolean, default: true },
    deleted:         { type: Boolean, default: false },
    tags:            [{ type: String, enum: ['vegan', 'vegetarian', 'spicy', 'gluten_free', 'halal'] }],
    preparationTime: { type: Number },
    sortOrder:       { type: Number, default: 0 },
    recipe: {
      type: [
        {
          _id: false,
          ingredientId:  { type: Schema.Types.ObjectId, ref: 'Ingredient', required: true },
          qtyPerServing: { type: Number, required: true, min: 0 },
        },
      ],
      default: [],
    },
    autoUnavailable: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Guest menu queries only return available, non-deleted items
MenuItemSchema.index({ restaurantId: 1, deleted: 1, available: 1 });

export default mongoose.model<IMenuItem>('MenuItem', MenuItemSchema);
