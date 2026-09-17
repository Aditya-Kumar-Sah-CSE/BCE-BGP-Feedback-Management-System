import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { SUPER_ADMIN_EMAIL } from '@/lib/auth/admin-auth';
import type { PlanType, AdminTrialEntitlement, TrialStatus } from '@/types/database';
import {
  FEATURE_GOOGLE_FORM_GENERATION,
  FEATURE_GOOGLE_SHEET_INTEGRATION,
  FEATURE_FULL_ANALYTICS_ACCESS,
  FEATURE_BASIC_ANALYTICS,
  FEATURE_PRIORITY_SUPPORT,
  planHasFeature,
  type BillingStatus,
  type FormAccessResult,
  type AnalyticsAccessResult,
} from './constants';

// Re-export for convenience — consumers can import from either file
export type { BillingStatus, FormAccessResult, AnalyticsAccessResult } from './constants';
export {
  FEATURE_GOOGLE_FORM_GENERATION,
  FEATURE_GOOGLE_SHEET_INTEGRATION,
  FEATURE_FULL_ANALYTICS_ACCESS,
  FEATURE_BASIC_ANALYTICS,
  FEATURE_PRIORITY_SUPPORT,
  planHasFeature,
} from './constants';

async function getAdminDb() {
  return createAdminClient() || await createClient();
}

// ====================================================================
// 1. TRIAL ENTITLEMENT ENGINE
// ====================================================================

/**
 * Reads the active trial entitlement for a given admin.
 * Evaluates against server/database time:
 * - status = 'ACTIVE'
 * - starts_at <= now
 * - now < expires_at
 *
 * If a trial is marked ACTIVE in DB but expires_at <= now,
 * lazily normalizes the status to 'EXPIRED' in DB, logs an audit record,
 * and returns null.
 */
export async function getActiveTrialEntitlement(adminId: string): Promise<AdminTrialEntitlement | null> {
  if (!adminId) return null;

  const supabase = await getAdminDb();
  const { data: trial, error } = await supabase
    .from('admin_trial_entitlements')
    .select('*')
    .eq('admin_id', adminId)
    .eq('status', 'ACTIVE')
    .maybeSingle();

  if (error || !trial) {
    return null;
  }

  const now = new Date();
  const startsAt = new Date(trial.starts_at);
  const expiresAt = new Date(trial.expires_at);

  // Lazy normalization if trial has expired
  if (expiresAt <= now) {
    try {
      await supabase
        .from('admin_trial_entitlements')
        .update({
          status: 'EXPIRED',
          updated_at: now.toISOString(),
        })
        .eq('id', trial.id)
        .eq('status', 'ACTIVE');

      await supabase.from('audit_logs').insert({
        admin_id: adminId,
        actor_email: 'system',
        action: 'TRIAL_EXPIRED',
        entity_type: 'admin_trial_entitlements',
        entity_id: trial.id,
        details: `Trial expired for admin ID ${adminId}. Valid from ${trial.starts_at} to ${trial.expires_at}.`,
      });
    } catch {
      // Non-fatal logging/update failure
    }
    return null;
  }

  // Not yet started (future trial)
  if (startsAt > now) {
    return null;
  }

  return trial as AdminTrialEntitlement;
}

/**
 * Checks if an admin currently has a valid active trial entitlement.
 */
export async function hasActiveTrial(adminId: string): Promise<boolean> {
  const trial = await getActiveTrialEntitlement(adminId);
  return trial !== null;
}

// ====================================================================
// 2. EFFECTIVE BILLING & TRIAL RESOLUTION
// ====================================================================

/**
 * Computes effective access & features by combining:
 * 1. FREE Base Plan (always available, provides Basic Analytics)
 * 2. Active Paid Subscription (if unlocked and unexpired)
 * 3. Active Trial Entitlement (if status = ACTIVE and not expired)
 *
 * Expired trials contribute ZERO access.
 * Expired paid plans contribute ZERO paid features and fall back to FREE.
 */
export async function getEffectiveBillingFeatures(adminId: string): Promise<{
  effectiveFeatures: string[];
  hasActiveTrial: boolean;
  activeTrial: AdminTrialEntitlement | null;
  billingAccount: any;
  planType: PlanType;
  isUnlocked: boolean;
  hasFullAnalytics: boolean;
  hasFormGeneration: boolean;
  hasSheetIntegration: boolean;
  trialStatus: 'NONE' | TrialStatus;
  trialExpiresAt: string | null;
  trialDaysRemaining: number | null;
}> {
  const supabase = await getAdminDb();
  const now = new Date();

  // 1. Fetch active trial
  const activeTrial = await getActiveTrialEntitlement(adminId);
  const hasActiveTrialBool = !!activeTrial;

  // If no active trial, check latest trial status for UI reporting (EXPIRED / REVOKED / NONE)
  let latestTrialStatus: 'NONE' | TrialStatus = hasActiveTrialBool ? 'ACTIVE' : 'NONE';
  let trialExpiresAt: string | null = activeTrial?.expires_at || null;

  if (!activeTrial) {
    const { data: latestTrial } = await supabase
      .from('admin_trial_entitlements')
      .select('status, expires_at')
      .eq('admin_id', adminId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestTrial) {
      latestTrialStatus = latestTrial.status as TrialStatus;
      trialExpiresAt = latestTrial.expires_at;
    }
  }

  // 2. Fetch billing account
  const { data: billing } = await supabase
    .from('admin_billing_accounts')
    .select('*')
    .eq('admin_user_id', adminId)
    .maybeSingle();

  const planType: PlanType = (billing?.plan_type as PlanType) || 'FREE';
  const isPaid = planType !== 'FREE';
  const isPaidExpired = isPaid && billing?.expires_at && new Date(billing.expires_at) < now;

  // Paid plan expiry auto-fallback to FREE
  if (isPaidExpired && billing?.id) {
    try {
      await supabase
        .from('admin_billing_accounts')
        .update({
          subscription_status: 'EXPIRED',
          updated_at: now.toISOString(),
        })
        .eq('id', billing.id);

      await supabase.from('audit_logs').insert({
        admin_id: adminId,
        actor_email: 'system',
        action: 'PLAN_EXPIRED',
        entity_type: 'admin_billing_accounts',
        entity_id: billing.id,
        details: `Paid subscription (${planType}) expired. Access automatically fell back to FREE base plan.`,
      });
    } catch {
      // Non-fatal
    }
  }

  // 3. Resolve plan features from DB
  let planFeatures: string[] = [FEATURE_BASIC_ANALYTICS]; // Default FREE base plan

  if (isPaid && !isPaidExpired && billing?.access_status === 'UNLOCKED') {
    const { data: planData } = await supabase
      .from('billing_plans')
      .select('features')
      .eq('slug', planType)
      .eq('is_active', true)
      .maybeSingle();

    if (planData?.features && Array.isArray(planData.features)) {
      planFeatures = planData.features as string[];
    } else {
      // Fallback for standard paid plans if DB is unseeded
      planFeatures = [
        FEATURE_GOOGLE_FORM_GENERATION,
        FEATURE_GOOGLE_SHEET_INTEGRATION,
        FEATURE_FULL_ANALYTICS_ACCESS,
        FEATURE_PRIORITY_SUPPORT,
      ];
    }
  } else {
    // FREE base plan features from DB
    const { data: freePlanData } = await supabase
      .from('billing_plans')
      .select('features')
      .eq('slug', 'FREE')
      .maybeSingle();

    if (freePlanData?.features && Array.isArray(freePlanData.features)) {
      planFeatures = freePlanData.features as string[];
    } else {
      planFeatures = [FEATURE_BASIC_ANALYTICS];
    }
  }

  // 4. Union of Plan Features + Active Trial Features
  const trialFeatures = (activeTrial?.features as string[]) || [];
  const combinedSet = new Set<string>([...planFeatures, ...trialFeatures]);
  const effectiveFeatures = Array.from(combinedSet);

  // 5. Capability flags
  const hasFormGeneration = planHasFeature(effectiveFeatures, FEATURE_GOOGLE_FORM_GENERATION);
  const hasSheetIntegration = planHasFeature(effectiveFeatures, FEATURE_GOOGLE_SHEET_INTEGRATION);
  const hasFullAnalytics = planHasFeature(effectiveFeatures, FEATURE_FULL_ANALYTICS_ACCESS);

  // Form access is UNLOCKED if the admin has form generation entitlement (via trial or paid plan)
  // or if explicitly UNLOCKED with free plan
  const isUnlocked = hasFormGeneration || billing?.access_status === 'UNLOCKED' || hasActiveTrialBool;

  // Calculate days remaining on active trial
  let trialDaysRemaining: number | null = null;
  if (activeTrial) {
    const diffMs = new Date(activeTrial.expires_at).getTime() - now.getTime();
    trialDaysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }

  return {
    effectiveFeatures,
    hasActiveTrial: hasActiveTrialBool,
    activeTrial,
    billingAccount: billing,
    planType,
    isUnlocked,
    hasFullAnalytics,
    hasFormGeneration,
    hasSheetIntegration,
    trialStatus: latestTrialStatus,
    trialExpiresAt,
    trialDaysRemaining,
  };
}

/**
 * Checks if a specific feature is available for the given admin.
 */
export async function hasBillingFeature(adminId: string, feature: string): Promise<boolean> {
  const { effectiveFeatures } = await getEffectiveBillingFeatures(adminId);
  return planHasFeature(effectiveFeatures, feature);
}

// ====================================================================
// 3. BILLING STATUS QUERY (Consumer-facing)
// ====================================================================

/**
 * Read the comprehensive billing state for a given admin (by admins.id).
 * Returns complete BillingStatus including active trial metadata.
 */
export async function getAdminBillingStatus(adminId: string): Promise<BillingStatus> {
  const {
    effectiveFeatures,
    hasActiveTrial: activeTrialPresent,
    activeTrial,
    billingAccount,
    planType,
    isUnlocked,
    hasFullAnalytics,
    trialStatus,
    trialExpiresAt,
    trialDaysRemaining,
  } = await getEffectiveBillingFeatures(adminId);

  const now = new Date();
  const isPaidExpired = planType !== 'FREE'
    && billingAccount?.expires_at
    && new Date(billingAccount.expires_at) < now;

  return {
    isUnlocked,
    planType,
    accessStatus: isUnlocked ? 'UNLOCKED' : 'LOCKED',
    subscriptionStatus: isPaidExpired ? 'EXPIRED' : (billingAccount?.subscription_status || 'ACTIVE'),
    expiresAt: billingAccount?.expires_at || null,
    startedAt: billingAccount?.started_at || null,
    billingAccountId: billingAccount?.id || null,
    isExpired: !!isPaidExpired,
    features: effectiveFeatures,
    hasFullAnalytics,
    hasActiveTrial: activeTrialPresent,
    activeTrial,
    trialStatus,
    trialExpiresAt,
    trialDaysRemaining,
  };
}

// ====================================================================
// 4. CENTRALIZED FORM GENERATION ACCESS GATE
// ====================================================================

/**
 * THE ONE centralized authorization function for Google Form generation.
 *
 * Rules:
 * - Super Admin is ALWAYS allowed.
 * - Admin must be active.
 * - FREE base plan does NOT include Google Form generation.
 * - Google Form generation is ALLOWED if:
 *   a) Active Trial includes "Google Form generation", OR
 *   b) Active Paid Plan includes "Google Form generation" (unlocked & unexpired).
 * - Otherwise DENIED.
 */
export async function assertFormGenerationAccess(
  adminId: string | null | undefined,
  adminEmail: string | undefined,
  adminRole: string | undefined,
  adminStatus: string | undefined,
): Promise<FormAccessResult> {
  // 1. Valid admin record check
  if (!adminId) {
    return { allowed: false, reason: 'No admin record found. Please contact the Super Admin.' };
  }

  // 2. Active status check
  if (adminStatus !== 'ACTIVE') {
    return { allowed: false, reason: 'Your administrator account is inactive. Please contact the Super Admin.' };
  }

  // 3. Super Admin bypass — ALWAYS allowed
  const isSuperAdmin = adminRole === 'SUPER_ADMIN'
    || (adminEmail && adminEmail.toLowerCase().trim() === SUPER_ADMIN_EMAIL);

  if (isSuperAdmin) {
    return { allowed: true, reason: 'Super Admin access granted.' };
  }

  // 4. Check effective billing & trial features
  const billingStatus = await getAdminBillingStatus(adminId);
  const hasFormGen = planHasFeature(billingStatus.features, FEATURE_GOOGLE_FORM_GENERATION);

  if (!hasFormGen) {
    return {
      allowed: false,
      code: 'FORM_GENERATION_LOCKED',
      reason: 'Google Form generation is locked on the FREE base plan. Please request a Free Trial from the Super Admin or upgrade to a paid plan.',
      billingStatus,
    };
  }

  return { allowed: true, reason: 'Access granted.', billingStatus };
}

/**
 * Convenience helper to check if an admin or session has form generation access.
 */
export async function canGenerateForms(
  sessionOrAdminId: any,
  adminEmail?: string,
  adminRole?: string,
  adminStatus?: string
): Promise<boolean> {
  if (!sessionOrAdminId) return false;

  if (typeof sessionOrAdminId === 'object') {
    const session = sessionOrAdminId;
    if (session.isSuperAdmin) return true;
    if (!session.isAuthenticated || !session.isActive || !session.admin?.id) return false;
    const res = await assertFormGenerationAccess(
      session.admin.id,
      session.admin.email || session.user?.email,
      session.admin.role,
      session.admin.status
    );
    return res.allowed;
  }

  const res = await assertFormGenerationAccess(sessionOrAdminId, adminEmail, adminRole, adminStatus);
  return res.allowed;
}

export interface SheetIntegrationAccessResult {
  allowed: boolean;
  reason?: string;
  code?: string;
  billingStatus?: BillingStatus;
}

/**
 * Authorization function for Google Sheet creation, integration, and response sync management.
 *
 * Rules:
 * - Super Admin is ALWAYS allowed.
 * - Admin must be active.
 * - Basic Analytics users CANNOT manage sheet sync or integrations.
 * - ALLOWED if:
 *   a) Active Trial includes "Google Sheet integration", OR
 *   b) Active Paid Plan includes "Google Sheet integration" (unlocked & unexpired).
 * - Otherwise DENIED.
 */
export async function assertSheetIntegrationAccess(
  adminId: string | null | undefined,
  adminEmail: string | undefined,
  adminRole: string | undefined,
  adminStatus: string | undefined,
): Promise<SheetIntegrationAccessResult> {
  if (!adminId) {
    return { allowed: false, reason: 'No admin record found. Please contact the Super Admin.' };
  }

  if (adminStatus !== 'ACTIVE') {
    return { allowed: false, reason: 'Your administrator account is inactive. Please contact the Super Admin.' };
  }

  const isSuperAdmin = adminRole === 'SUPER_ADMIN'
    || (adminEmail && adminEmail.toLowerCase().trim() === SUPER_ADMIN_EMAIL);

  if (isSuperAdmin) {
    return { allowed: true, reason: 'Super Admin access granted.' };
  }

  const billingStatus = await getAdminBillingStatus(adminId);
  const hasSheetIntegration = planHasFeature(billingStatus.features, FEATURE_GOOGLE_SHEET_INTEGRATION);

  if (!hasSheetIntegration) {
    return {
      allowed: false,
      code: 'SHEET_INTEGRATION_LOCKED',
      reason: 'Google Sheet integration & sync management is not included in the FREE plan. Please request a Free Trial from the Super Admin or upgrade to a paid plan.',
      billingStatus,
    };
  }

  return { allowed: true, reason: 'Access granted.', billingStatus };
}

/**
 * Convenience helper to check if an admin or session has sheet integration access.
 */
export async function canIntegrateSheets(
  sessionOrAdminId: any,
  adminEmail?: string,
  adminRole?: string,
  adminStatus?: string
): Promise<boolean> {
  if (!sessionOrAdminId) return false;

  if (typeof sessionOrAdminId === 'object') {
    const session = sessionOrAdminId;
    if (session.isSuperAdmin) return true;
    if (!session.isAuthenticated || !session.isActive || !session.admin?.id) return false;
    const res = await assertSheetIntegrationAccess(
      session.admin.id,
      session.admin.email || session.user?.email,
      session.admin.role,
      session.admin.status
    );
    return res.allowed;
  }

  const res = await assertSheetIntegrationAccess(sessionOrAdminId, adminEmail, adminRole, adminStatus);
  return res.allowed;
}

// ====================================================================
// 5. CENTRALIZED ANALYTICS & RESULTS ACCESS GATE
// ====================================================================

/**
 * THE ONE centralized authorization function for Analytics & Results access.
 *
 * Rules:
 * - Super Admin is ALWAYS allowed (full analytics access).
 * - Admin must be active.
 * - Basic Analytics users can view authorized Sheet/response data only.
 * - Full Analytics Access is required for charts, aggregates, metrics, and PDFs.
 * - Full Analytics is ALLOWED if:
 *   a) Active Trial includes "Full analytics access", OR
 *   b) Active Paid Plan includes "Full analytics access" (unlocked & unexpired).
 * - Otherwise DENIED with code: "ANALYTICS_UPGRADE_REQUIRED".
 */
export async function assertAnalyticsAccess(
  adminId: string | null | undefined,
  adminEmail: string | undefined,
  adminRole: string | undefined,
  adminStatus: string | undefined,
): Promise<AnalyticsAccessResult> {
  // 1. Valid admin record check
  if (!adminId) {
    return {
      allowed: false,
      code: 'UNAUTHORIZED',
      reason: 'No admin record found. Please log in or contact the Super Admin.',
    };
  }

  // 2. Active status check
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

  // 4. Check effective billing & trial features
  const billingStatus = await getAdminBillingStatus(adminId);

  // 5. Check if effective features contain Full analytics access
  if (!billingStatus.hasFullAnalytics) {
    return {
      allowed: false,
      code: 'ANALYTICS_UPGRADE_REQUIRED',
      reason: 'Full Analytics Access is required to view results, charts, and export reports. Please request a Free Trial or upgrade your plan.',
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

  const res = await assertAnalyticsAccess(sessionOrAdminId, adminEmail, adminRole, adminStatus);
  return res.allowed;
}

// ====================================================================
// 6. ENSURE BILLING ACCOUNT
// ====================================================================

/**
 * Ensure a billing account exists for an admin.
 * Used when approving a new admin — creates UNLOCKED + FREE billing record
 * so every normal admin automatically has the permanent FREE base plan.
 */
export async function ensureBillingAccount(
  adminId: string,
  defaults?: { accessStatus?: 'LOCKED' | 'UNLOCKED'; planType?: PlanType }
): Promise<void> {
  const supabase = await getAdminDb();

  const { data: existing } = await supabase
    .from('admin_billing_accounts')
    .select('id')
    .eq('admin_user_id', adminId)
    .maybeSingle();

  if (existing) return;

  await supabase
    .from('admin_billing_accounts')
    .insert({
      admin_user_id: adminId,
      plan_type: defaults?.planType || 'FREE',
      access_status: defaults?.accessStatus || 'UNLOCKED',
      subscription_status: 'ACTIVE',
      started_at: new Date().toISOString(),
    });
}
