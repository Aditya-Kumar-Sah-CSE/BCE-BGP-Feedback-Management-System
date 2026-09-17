'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getAdminSession, SUPER_ADMIN_EMAIL } from '@/lib/auth/admin-auth';
import {
  isValidUUID,
  grantTrialSchema,
  extendTrialSchema,
  revokeTrialSchema,
  replaceTrialSchema,
  type GrantTrialInput,
  type ExtendTrialInput,
  type RevokeTrialInput,
  type ReplaceTrialInput,
} from '@/lib/validation';
import type { AdminTrialEntitlement } from '@/types/database';

async function getAdminDb() {
  return createAdminClient() || await createClient();
}

async function logAudit(
  supabase: ReturnType<typeof createAdminClient>,
  actor: { adminId?: string | null; email?: string },
  action: string,
  entityType: string,
  entityId: string,
  details: string,
  metadata?: any,
) {
  try {
    await supabase!.from('audit_logs').insert({
      admin_id: actor.adminId || null,
      actor_email: actor.email || '',
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
      metadata: metadata || {},
    });
  } catch (err) {
    console.error('Trial audit log write error:', err);
  }
}

// ====================================================================
// 1. GET TRIAL CONFIGURATION (Dynamic features & duration options)
// ====================================================================

/**
 * Returns dynamic feature vocabulary and duration options from DB billing_plans.
 * Super Admin UI uses this to render trial feature checkboxes and duration selector
 * without hardcoded business pricing logic.
 */
export async function getTrialConfigAction() {
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isActive) {
    return { success: false, error: 'Unauthorized.' };
  }

  const supabase = await getAdminDb();
  const { data: plans, error } = await supabase
    .from('billing_plans')
    .select('duration_days, features')
    .eq('is_active', true);

  if (error || !plans) {
    return {
      success: true,
      durationOptions: [7, 14, 30, 60, 90],
      availableFeatures: [
        'Google Form generation',
        'Google Sheet integration',
        'Full analytics access',
        'Basic analytics',
      ],
    };
  }

  // Dynamic feature vocabulary extracted from active billing plans
  const featureSet = new Set<string>();
  featureSet.add('Google Form generation');
  featureSet.add('Google Sheet integration');
  featureSet.add('Full analytics access');

  for (const plan of plans) {
    if (Array.isArray(plan.features)) {
      for (const feat of plan.features) {
        if (feat && typeof feat === 'string') featureSet.add(feat.trim());
      }
    }
  }

  // Dynamic duration presets from active plans + standard trial intervals
  const durationSet = new Set<number>([7, 14, 30, 60, 90]);
  for (const plan of plans) {
    if (typeof plan.duration_days === 'number' && plan.duration_days > 0) {
      durationSet.add(plan.duration_days);
    }
  }

  const durationOptions = Array.from(durationSet).sort((a, b) => a - b);
  const availableFeatures = Array.from(featureSet);

  return {
    success: true,
    durationOptions,
    availableFeatures,
  };
}

// ====================================================================
// 2. GRANT FREE TRIAL (Super Admin only)
// ====================================================================

export async function grantTrialAction(input: GrantTrialInput) {
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isSuperAdmin) {
    return { success: false, error: 'Only the Super Admin can grant Free Trials.' };
  }

  const validation = grantTrialSchema.safeParse(input);
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0]?.message || 'Invalid trial grant parameters.' };
  }

  const { adminId, durationDays, startsAt, features, note } = validation.data;
  const supabase = await getAdminDb();

  // 1. Verify target admin exists and is NOT Super Admin
  const { data: targetAdmin, error: adminErr } = await supabase
    .from('admins')
    .select('id, email, name, role')
    .eq('id', adminId)
    .single();

  if (adminErr || !targetAdmin) {
    return { success: false, error: 'Target admin account not found.' };
  }

  if (targetAdmin.role === 'SUPER_ADMIN' || targetAdmin.email.toLowerCase().trim() === SUPER_ADMIN_EMAIL) {
    return { success: false, error: 'Super Admin is always unrestricted and cannot be trial-managed.' };
  }

  // Prevent granting trial to oneself
  if (targetAdmin.id === session.admin?.id) {
    return { success: false, error: 'You cannot grant a trial to your own account.' };
  }

  // 2. Check if admin already has an ACTIVE trial
  const { data: existingActive } = await supabase
    .from('admin_trial_entitlements')
    .select('id, starts_at, expires_at, status')
    .eq('admin_id', adminId)
    .eq('status', 'ACTIVE')
    .maybeSingle();

  if (existingActive) {
    const now = new Date();
    if (new Date(existingActive.expires_at) > now) {
      return {
        success: false,
        error: `${targetAdmin.email} already has an active trial until ${new Date(existingActive.expires_at).toLocaleDateString('en-IN')}. Please choose "Extend Trial" or "Replace Trial".`,
        alreadyActive: true,
        activeTrialId: existingActive.id,
      };
    } else {
      // Lazily mark expired record as EXPIRED to clear partial unique constraint
      await supabase
        .from('admin_trial_entitlements')
        .update({ status: 'EXPIRED', updated_at: now.toISOString() })
        .eq('id', existingActive.id);
    }
  }

  // 3. Compute timestamps
  const startDate = startsAt ? new Date(startsAt) : new Date();
  const expiryDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

  if (expiryDate <= startDate) {
    return { success: false, error: 'Expiry date must be after start date.' };
  }

  // 4. Insert trial record
  const { data: newTrial, error: insertErr } = await supabase
    .from('admin_trial_entitlements')
    .insert({
      admin_id: adminId,
      granted_by: session.admin!.id,
      starts_at: startDate.toISOString(),
      expires_at: expiryDate.toISOString(),
      status: 'ACTIVE',
      features,
      note: note?.trim() || null,
    })
    .select('*')
    .single();

  if (insertErr) {
    console.error('[GRANT_TRIAL_ERROR]', insertErr);
    return { success: false, error: 'Failed to grant trial. Please try again.' };
  }

  // 5. Audit Log
  await logAudit(
    supabase,
    { adminId: session.admin?.id, email: session.user?.email },
    'TRIAL_GRANTED',
    'admin_trial_entitlements',
    newTrial.id,
    `Granted ${durationDays}-day Free Trial to ${targetAdmin.email}. Features: ${features.join(', ')}. Valid until: ${expiryDate.toISOString()}`,
    {
      target_admin_id: adminId,
      target_email: targetAdmin.email,
      duration_days: durationDays,
      starts_at: startDate.toISOString(),
      expires_at: expiryDate.toISOString(),
      features,
      note,
    }
  );

  revalidatePath('/admin/dashboard');
  return {
    success: true,
    message: `Free trial granted to ${targetAdmin.email} for ${durationDays} days.`,
    trial: newTrial as AdminTrialEntitlement,
  };
}

// ====================================================================
// 3. EXTEND FREE TRIAL (Super Admin only)
// ====================================================================

export async function extendTrialAction(input: ExtendTrialInput) {
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isSuperAdmin) {
    return { success: false, error: 'Only the Super Admin can extend trials.' };
  }

  const validation = extendTrialSchema.safeParse(input);
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0]?.message || 'Invalid trial extension parameters.' };
  }

  const { trialId, additionalDays, newExpiresAt, note } = validation.data;
  const supabase = await getAdminDb();

  // Fetch trial
  const { data: trial, error: fetchErr } = await supabase
    .from('admin_trial_entitlements')
    .select('*, admin:admins(id, email, name)')
    .eq('id', trialId)
    .single();

  if (fetchErr || !trial) {
    return { success: false, error: 'Trial record not found.' };
  }

  if (trial.status !== 'ACTIVE') {
    return { success: false, error: `Cannot extend a trial with status "${trial.status}". Only ACTIVE trials can be extended.` };
  }

  const previousExpiresAt = new Date(trial.expires_at);
  let computedNewExpiry: Date;

  if (newExpiresAt) {
    computedNewExpiry = new Date(newExpiresAt);
  } else if (additionalDays) {
    // If the trial was already expired in time, extend from now; otherwise from previous expiry
    const baseDate = previousExpiresAt < new Date() ? new Date() : previousExpiresAt;
    computedNewExpiry = new Date(baseDate.getTime() + additionalDays * 24 * 60 * 60 * 1000);
  } else {
    return { success: false, error: 'Please specify additional days or a new expiry date.' };
  }

  if (computedNewExpiry <= new Date(trial.starts_at)) {
    return { success: false, error: 'New expiry date must be after the trial start date.' };
  }

  if (computedNewExpiry <= previousExpiresAt && !newExpiresAt) {
    return { success: false, error: 'Extension must advance the expiry date.' };
  }

  const updatedNote = note?.trim()
    ? (trial.note ? `${trial.note} | Extended: ${note.trim()}` : `Extended: ${note.trim()}`)
    : trial.note;

  const { data: updatedTrial, error: updateErr } = await supabase
    .from('admin_trial_entitlements')
    .update({
      expires_at: computedNewExpiry.toISOString(),
      note: updatedNote,
      updated_at: new Date().toISOString(),
    })
    .eq('id', trialId)
    .select('*')
    .single();

  if (updateErr) {
    return { success: false, error: 'Failed to extend trial. Please try again.' };
  }

  const adminEmail = (trial.admin as any)?.email || trial.admin_id;

  // Audit Log
  await logAudit(
    supabase,
    { adminId: session.admin?.id, email: session.user?.email },
    'TRIAL_EXTENDED',
    'admin_trial_entitlements',
    trialId,
    `Extended Free Trial for ${adminEmail}. Previous expiry: ${previousExpiresAt.toISOString()}, New expiry: ${computedNewExpiry.toISOString()}`,
    {
      target_admin_id: trial.admin_id,
      target_email: adminEmail,
      previous_expires_at: previousExpiresAt.toISOString(),
      new_expires_at: computedNewExpiry.toISOString(),
      additional_days: additionalDays,
      note,
    }
  );

  revalidatePath('/admin/dashboard');
  return {
    success: true,
    message: `Trial for ${adminEmail} extended until ${computedNewExpiry.toLocaleDateString('en-IN')}.`,
    trial: updatedTrial as AdminTrialEntitlement,
  };
}

// ====================================================================
// 4. REVOKE FREE TRIAL (Super Admin only)
// ====================================================================

export async function revokeTrialAction(input: RevokeTrialInput) {
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isSuperAdmin) {
    return { success: false, error: 'Only the Super Admin can revoke trials.' };
  }

  const validation = revokeTrialSchema.safeParse(input);
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0]?.message || 'Invalid revoke parameters.' };
  }

  const { trialId, reason } = validation.data;
  const supabase = await getAdminDb();

  const { data: trial, error: fetchErr } = await supabase
    .from('admin_trial_entitlements')
    .select('*, admin:admins(id, email, name)')
    .eq('id', trialId)
    .single();

  if (fetchErr || !trial) {
    return { success: false, error: 'Trial record not found.' };
  }

  if (trial.status === 'REVOKED') {
    return { success: false, error: 'This trial has already been revoked.' };
  }

  const now = new Date();
  const revocationReason = reason?.trim() || 'Revoked by Super Admin';
  const updatedNote = trial.note
    ? `${trial.note} | Revocation reason: ${revocationReason}`
    : `Revocation reason: ${revocationReason}`;

  const { error: updateErr } = await supabase
    .from('admin_trial_entitlements')
    .update({
      status: 'REVOKED',
      revoked_at: now.toISOString(),
      revoked_by: session.admin?.id || null,
      note: updatedNote,
      updated_at: now.toISOString(),
    })
    .eq('id', trialId);

  if (updateErr) {
    return { success: false, error: 'Failed to revoke trial. Please try again.' };
  }

  const adminEmail = (trial.admin as any)?.email || trial.admin_id;

  // Audit Log
  await logAudit(
    supabase,
    { adminId: session.admin?.id, email: session.user?.email },
    'TRIAL_REVOKED',
    'admin_trial_entitlements',
    trialId,
    `Revoked Free Trial for ${adminEmail}. Reason: ${revocationReason}`,
    {
      target_admin_id: trial.admin_id,
      target_email: adminEmail,
      revoked_at: now.toISOString(),
      reason: revocationReason,
    }
  );

  revalidatePath('/admin/dashboard');
  return {
    success: true,
    message: `Trial for ${adminEmail} revoked immediately. Access has reverted to base plan.`,
  };
}

// ====================================================================
// 5. REPLACE FREE TRIAL (Super Admin only)
// ====================================================================

export async function replaceTrialAction(input: ReplaceTrialInput) {
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isSuperAdmin) {
    return { success: false, error: 'Only the Super Admin can replace trials.' };
  }

  const validation = replaceTrialSchema.safeParse(input);
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0]?.message || 'Invalid trial parameters.' };
  }

  const { adminId, durationDays, startsAt, features, note } = validation.data;
  const supabase = await getAdminDb();

  // 1. Revoke any existing active trial for this admin
  const { data: existingTrials } = await supabase
    .from('admin_trial_entitlements')
    .select('id')
    .eq('admin_id', adminId)
    .eq('status', 'ACTIVE');

  const now = new Date();
  if (existingTrials && existingTrials.length > 0) {
    for (const t of existingTrials) {
      await supabase
        .from('admin_trial_entitlements')
        .update({
          status: 'REVOKED',
          revoked_at: now.toISOString(),
          revoked_by: session.admin?.id || null,
          note: 'Superseded / Replaced by Super Admin',
          updated_at: now.toISOString(),
        })
        .eq('id', t.id);

      await logAudit(
        supabase,
        { adminId: session.admin?.id, email: session.user?.email },
        'TRIAL_REVOKED',
        'admin_trial_entitlements',
        t.id,
        `Trial revoked because it was replaced by a new trial grant.`
      );
    }
  }

  // 2. Grant new trial
  return grantTrialAction({
    adminId,
    durationDays,
    startsAt,
    features,
    note: note ? `Replaced trial. ${note}` : 'Replaced previous trial.',
  });
}

// ====================================================================
// 6. GET TRIAL HISTORY (Admin / Super Admin)
// ====================================================================

export async function getAdminTrialHistoryAction(adminId: string) {
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isActive) {
    return { success: false, error: 'Unauthorized.', trials: [] };
  }

  if (!isValidUUID(adminId)) {
    return { success: false, error: 'Invalid admin ID.', trials: [] };
  }

  // Normal admin can view only own history
  if (!session.isSuperAdmin && session.admin?.id !== adminId) {
    return { success: false, error: 'Access denied.', trials: [] };
  }

  const supabase = await getAdminDb();
  const { data, error } = await supabase
    .from('admin_trial_entitlements')
    .select(`
      *,
      granter:admins!admin_trial_entitlements_granted_by_fkey(id, email, name),
      revoker:admins!admin_trial_entitlements_revoked_by_fkey(id, email, name)
    `)
    .eq('admin_id', adminId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[TRIAL_HISTORY_ERROR]', error);
    return { success: false, error: 'Failed to load trial history.', trials: [] };
  }

  return { success: true, trials: (data || []) as AdminTrialEntitlement[] };
}
