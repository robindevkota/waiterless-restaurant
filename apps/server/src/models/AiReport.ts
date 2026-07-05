import mongoose, { Document, Schema } from 'mongoose';
import type { AiProvider, AiReportContent } from '@waiterless/types';

// Omit<Document, 'model'> — our 'model' field (LLM model id) shadows Document.model()
export interface IAiReport extends Omit<Document, 'model'> {
  restaurantId: mongoose.Types.ObjectId;
  provider: AiProvider;
  model: string;
  periodDays: number;
  snapshot: Record<string, unknown>;   // the business data sent to the LLM
  content: AiReportContent;            // the structured report it returned
  generatedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AiReportSchema = new Schema<IAiReport>(
  {
    restaurantId: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
    provider:     { type: String, enum: ['gemini', 'groq'], required: true },
    model:        { type: String, required: true },
    periodDays:   { type: Number, default: 30 },
    snapshot:     { type: Schema.Types.Mixed, required: true },
    content:      { type: Schema.Types.Mixed, required: true },
    generatedBy:  { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

AiReportSchema.index({ restaurantId: 1, createdAt: -1 });

export default mongoose.model<IAiReport>('AiReport', AiReportSchema);
