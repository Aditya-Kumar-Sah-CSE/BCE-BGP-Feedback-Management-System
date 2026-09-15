import type { PlanType } from '@/types/database';

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

// ====================================================================
// STATUS/TYPE CONSTANTS (NOT pricing — pricing comes from DB)
// ====================================================================

export const ACCESS_STATUSES = ['LOCKED', 'UNLOCKED'] as const;
export const SUBSCRIPTION_STATUSES = ['ACTIVE', 'EXPIRED', 'CANCELLED', 'PENDING'] as const;
export const PLAN_TYPES: PlanType[] = ['FREE', 'MONTHLY', 'YEARLY'];
