import type { PlanType } from '@/types/database';

// ====================================================================
// CANONICAL SERVER-SIDE PRICING — NEVER TRUST BROWSER-SENT AMOUNTS
// ====================================================================

export const CANONICAL_PRICING: Record<PlanType, number> = {
  FREE: 0,
  MONTHLY: 2999,
  YEARLY: 29999,
} as const;

export const PLAN_LABELS: Record<PlanType, string> = {
  FREE: 'Free',
  MONTHLY: 'Monthly — ₹2,999/month',
  YEARLY: 'Yearly — ₹29,999/year',
} as const;

// ====================================================================
// BILLING STATUS TYPE
// ====================================================================

export interface BillingStatus {
  isUnlocked: boolean;
  planType: PlanType;
  accessStatus: 'LOCKED' | 'UNLOCKED';
  subscriptionStatus: string;
  expiresAt: string | null;
  startedAt: string | null;
  billingAccountId: string | null;
  isExpired: boolean;
}

export interface FormAccessResult {
  allowed: boolean;
  reason: string;
  billingStatus?: BillingStatus;
}
