import { Response } from 'express';
import { AuthRequest } from '../middleware/authenticate';
import Restaurant from '../models/Restaurant';
import { AppError } from '../middleware/errorHandler';
import { sealSecret } from '../utils/secretBox';

// GET /api/public/restaurant/:slug/branding — unauthenticated, for guest portal theming
export async function getPublicBranding(req: AuthRequest, res: Response): Promise<void> {
  const slug = String(req.params.slug || '').toLowerCase().trim();
  const restaurant = await Restaurant.findOne({ slug })
    .select('slug name branding subscription.status')
    .lean();
  if (!restaurant || restaurant.subscription.status === 'blocked') {
    throw new AppError('Restaurant not found', 404);
  }
  res.json({ success: true, slug: restaurant.slug, name: restaurant.name, branding: restaurant.branding });
}

// GET /api/restaurant/me
export async function getMyRestaurant(req: AuthRequest, res: Response): Promise<void> {
  const rid = (req as any).restaurantId;
  // Pull keys only to compute has-key flags; never include them in the response
  const restaurant = await Restaurant.findById(rid)
    .select('+settings.ai.geminiApiKey +settings.ai.groqApiKey')
    .lean();
  if (!restaurant) throw new AppError('Restaurant not found', 404);

  const ai = restaurant.settings?.ai as { provider?: string; geminiApiKey?: string; groqApiKey?: string } | undefined;
  const safe = {
    ...restaurant,
    settings: {
      ...restaurant.settings,
      ai: {
        provider: ai?.provider || 'groq',
        hasGeminiKey: Boolean(ai?.geminiApiKey || process.env.GEMINI_API_KEY),
        hasGroqKey: Boolean(ai?.groqApiKey || process.env.GROQ_API_KEY),
      },
    },
  };
  res.json({ success: true, restaurant: safe });
}

// PATCH /api/restaurant/me/branding
export async function updateBranding(req: AuthRequest, res: Response): Promise<void> {
  const rid = (req as any).restaurantId;
  const allowed = ['primaryColor','secondaryColor','accentColor','backgroundColor','fontFamily','logoUrl','faviconUrl','restaurantName','tagline'];
  const update: Record<string, string> = {};
  allowed.forEach((k) => { if (req.body[k] !== undefined) update[`branding.${k}`] = req.body[k]; });

  const restaurant = await Restaurant.findByIdAndUpdate(rid, { $set: update }, { new: true });
  if (!restaurant) throw new AppError('Restaurant not found', 404);
  res.json({ success: true, branding: restaurant.branding });
}

// PATCH /api/restaurant/me/settings
export async function updateSettings(req: AuthRequest, res: Response): Promise<void> {
  const rid = (req as any).restaurantId;
  const allowed = ['currency','vatRate','timezone','allowGuestNotes','autoCloseAfterMinutes'];
  const update: Record<string, unknown> = {};
  allowed.forEach((k) => { if (req.body[k] !== undefined) update[`settings.${k}`] = req.body[k]; });

  // AI settings: provider + write-only keys (empty string clears a key)
  const ai = req.body.ai;
  if (ai && typeof ai === 'object') {
    if (ai.provider !== undefined) {
      if (!['gemini', 'groq'].includes(ai.provider)) throw new AppError('ai.provider must be gemini or groq', 400);
      update['settings.ai.provider'] = ai.provider;
    }
    for (const keyField of ['geminiApiKey', 'groqApiKey'] as const) {
      if (ai[keyField] !== undefined) {
        if (typeof ai[keyField] !== 'string' || ai[keyField].length > 200) {
          throw new AppError(`ai.${keyField} must be a string`, 400);
        }
        const trimmed = ai[keyField].trim();
        update[`settings.ai.${keyField}`] = trimmed ? sealSecret(trimmed) : '';
      }
    }
  }

  const restaurant = await Restaurant.findByIdAndUpdate(rid, { $set: update }, { new: true });
  if (!restaurant) throw new AppError('Restaurant not found', 404);
  // settings.ai keys are select:false on reads, but this doc came from a write path —
  // rebuild a safe view rather than trusting it
  const raw: any = restaurant.settings;
  const s: any = raw?.toObject ? raw.toObject() : raw;
  const safeSettings = {
    ...s,
    ai: {
      provider: s?.ai?.provider || 'groq',
      hasGeminiKey: Boolean(s?.ai?.geminiApiKey || process.env.GEMINI_API_KEY),
      hasGroqKey: Boolean(s?.ai?.groqApiKey || process.env.GROQ_API_KEY),
    },
  };
  res.json({ success: true, settings: safeSettings });
}
