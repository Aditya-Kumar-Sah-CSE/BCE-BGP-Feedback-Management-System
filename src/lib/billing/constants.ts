import type { PlanType, AdminTrialEntitlement, TrialStatus } from '@/types/database';

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
  features: string[];
  hasFullAnalytics: boolean;
  // Trial Entitlement info
  hasActiveTrial: boolean;
  activeTrial?: AdminTrialEntitlement | null;
  trialStatus?: 'NONE' | TrialStatus;
  trialExpiresAt?: string | null;
  trialDaysRemaining?: number | null;
}

export interface FormAccessResult {
  allowed: boolean;
  reason: string;
  code?: 'FORM_GENERATION_LOCKED' | 'UNAUTHORIZED' | 'ACCOUNT_INACTIVE';
  billingStatus?: BillingStatus;
}

export interface AnalyticsAccessResult {
  allowed: boolean;
  reason: string;
  code?: 'ANALYTICS_UPGRADE_REQUIRED' | 'UNAUTHORIZED' | 'ACCOUNT_INACTIVE';
  billingStatus?: BillingStatus;
}

// ====================================================================
// FEATURE VOCABULARY CONSTANTS
// ====================================================================

export const FEATURE_GOOGLE_FORM_GENERATION = 'Google Form generation';
export const FEATURE_GOOGLE_SHEET_INTEGRATION = 'Google Sheet integration';
export const FEATURE_FULL_ANALYTICS_ACCESS = 'Full analytics access';
export const FEATURE_BASIC_ANALYTICS = 'Basic analytics';
export const FEATURE_PRIORITY_SUPPORT = 'Priority support';

// ====================================================================
// STATUS/TYPE CONSTANTS (NOT pricing — pricing comes from DB)
// ====================================================================

export const ACCESS_STATUSES = ['LOCKED', 'UNLOCKED'] as const;
export const SUBSCRIPTION_STATUSES = ['ACTIVE', 'EXPIRED', 'CANCELLED', 'PENDING'] as const;
export const PLAN_TYPES: PlanType[] = ['FREE', 'MONTHLY', 'YEARLY'];

/**
 * Normalizes and tests whether a feature list contains a required feature.
 * Case-insensitive and whitespace-tolerant.
 */
export function planHasFeature(features: string[] | null | undefined, featureName: string): boolean {
  if (!features || !Array.isArray(features)) return false;
  const target = featureName.trim().toLowerCase();
  return features.some((f) => {
    const norm = String(f).trim().toLowerCase();
    return norm === target || norm.includes(target);
  });
}
