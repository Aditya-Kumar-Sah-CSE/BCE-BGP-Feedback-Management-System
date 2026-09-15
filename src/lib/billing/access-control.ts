import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { SUPER_ADMIN_EMAIL } from '@/lib/auth/admin-auth';
import type { PlanType } from '@/types/database';
import type { BillingStatus, FormAccessResult } from './constants';

// Re-export for convenience — consumers can import from either file
export { CANONICAL_PRICING, PLAN_LABELS } from './constants';
export type { BillingStatus, FormAccessResult } from './constants';

// ====================================================================
// BILLING STATUS QUERY
// ====================================================================

/**
 * Read the billing state for a given admin (by admins.id).
 * Returns LOCKED if no billing record exists.
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
    };
  }

  const now = new Date();
  const isExpired = billing.plan_type !== 'FREE'
    && billing.expires_at
    && new Date(billing.expires_at) < now;

  // If paid plan has expired, treat as LOCKED
  const effectiveAccessStatus = isExpired ? 'LOCKED' : billing.access_status;
  const effectiveSubStatus = isExpired ? 'EXPIRED' : billing.subscription_status;

  return {
    isUnlocked: effectiveAccessStatus === 'UNLOCKED',
    planType: billing.plan_type as PlanType,
    accessStatus: effectiveAccessStatus as 'LOCKED' | 'UNLOCKED',
    subscriptionStatus: effectiveSubStatus,
    expiresAt: billing.expires_at || null,
    startedAt: billing.started_at || null,
    billingAccountId: billing.id,
    isExpired: !!isExpired,
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
