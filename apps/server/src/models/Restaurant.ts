import mongoose, { Document, Schema } from 'mongoose';
import type { Branding, RestaurantSettings, SubscriptionPlan, SubscriptionStatus } from '@waiterless/types';

export interface ISubscription {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  trialEndsAt: Date;
  currentPeriodEnd: Date;
  notes?: string;
}

export interface IRestaurant extends Document {
  slug: string;
  name: string;
  ownerId: mongoose.Types.ObjectId;
  branding: Branding;
  subscription: ISubscription;
  settings: RestaurantSettings;
  createdAt: Date;
  updatedAt: Date;
}

const BrandingSchema = new Schema<Branding>({
  primaryColor:     { type: String, default: '#E85D04' },
  secondaryColor:   { type: String, default: '#1A1A2E' },
  accentColor:      { type: String, default: '#F5A623' },
  backgroundColor:  { type: String, default: '#FFFFFF' },
  fontFamily:       { type: String, default: 'Inter' },
  logoUrl:          { type: String },
  faviconUrl:       { type: String },
  restaurantName:   { type: String, required: true },
  tagline:          { type: String },
}, { _id: false });

const SubscriptionSchema = new Schema<ISubscription>({
  plan:             { type: String, enum: ['trial', 'basic', 'pro'], default: 'trial' },
  status:           { type: String, enum: ['active', 'past_due', 'blocked'], default: 'active' },
  trialEndsAt:      { type: Date, required: true },
  currentPeriodEnd: { type: Date, required: true },
  notes:            { type: String },
}, { _id: false });

const SettingsSchema = new Schema<RestaurantSettings>({
  currency:               { type: String, default: 'NPR' },
  vatRate:                { type: Number, default: 13 },
  timezone:               { type: String, default: 'Asia/Kathmandu' },
  allowGuestNotes:        { type: Boolean, default: true },
  autoCloseAfterMinutes:  { type: Number, default: 180 },
  ai: {
    provider:     { type: String, enum: ['gemini', 'groq'], default: 'groq' },
    // Never leave the server: excluded from queries unless explicitly selected
    geminiApiKey: { type: String, select: false },
    groqApiKey:   { type: String, select: false },
  },
}, { _id: false });

const RestaurantSchema = new Schema<IRestaurant>(
  {
    slug:         { type: String, required: true, unique: true, lowercase: true, trim: true },
    name:         { type: String, required: true, trim: true },
    ownerId:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
    branding:     { type: BrandingSchema, required: true },
    subscription: { type: SubscriptionSchema, required: true },
    settings:     { type: SettingsSchema, required: true, default: () => ({}) },
  },
  { timestamps: true }
);

export default mongoose.model<IRestaurant>('Restaurant', RestaurantSchema);
