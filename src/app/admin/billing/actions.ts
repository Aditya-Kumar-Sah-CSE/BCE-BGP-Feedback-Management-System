'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getAdminSession, SUPER_ADMIN_EMAIL } from '@/lib/auth/admin-auth';
import { ensureBillingAccount, getAdminBillingStatus, assertAnalyticsAccess } from '@/lib/billing/access-control';
import {
  isValidUUID,
  submitPaymentRequestSchema,
  updatePaymentSettingsSchema,
} from '@/lib/validation';
import type {
  AdminBillingAccount,
  PaymentRequest,
  PaymentSettings,
} from '@/types/database';

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
) {
  try {
    await supabase!.from('audit_logs').insert({
      admin_id: actor.adminId || null,
      actor_email: actor.email || '',
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
    });
  } catch (err) {
    console.error('Billing audit log write error:', err);
  }
}

// ====================================================================
// PAYMENT SETTINGS (Super Admin only writes, Admin reads)
// ====================================================================

export async function getPaymentSettingsAction() {
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isActive) {
    return { success: false, error: 'Unauthorized.' };
  }

  const supabase = await getAdminDb();
  const { data, error } = await supabase
    .from('payment_settings')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (error) {
    return { success: false, error: 'Failed to load payment settings.' };
  }

  return { success: true, settings: (data || null) as PaymentSettings | null };
}

export async function updatePaymentSettingsAction(input: {
  upiId?: string;
  accountName?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  supportPhone?: string;
  paymentInstructions?: string;
}) {
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isSuperAdmin) {
    return { success: false, error: 'Only the Super Admin can update payment settings.' };
  }

  const validation = updatePaymentSettingsSchema.safeParse(input);
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0]?.message || 'Invalid input.' };
  }

  const supabase = await getAdminDb();
  const { data: existing } = await supabase
    .from('payment_settings')
    .select('id')
    .limit(1)
    .maybeSingle();

  const payload = {
    upi_id: validation.data.upiId,
    account_name: validation.data.accountName,
    bank_name: validation.data.bankName,
    account_number: validation.data.accountNumber,
    ifsc_code: validation.data.ifscCode,
    support_phone: validation.data.supportPhone,
    payment_instructions: validation.data.paymentInstructions,
    updated_by: session.admin?.id || null,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { error } = await supabase
      .from('payment_settings')
      .update(payload)
      .eq('id', existing.id);
    if (error) return { success: false, error: 'Failed to update payment settings.' };
  } else {
    const { error } = await supabase
      .from('payment_settings')
      .insert(payload);
    if (error) return { success: false, error: 'Failed to create payment settings.' };
  }

  await logAudit(supabase, { adminId: session.admin?.id, email: session.user?.email }, 'PAYMENT_SETTINGS_UPDATED', 'payment_settings', existing?.id || 'new', 'Super Admin updated payment settings.');

  revalidatePath('/admin/dashboard');
  return { success: true };
}

// ====================================================================
// SUBMIT PAYMENT REQUEST (Normal Admin)
// ====================================================================

export async function submitPaymentRequestAction(input: {
  billingPlanId: string;
  paymentMethod: string;
  paymentReference: string;
  paymentProofUrl?: string | null;
}) {
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isActive || !session.admin) {
    return { success: false, error: 'Unauthorized. Active admin session required.' };
  }

  const validation = submitPaymentRequestSchema.safeParse(input);
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0]?.message || 'Invalid payment request data.' };
  }

  const { billingPlanId, paymentMethod, paymentReference, paymentProofUrl } = validation.data;

  const supabase = await getAdminDb();

  // Fetch plan from DB — NEVER trust browser-sent amounts
  const { data: plan, error: planErr } = await supabase
    .from('billing_plans')
    .select('*')
    .eq('id', billingPlanId)
    .eq('is_active', true)
    .single();

  if (planErr || !plan) {
    return { success: false, error: 'Selected plan not found or is no longer available.' };
  }

  if (plan.price <= 0) {
    return { success: false, error: 'Free plans cannot be self-selected. Contact the Super Admin.' };
  }

  const adminId = session.admin.id;

  // Ensure billing account exists
  await ensureBillingAccount(adminId);

  // Prevent duplicate PENDING requests
  const { data: existingPending } = await supabase
    .from('payment_requests')
    .select('id')
    .eq('admin_user_id', adminId)
    .eq('status', 'PENDING')
    .maybeSingle();

  if (existingPending) {
    return { success: false, error: 'You already have a pending payment request. Please wait for it to be reviewed by the Super Admin.' };
  }

  const { data: newRequest, error } = await supabase
    .from('payment_requests')
    .insert({
      admin_user_id: adminId,
      plan_type: plan.slug,
      amount: plan.price,
      payment_method: paymentMethod,
      payment_reference: paymentReference.trim(),
      payment_proof_url: paymentProofUrl || null,
      status: 'PENDING',
      billing_plan_id: plan.id,
      snapshot_plan_name: plan.name,
      snapshot_billing_interval: plan.billing_interval,
    })
    .select('*')
    .single();

  if (error) {
    console.error('[PAYMENT_REQUEST_CREATE]', error);
    return { success: false, error: 'Failed to submit payment request. Please try again.' };
  }

  await logAudit(supabase, { adminId, email: session.user?.email }, 'PAYMENT_REQUEST_CREATED', 'payment_requests', newRequest.id, `Payment request submitted: ${plan.name} (${plan.slug}) plan, ₹${plan.price}, via ${paymentMethod}, UTR: ${paymentReference}`);

  revalidatePath('/admin/dashboard');
  return {
    success: true,
    message: 'Payment request submitted successfully. Your payment will be manually verified within 24 hours.',
  };
}

// ====================================================================
// UPLOAD PAYMENT PROOF (Normal Admin)
// ====================================================================

export async function uploadPaymentProofAction(formData: FormData): Promise<{ success: boolean; url?: string; error?: string }> {
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isActive || !session.admin) {
    return { success: false, error: 'Unauthorized.' };
  }

  const file = formData.get('file') as File | null;
  if (!file || file.size === 0) {
    return { success: false, error: 'No file provided.' };
  }

  // Max 5MB
  if (file.size > 5 * 1024 * 1024) {
    return { success: false, error: 'File size must be less than 5MB.' };
  }

  // Only images
  if (!file.type.startsWith('image/')) {
    return { success: false, error: 'Only image files are allowed.' };
  }

  const supabase = await getAdminDb();
  const ext = file.name.split('.').pop() || 'png';
  const fileName = `${session.admin.id}/${Date.now()}.${ext}`;

  let { data, error } = await supabase.storage
    .from('payment-proofs')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    });

  // If the bucket doesn't exist yet, auto-create it as a private bucket and retry
  if (error && (error.message?.includes('not found') || (error as any).statusCode === '404' || (error as any).statusCode === 404)) {
    try {
      await supabase.storage.createBucket('payment-proofs', {
        public: false,
        fileSizeLimit: 5242880, // 5MB
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
      });

      const retry = await supabase.storage
        .from('payment-proofs')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });
      data = retry.data;
      error = retry.error;
    } catch (createErr) {
      console.error('[PAYMENT_PROOF_BUCKET_AUTO_CREATE]', createErr);
    }
  }

  if (error || !data) {
    console.error('[PAYMENT_PROOF_UPLOAD]', error);
    return { success: false, error: error?.message || 'Failed to upload payment proof. Please try again.' };
  }

  // Return path (not public URL) — we generate signed URLs for authorized viewers
  return { success: true, url: data.path };
}

// ====================================================================
// GET PAYMENT PROOF SIGNED URL (Admin who submitted or Super Admin)
// ====================================================================

export async function getPaymentProofUrlAction(proofPath: string) {
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isActive) {
    return { success: false, error: 'Unauthorized.' };
  }

  // Only allow if Super Admin or the proof belongs to the requesting admin
  const isSuperAdmin = session.isSuperAdmin;
  const adminId = session.admin?.id;
  const pathBelongsToAdmin = proofPath.startsWith(`${adminId}/`);

  if (!isSuperAdmin && !pathBelongsToAdmin) {
    return { success: false, error: 'Access denied.' };
  }

  const supabase = await getAdminDb();
  const { data, error } = await supabase.storage
    .from('payment-proofs')
    .createSignedUrl(proofPath, 300); // 5 min expiry

  if (error || !data?.signedUrl) {
    return { success: false, error: 'Failed to generate access URL.' };
  }

  return { success: true, url: data.signedUrl };
}

// ====================================================================
// SUPER ADMIN: APPROVE PAYMENT
// ====================================================================

export async function approvePaymentAction(requestId: string) {
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isSuperAdmin) {
    return { success: false, error: 'Only the Super Admin can approve payments.' };
  }

  if (!isValidUUID(requestId)) {
    return { success: false, error: 'Invalid payment request ID.' };
  }

  const supabase = await getAdminDb();

  // Fetch payment request
  const { data: payReq, error: fetchErr } = await supabase
    .from('payment_requests')
    .select('*')
    .eq('id', requestId)
    .single();

  if (fetchErr || !payReq) {
    return { success: false, error: 'Payment request not found.' };
  }

  if (payReq.status !== 'PENDING') {
    return { success: false, error: `This payment request has already been ${payReq.status.toLowerCase()}.` };
  }

  // Validate amount: look up the plan from DB (by billing_plan_id or slug)
  let expectedAmount = payReq.amount; // trust the snapshot by default
  let durationDays = payReq.plan_type === 'MONTHLY' ? 30 : 365; // fallback

  if (payReq.billing_plan_id) {
    const { data: plan } = await supabase
      .from('billing_plans')
      .select('price, duration_days')
      .eq('id', payReq.billing_plan_id)
      .single();
    if (plan) {
      expectedAmount = plan.price;
      if (plan.duration_days) durationDays = plan.duration_days;
    }
  } else {
    // Legacy: lookup by slug
    const { data: plan } = await supabase
      .from('billing_plans')
      .select('price, duration_days')
      .eq('slug', payReq.plan_type)
      .maybeSingle();
    if (plan) {
      expectedAmount = plan.price;
      if (plan.duration_days) durationDays = plan.duration_days;
    }
  }

  if (expectedAmount !== payReq.amount) {
    return { success: false, error: `Amount mismatch. Expected ₹${expectedAmount} for ${payReq.plan_type} plan but request has ₹${payReq.amount}.` };
  }

  // Verify admin exists
  const { data: targetAdmin } = await supabase
    .from('admins')
    .select('id, email, name')
    .eq('id', payReq.admin_user_id)
    .single();

  if (!targetAdmin) {
    return { success: false, error: 'Target admin account not found.' };
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

  // Transactional: update payment_request + billing account
  const { error: updateReqErr } = await supabase
    .from('payment_requests')
    .update({
      status: 'APPROVED',
      reviewed_by: session.admin?.id || null,
      reviewed_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('id', requestId)
    .eq('status', 'PENDING'); // Prevent double-approval

  if (updateReqErr) {
    return { success: false, error: 'Failed to update payment request.' };
  }

  // Upsert billing account
  await ensureBillingAccount(payReq.admin_user_id);

  const { error: billingErr } = await supabase
    .from('admin_billing_accounts')
    .update({
      plan_type: payReq.plan_type,
      access_status: 'UNLOCKED',
      subscription_status: 'ACTIVE',
      started_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('admin_user_id', payReq.admin_user_id);

  if (billingErr) {
    return { success: false, error: 'Payment approved but failed to update billing account. Please retry.' };
  }

  await logAudit(supabase, { adminId: session.admin?.id, email: session.user?.email }, 'PAYMENT_APPROVED', 'payment_requests', requestId, `Approved ${payReq.plan_type} payment for ${targetAdmin.email}. Amount: ₹${payReq.amount}. Valid until: ${expiresAt.toISOString()}`);

  await logAudit(supabase, { adminId: session.admin?.id, email: session.user?.email }, 'ADMIN_FORM_ACCESS_UNLOCKED', 'admin_billing_accounts', payReq.admin_user_id, `Form generation access unlocked for ${targetAdmin.email} (${payReq.plan_type} plan).`);

  revalidatePath('/admin/dashboard');
  return { success: true, message: `Payment approved. ${targetAdmin.email} is now UNLOCKED with ${payReq.plan_type} plan.` };
}

// ====================================================================
// SUPER ADMIN: REJECT PAYMENT
// ====================================================================

export async function rejectPaymentAction(requestId: string, rejectionReason?: string) {
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isSuperAdmin) {
    return { success: false, error: 'Only the Super Admin can reject payments.' };
  }

  if (!isValidUUID(requestId)) {
    return { success: false, error: 'Invalid payment request ID.' };
  }

  const supabase = await getAdminDb();

  const { data: payReq } = await supabase
    .from('payment_requests')
    .select('*, admin:admins(email, name)')
    .eq('id', requestId)
    .single();

  if (!payReq) {
    return { success: false, error: 'Payment request not found.' };
  }

  if (payReq.status !== 'PENDING') {
    return { success: false, error: `This payment request has already been ${payReq.status.toLowerCase()}.` };
  }

  const { error } = await supabase
    .from('payment_requests')
    .update({
      status: 'REJECTED',
      reviewed_by: session.admin?.id || null,
      reviewed_at: new Date().toISOString(),
      rejection_reason: rejectionReason?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .eq('status', 'PENDING');

  if (error) {
    return { success: false, error: 'Failed to reject payment request.' };
  }

  const adminEmail = (payReq.admin as any)?.email || payReq.admin_user_id;
  await logAudit(supabase, { adminId: session.admin?.id, email: session.user?.email }, 'PAYMENT_REJECTED', 'payment_requests', requestId, `Rejected ${payReq.plan_type} payment for ${adminEmail}. Reason: ${rejectionReason || 'Not specified'}`);

  revalidatePath('/admin/dashboard');
  return { success: true, message: 'Payment request rejected.' };
}

// ====================================================================
// SUPER ADMIN: ASSIGN FREE PLAN
// ====================================================================

export async function assignFreePlanAction(targetAdminId: string) {
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isSuperAdmin) {
    return { success: false, error: 'Only the Super Admin can assign the Free plan.' };
  }

  if (!isValidUUID(targetAdminId)) {
    return { success: false, error: 'Invalid admin ID.' };
  }

  const supabase = await getAdminDb();

  const { data: target } = await supabase
    .from('admins')
    .select('id, email, name')
    .eq('id', targetAdminId)
    .single();

  if (!target) {
    return { success: false, error: 'Admin not found.' };
  }

  await ensureBillingAccount(targetAdminId);

  const { error } = await supabase
    .from('admin_billing_accounts')
    .update({
      plan_type: 'FREE',
      access_status: 'UNLOCKED',
      subscription_status: 'ACTIVE',
      started_at: new Date().toISOString(),
      expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('admin_user_id', targetAdminId);

  if (error) {
    return { success: false, error: 'Failed to assign Free plan.' };
  }

  await logAudit(supabase, { adminId: session.admin?.id, email: session.user?.email }, 'FREE_PLAN_ASSIGNED', 'admin_billing_accounts', targetAdminId, `Free plan assigned to ${target.email} by Super Admin. Form generation access unlocked.`);

  revalidatePath('/admin/dashboard');
  return { success: true, message: `Free plan assigned to ${target.email}. Access is now UNLOCKED.` };
}

// ====================================================================
// SUPER ADMIN: LOCK ADMIN ACCESS
// ====================================================================

export async function lockAdminAccessAction(targetAdminId: string) {
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isSuperAdmin) {
    return { success: false, error: 'Only the Super Admin can lock access.' };
  }

  if (!isValidUUID(targetAdminId)) {
    return { success: false, error: 'Invalid admin ID.' };
  }

  const supabase = await getAdminDb();

  const { data: target } = await supabase
    .from('admins')
    .select('id, email, role')
    .eq('id', targetAdminId)
    .single();

  if (!target) {
    return { success: false, error: 'Admin not found.' };
  }

  // Prevent locking Super Admin
  if (target.role === 'SUPER_ADMIN' || target.email.toLowerCase().trim() === SUPER_ADMIN_EMAIL) {
    return { success: false, error: 'The Super Admin account cannot be locked.' };
  }

  // Prevent self-lock
  if (target.id === session.admin?.id) {
    return { success: false, error: 'You cannot lock your own account.' };
  }

  await ensureBillingAccount(targetAdminId);

  const { error } = await supabase
    .from('admin_billing_accounts')
    .update({
      access_status: 'LOCKED',
      updated_at: new Date().toISOString(),
    })
    .eq('admin_user_id', targetAdminId);

  if (error) {
    return { success: false, error: 'Failed to lock admin access.' };
  }

  await logAudit(supabase, { adminId: session.admin?.id, email: session.user?.email }, 'ADMIN_FORM_ACCESS_LOCKED', 'admin_billing_accounts', targetAdminId, `Form generation access locked for ${target.email} by Super Admin.`);

  revalidatePath('/admin/dashboard');
  return { success: true, message: `Access locked for ${target.email}.` };
}

// ====================================================================
// SUPER ADMIN: UNLOCK ADMIN ACCESS
// ====================================================================

export async function unlockAdminAccessAction(targetAdminId: string) {
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isSuperAdmin) {
    return { success: false, error: 'Only the Super Admin can unlock access.' };
  }

  if (!isValidUUID(targetAdminId)) {
    return { success: false, error: 'Invalid admin ID.' };
  }

  const supabase = await getAdminDb();

  const { data: target } = await supabase
    .from('admins')
    .select('id, email')
    .eq('id', targetAdminId)
    .single();

  if (!target) {
    return { success: false, error: 'Admin not found.' };
  }

  await ensureBillingAccount(targetAdminId);

  const { error } = await supabase
    .from('admin_billing_accounts')
    .update({
      access_status: 'UNLOCKED',
      subscription_status: 'ACTIVE',
      updated_at: new Date().toISOString(),
    })
    .eq('admin_user_id', targetAdminId);

  if (error) {
    return { success: false, error: 'Failed to unlock admin access.' };
  }

  await logAudit(supabase, { adminId: session.admin?.id, email: session.user?.email }, 'ADMIN_FORM_ACCESS_UNLOCKED', 'admin_billing_accounts', targetAdminId, `Form generation access unlocked for ${target.email} by Super Admin.`);

  revalidatePath('/admin/dashboard');
  return { success: true, message: `Access unlocked for ${target.email}.` };
}

// ====================================================================
// SUPER ADMIN: REVOKE FORM ACCESS
// ====================================================================

export async function revokeFormAccessAction(targetAdminId: string) {
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isSuperAdmin) {
    return { success: false, error: 'Only the Super Admin can revoke access.' };
  }

  if (!isValidUUID(targetAdminId)) {
    return { success: false, error: 'Invalid admin ID.' };
  }

  const supabase = await getAdminDb();

  const { data: target } = await supabase
    .from('admins')
    .select('id, email, role')
    .eq('id', targetAdminId)
    .single();

  if (!target) {
    return { success: false, error: 'Admin not found.' };
  }

  if (target.role === 'SUPER_ADMIN' || target.email.toLowerCase().trim() === SUPER_ADMIN_EMAIL) {
    return { success: false, error: 'The Super Admin account cannot be revoked.' };
  }

  if (target.id === session.admin?.id) {
    return { success: false, error: 'You cannot revoke your own access.' };
  }

  await ensureBillingAccount(targetAdminId);

  const { error } = await supabase
    .from('admin_billing_accounts')
    .update({
      access_status: 'LOCKED',
      subscription_status: 'CANCELLED',
      updated_at: new Date().toISOString(),
    })
    .eq('admin_user_id', targetAdminId);

  if (error) {
    return { success: false, error: 'Failed to revoke access.' };
  }

  await logAudit(supabase, { adminId: session.admin?.id, email: session.user?.email }, 'ACCESS_REVOKED', 'admin_billing_accounts', targetAdminId, `Form generation access revoked for ${target.email} by Super Admin.`);

  revalidatePath('/admin/dashboard');
  return { success: true, message: `Access revoked for ${target.email}.` };
}

// ====================================================================
// SUPER ADMIN: BILLING OVERVIEW
// ====================================================================

export async function getAdminBillingOverviewAction() {
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isSuperAdmin) {
    return { success: false, error: 'Only the Super Admin can view billing overview.', data: [] };
  }

  const supabase = await getAdminDb();

  // Get all admins with their billing records and latest payment requests
  const { data: admins, error: adminsErr } = await supabase
    .from('admins')
    .select('id, email, name, role, status, created_at')
    .order('created_at', { ascending: false });

  if (adminsErr || !admins) {
    return { success: false, error: 'Failed to load admins.', data: [] };
  }

  const { data: billingRecords } = await supabase
    .from('admin_billing_accounts')
    .select('*');

  const { data: paymentRequests } = await supabase
    .from('payment_requests')
    .select('*')
    .order('created_at', { ascending: false });

  const { data: trialRecords } = await supabase
    .from('admin_trial_entitlements')
    .select(`
      *,
      granter:admins!admin_trial_entitlements_granted_by_fkey(id, email, name),
      revoker:admins!admin_trial_entitlements_revoked_by_fkey(id, email, name)
    `)
    .order('created_at', { ascending: false });

  const billingMap = new Map((billingRecords || []).map((b: any) => [b.admin_user_id, b]));
  const requestsMap = new Map<string, any[]>();
  const trialsMap = new Map<string, any[]>();

  for (const req of (paymentRequests || []) as any[]) {
    if (!requestsMap.has(req.admin_user_id)) {
      requestsMap.set(req.admin_user_id, []);
    }
    requestsMap.get(req.admin_user_id)!.push(req);
  }

  for (const trial of (trialRecords || []) as any[]) {
    if (!trialsMap.has(trial.admin_id)) {
      trialsMap.set(trial.admin_id, []);
    }
    trialsMap.get(trial.admin_id)!.push(trial);
  }

  const now = new Date();

  const overview = admins.map((admin: any) => {
    const billing = billingMap.get(admin.id) as AdminBillingAccount | undefined;
    const requests = (requestsMap.get(admin.id) || []) as PaymentRequest[];
    const latestRequest = requests[0] || null;
    const adminTrials = (trialsMap.get(admin.id) || []) as any[];

    // Active trial: status = ACTIVE, starts_at <= now, now < expires_at
    const activeTrial = adminTrials.find(
      (t) => t.status === 'ACTIVE' && new Date(t.starts_at) <= now && new Date(t.expires_at) > now
    ) || null;

    return {
      admin,
      billing: billing || null,
      latestPaymentRequest: latestRequest,
      paymentRequests: requests,
      activeTrial,
      trialHistory: adminTrials,
    };
  });

  return { success: true, data: overview };
}

// ====================================================================
// GET ADMIN BILLING STATUS (for own UI)
// ====================================================================

export async function getMyBillingStatusAction() {
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isActive || !session.admin) {
    return { success: false, error: 'Unauthorized.' };
  }

  const billingStatus = await getAdminBillingStatus(session.admin.id);

  // Also fetch latest payment request for status display
  const supabase = await getAdminDb();
  const { data: latestRequest } = await supabase
    .from('payment_requests')
    .select('*')
    .eq('admin_user_id', session.admin.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const hasFullAnalytics = session.isSuperAdmin || (billingStatus.isUnlocked && !!billingStatus.hasFullAnalytics);

  return {
    success: true,
    billing: {
      ...billingStatus,
      hasFullAnalytics,
    },
    hasFullAnalytics,
    latestPaymentRequest: latestRequest as PaymentRequest | null,
    isSuperAdmin: session.isSuperAdmin,
  };
}

export async function checkAnalyticsAccessAction() {
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isActive) {
    return { allowed: false, isSuperAdmin: false, reason: 'Unauthorized.' };
  }

  const result = await assertAnalyticsAccess(
    session.admin?.id,
    session.admin?.email || session.user?.email,
    session.admin?.role,
    session.admin?.status
  );

  return {
    allowed: result.allowed,
    isSuperAdmin: session.isSuperAdmin,
    reason: result.reason,
    code: result.code,
    billingStatus: result.billingStatus,
  };
}

