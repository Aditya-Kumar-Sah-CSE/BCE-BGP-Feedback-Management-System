import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { SUPER_ADMIN_EMAIL } from '@/lib/auth/admin-auth';
import type { PlanType } from '@/types/database';
import type { BillingStatus, FormAccessResult, AnalyticsAccessResult } from './constants';

// Re-export for convenience — consumers can import from either file
export type { BillingStatus, FormAccessResult, AnalyticsAccessResult } from './constants';

// ====================================================================
// FEATURE HELPERS
// ====================================================================

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

// ====================================================================
// BILLING STATUS QUERY
// ====================================================================

/**
 * Read the billing state for a given admin (by admins.id).
 * Returns LOCKED if no billing record exists.
 * Queries dynamic features from billing_plans table by slug.
 */
export async function getAdminBillingStatus(adminId: string): Promise<BillingStatus> {
  const supabase = createAdminClient() || await createClient();

  const { data: billing } = await supabase
    .from('admin_billing_accounts')
    .select('*')
    .eq('admin_user_id', adminId)
    .maybeSingle();

  if (!billing) {
    return {
      isUnlocked: false,
      planType: 'FREE',
      accessStatus: 'LOCKED',
      subscriptionStatus: 'PENDING',
      expiresAt: null,
      startedAt: null,
      billingAccountId: null,
      isExpired: false,
      features: ['Google Form generation', 'Google Sheet integration', 'Basic analytics'],
      hasFullAnalytics: false,
    };
  }

  const now = new Date();
  const isExpired = billing.plan_type !== 'FREE'
    && billing.expires_at
    && new Date(billing.expires_at) < now;

  // If paid plan has expired, treat as LOCKED
  const effectiveAccessStatus = isExpired ? 'LOCKED' : billing.access_status;
  const effectiveSubStatus = isExpired ? 'EXPIRED' : billing.subscription_status;

  // Fetch live plan features from billing_plans
  let features: string[] = [];
  if (billing.plan_type) {
    const { data: planData } = await supabase
      .from('billing_plans')
      .select('features')
      .eq('slug', billing.plan_type)
      .maybeSingle();

    if (planData?.features && Array.isArray(planData.features)) {
      features = planData.features as string[];
    }
  }

  // Graceful fallback for standard plan types if billing_plans has not been seeded
  if (features.length === 0 && billing.plan_type) {
    if (billing.plan_type === 'FREE') {
      features = ['Google Form generation', 'Google Sheet integration', 'Basic analytics'];
    } else if (billing.plan_type === 'MONTHLY' || billing.plan_type === 'YEARLY') {
      features = ['Google Form generation', 'Google Sheet integration', 'Full analytics access', 'Priority support'];
    }
  }

  const hasFullAnalytics = effectiveAccessStatus === 'UNLOCKED' && !isExpired && planHasFeature(features, 'Full analytics access');

  return {
    isUnlocked: effectiveAccessStatus === 'UNLOCKED',
    planType: billing.plan_type as PlanType,
    accessStatus: effectiveAccessStatus as 'LOCKED' | 'UNLOCKED',
    subscriptionStatus: effectiveSubStatus,
    expiresAt: billing.expires_at || null,
    startedAt: billing.started_at || null,
    billingAccountId: billing.id,
    isExpired: !!isExpired,
    features,
    hasFullAnalytics,
  };
}

// ====================================================================
// CENTRALIZED FORM GENERATION ACCESS GATE
// ====================================================================

/**
 * THE ONE centralized authorization function for Google Form generation.
 *
 * Call this from EVERY form-generation path:
 * 1. validateAndPrepareFormDraftAction()
 * 2. POST /api/admin/forms/stream-generate
 *
 * Rules:
 * - Super Admin is ALWAYS allowed.
 * - Admin must be active.
 * - Admin must have UNLOCKED billing status.
 * - Paid plans must not be expired.
 * - FREE + UNLOCKED → allowed.
 */
export async function assertFormGenerationAccess(
  adminId: string | null | undefined,
  adminEmail: string | undefined,
  adminRole: string | undefined,
  adminStatus: string | undefined,
): Promise<FormAccessResult> {
  // 1. Must have a valid admin record
  if (!adminId) {
    return { allowed: false, reason: 'No admin record found. Please contact the Super Admin.' };
  }

  // 2. Must be active
  if (adminStatus !== 'ACTIVE') {
    return { allowed: false, reason: 'Your administrator account is inactive. Please contact the Super Admin.' };
  }

  // 3. Super Admin bypass — ALWAYS allowed
  const isSuperAdmin = adminRole === 'SUPER_ADMIN'
    || (adminEmail && adminEmail.toLowerCase().trim() === SUPER_ADMIN_EMAIL);

  if (isSuperAdmin) {
    return { allowed: true, reason: 'Super Admin access granted.' };
  }

  // 4. Check billing/access state
  const billingStatus = await getAdminBillingStatus(adminId);

  // 5. If expired paid plan, update database to reflect expiry
  if (billingStatus.isExpired && billingStatus.billingAccountId) {
    const supabase = createAdminClient() || await createClient();
    await supabase
      .from('admin_billing_accounts')
      .update({
        access_status: 'LOCKED',
        subscription_status: 'EXPIRED',
        updated_at: new Date().toISOString(),
      })
      .eq('id', billingStatus.billingAccountId);

    // Audit the expiry
    try {
      await supabase.from('audit_logs').insert({
        admin_id: adminId,
        actor_email: adminEmail || '',
        action: 'SUBSCRIPTION_EXPIRED',
        entity_type: 'admin_billing_accounts',
        entity_id: billingStatus.billingAccountId,
        details: `Paid plan (${billingStatus.planType}) expired for ${adminEmail}. Access automatically locked.`,
      });
    } catch {
      // Non-fatal
    }
  }

  // 6. Final access decision
  if (!billingStatus.isUnlocked) {
    return {
      allowed: false,
      reason: 'Google Form generation is currently locked. Please choose a plan and submit a payment request, or contact the Super Admin.',
      billingStatus,
    };
  }

  return { allowed: true, reason: 'Access granted.', billingStatus };
}

/**
 * Ensure a billing account exists for an admin.
 * Used when approving a new admin — creates LOCKED + FREE billing record.
 * For existing admins (grandfather), the migration sets UNLOCKED + FREE.
 */
export async function ensureBillingAccount(
  adminId: string,
  defaults?: { accessStatus?: 'LOCKED' | 'UNLOCKED'; planType?: PlanType }
): Promise<void> {
  const supabase = createAdminClient() || await createClient();

  const { data: existing } = await supabase
    .from('admin_billing_accounts')
    .select('id')
    .eq('admin_user_id', adminId)
    .maybeSingle();

  if (existing) return; // Already has a billing account

  await supabase
    .from('admin_billing_accounts')
    .insert({
      admin_user_id: adminId,
      plan_type: defaults?.planType || 'FREE',
      access_status: defaults?.accessStatus || 'LOCKED',
      subscription_status: defaults?.accessStatus === 'UNLOCKED' ? 'ACTIVE' : 'PENDING',
      started_at: defaults?.accessStatus === 'UNLOCKED' ? new Date().toISOString() : null,
    });
}

// ====================================================================
// CENTRALIZED ANALYTICS & RESULTS ACCESS GATE
// ====================================================================

/**
 * THE ONE centralized authorization function for Analytics & Results access.
 *
 * Call this from:
 * 1. getFormAnalyticsAction()
 * 2. getOverallAnalyticsAction()
 * 3. getFormResponsesAction()
 * 4. getResponseDetailAction()
 * 5. GET /api/admin/results/[id]/pdf
 * 6. GET /api/admin/results/export-pdf
 * 7. GET /api/admin/results/[id]/responses/[responseId]/pdf
 * 8. Server-side results pages
 *
 * Rules:
 * - Super Admin is ALWAYS allowed (full analytics access).
 * - Admin must be active.
 * - Admin must have UNLOCKED billing status and not expired.
 * - Plan features must contain "Full analytics access".
 * - Basic analytics alone => DENIED with code: "ANALYTICS_UPGRADE_REQUIRED".
 */
export async function assertAnalyticsAccess(
  adminId: string | null | undefined,
  adminEmail: string | undefined,
  adminRole: string | undefined,
  adminStatus: string | undefined,
): Promise<AnalyticsAccessResult> {
  // 1. Must have a valid admin record
  if (!adminId) {
    return {
      allowed: false,
      code: 'UNAUTHORIZED',
      reason: 'No admin record found. Please log in or contact the Super Admin.',
    };
  }

  // 2. Must be active
  if (adminStatus !== 'ACTIVE') {
    return {
      allowed: false,
      code: 'ACCOUNT_INACTIVE',
      reason: 'Your administrator account is inactive. Please contact the Super Admin.',
    };
  }

  // 3. Super Admin bypass — ALWAYS allowed
  const isSuperAdmin = adminRole === 'SUPER_ADMIN'
    || (adminEmail && adminEmail.toLowerCase().trim() === SUPER_ADMIN_EMAIL);

  if (isSuperAdmin) {
    return {
      allowed: true,
      reason: 'Super Admin access granted.',
    };
  }

  // 4. Check billing/access state
  const billingStatus = await getAdminBillingStatus(adminId);

  // 5. If expired paid plan, update database to reflect expiry
  if (billingStatus.isExpired && billingStatus.billingAccountId) {
    const supabase = createAdminClient() || await createClient();
    await supabase
      .from('admin_billing_accounts')
      .update({
        access_status: 'LOCKED',
        subscription_status: 'EXPIRED',
        updated_at: new Date().toISOString(),
      })
      .eq('id', billingStatus.billingAccountId);

    try {
      await supabase.from('audit_logs').insert({
        admin_id: adminId,
        actor_email: adminEmail || '',
        action: 'SUBSCRIPTION_EXPIRED',
        entity_type: 'admin_billing_accounts',
        entity_id: billingStatus.billingAccountId,
        details: `Paid plan (${billingStatus.planType}) expired for ${adminEmail}. Analytics access locked.`,
      });
    } catch {
      // Non-fatal
    }
  }

  // 6. Check unexpired & unlocked status
  if (!billingStatus.isUnlocked || billingStatus.isExpired) {
    return {
      allowed: false,
      code: 'ANALYTICS_UPGRADE_REQUIRED',
      reason: 'Your account is currently locked or your subscription has expired. Please choose a plan to unlock Full Analytics Access.',
      billingStatus,
    };
  }

  // 7. Check if plan features contain "Full analytics access"
  if (!billingStatus.hasFullAnalytics) {
    return {
      allowed: false,
      code: 'ANALYTICS_UPGRADE_REQUIRED',
      reason: 'Full Analytics Access is required to view results, charts, and export reports. Please upgrade your plan.',
      billingStatus,
    };
  }

  return {
    allowed: true,
    reason: 'Full analytics access granted.',
    billingStatus,
  };
}

/**
 * Convenience helper to check if an admin or session has analytics access.
 * Accepts either an AdminAuthResult (session) or individual parameters.
 */
export async function canAccessAnalytics(
  sessionOrAdminId: any,
  adminEmail?: string,
  adminRole?: string,
  adminStatus?: string
): Promise<boolean> {
  if (!sessionOrAdminId) return false;

  if (typeof sessionOrAdminId === 'object') {
    // Session object passed
    const session = sessionOrAdminId;
    if (session.isSuperAdmin) return true;
    if (!session.isAuthenticated || !session.isActive || !session.admin?.id) return false;
    const res = await assertAnalyticsAccess(
      session.admin.id,
      session.admin.email || session.user?.email,
      session.admin.role,
      session.admin.status
    );
    return res.allowed;
  }

  // Admin ID passed directly
  const res = await assertAnalyticsAccess(sessionOrAdminId, adminEmail, adminRole, adminStatus);
  return res.allowed;
}

