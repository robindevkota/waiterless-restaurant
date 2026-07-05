import { PLAN_LIMITS, SubscriptionPlan } from '@waiterless/types';
import { AppError } from '../middleware/errorHandler';

export async function assertPlanLimit(
  plan: SubscriptionPlan,
  resource: 'tables' | 'menuItems' | 'staff',
  currentCount: number
): Promise<void> {
  const limit = PLAN_LIMITS[plan][resource];
  if (currentCount >= limit) {
    throw new AppError(
      `Your ${plan} plan allows a maximum of ${limit} ${resource}. Please upgrade to add more.`,
      403
    );
  }
}
