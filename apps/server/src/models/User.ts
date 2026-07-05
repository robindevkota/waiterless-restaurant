import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import type { UserRole } from '@waiterless/types';

export interface IUser extends Document {
  restaurantId: mongoose.Types.ObjectId | null; // null for platform_admin
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  status: 'active' | 'suspended';
  inviteToken?: string;
  inviteExpiry?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(plain: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    restaurantId: { type: Schema.Types.ObjectId, ref: 'Restaurant', default: null },
    name:         { type: String, required: true, trim: true },
    email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role:         { type: String, enum: ['platform_admin', 'owner', 'cashier', 'kitchen'], required: true },
    status:       { type: String, enum: ['active', 'suspended'], default: 'active' },
    inviteToken:  { type: String },
    inviteExpiry: { type: Date },
  },
  { timestamps: true }
);

// Hash password before save
UserSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();
  this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
  next();
});

UserSchema.methods.comparePassword = function (plain: string): Promise<boolean> {
  return bcrypt.compare(plain, this.passwordHash);
};

// Never return passwordHash in JSON responses
UserSchema.set('toJSON', {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transform: (_doc: any, ret: any) => {
    ret.passwordHash = undefined;
    ret.inviteToken = undefined;
    return ret;
  },
});

export default mongoose.model<IUser>('User', UserSchema);
