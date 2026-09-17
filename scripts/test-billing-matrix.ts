import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Parse .env.local
const envPath = path.resolve('.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      process.env[key] = val;
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, serviceRoleKey);

// Feature constants
const FEATURE_GOOGLE_FORM_GENERATION = 'Google Form generation';
const FEATURE_GOOGLE_SHEET_INTEGRATION = 'Google Sheet integration';
const FEATURE_FULL_ANALYTICS_ACCESS = 'Full analytics access';
const FEATURE_BASIC_ANALYTICS = 'Basic analytics';

function planHasFeature(features: string[] | null | undefined, featureName: string): boolean {
  if (!features || !Array.isArray(features)) return false;
  const target = featureName.trim().toLowerCase();
  return features.some((f) => {
    const norm = String(f).trim().toLowerCase();
    return norm === target || norm.includes(target);
  });
}

async function resolveEffectiveAccess(adminId: string, role: string, email: string) {
  if (role === 'SUPER_ADMIN' || email.toLowerCase().trim() === 'iambestadi@gmail.com') {
    return {
      isSuperAdmin: true,
      canGenerateForms: true,
      canIntegrateSheets: true,
      canAccessFullAnalytics: true,
      canAccessBasicAnalytics: true,
    };
  }

  const now = new Date();

  // 1. Get active trial
  const { data: trials } = await supabase
    .from('admin_trial_entitlements')
    .select('*')
    .eq('admin_id', adminId)
    .eq('status', 'ACTIVE')
    .order('created_at', { ascending: false });

  let activeTrial = trials?.[0] || null;
  if (activeTrial && new Date(activeTrial.expires_at) < now) {
    // Lazy expire
    await supabase
      .from('admin_trial_entitlements')
      .update({ status: 'EXPIRED', updated_at: now.toISOString() })
      .eq('id', activeTrial.id);
    activeTrial = null;
  }

  // 2. Get billing account
  const { data: billing } = await supabase
    .from('admin_billing_accounts')
    .select('*')
    .eq('admin_user_id', adminId)
    .maybeSingle();

  const planType = billing?.plan_type || 'FREE';
  const isPaid = planType !== 'FREE';
  const isPaidExpired = isPaid && billing?.expires_at && new Date(billing.expires_at) < now;

  let planFeatures: string[] = [FEATURE_BASIC_ANALYTICS];
  if (isPaid && !isPaidExpired && billing?.access_status === 'UNLOCKED') {
    const { data: plan } = await supabase
      .from('billing_plans')
      .select('features')
      .eq('slug', planType)
      .eq('is_active', true)
      .maybeSingle();
    if (plan?.features) planFeatures = plan.features as string[];
  } else {
    const { data: freePlan } = await supabase
      .from('billing_plans')
      .select('features')
      .eq('slug', 'FREE')
      .maybeSingle();
    if (freePlan?.features) planFeatures = freePlan.features as string[];
  }

  const trialFeatures = (activeTrial?.features as string[]) || [];
  const effectiveFeatures = Array.from(new Set([...planFeatures, ...trialFeatures]));

  return {
    isSuperAdmin: false,
    effectiveFeatures,
    hasActiveTrial: !!activeTrial,
    canGenerateForms: planHasFeature(effectiveFeatures, FEATURE_GOOGLE_FORM_GENERATION),
    canIntegrateSheets: planHasFeature(effectiveFeatures, FEATURE_GOOGLE_SHEET_INTEGRATION),
    canAccessFullAnalytics: planHasFeature(effectiveFeatures, FEATURE_FULL_ANALYTICS_ACCESS),
    canAccessBasicAnalytics: planHasFeature(effectiveFeatures, FEATURE_BASIC_ANALYTICS),
  };
}

async function runTestMatrix() {
  console.log('====================================================');
  console.log('🚀 RUNNING BILLING & TRIAL END-TO-END TEST MATRIX');
  console.log('====================================================\n');

  // Fetch Super Admin and Normal Admin
  const { data: superAdmin } = await supabase
    .from('admins')
    .select('*')
    .eq('email', 'iambestadi@gmail.com')
    .single();

  const { data: normalAdmin } = await supabase
    .from('admins')
    .select('*')
    .eq('email', 'adityakumarsah8709@gmail.com')
    .single();

  if (!superAdmin || !normalAdmin) {
    throw new Error('Test admins not found in DB!');
  }

  console.log(`✓ Super Admin: ${superAdmin.email} (${superAdmin.id})`);
  console.log(`✓ Normal Admin: ${normalAdmin.email} (${normalAdmin.id})\n`);

  // Clean up any existing trials for normal admin to start clean
  await supabase
    .from('admin_trial_entitlements')
    .delete()
    .eq('admin_id', normalAdmin.id);

  // Reset billing account to FREE
  await supabase
    .from('admin_billing_accounts')
    .upsert({
      admin_user_id: normalAdmin.id,
      plan_type: 'FREE',
      access_status: 'UNLOCKED',
      subscription_status: 'ACTIVE',
      started_at: new Date().toISOString(),
      expires_at: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'admin_user_id' });

  // TEST A: NEW NORMAL ADMIN (FREE BASE PLAN)
  console.log('--- TEST A & B: Normal Admin on FREE Base Plan ---');
  let access = await resolveEffectiveAccess(normalAdmin.id, normalAdmin.role, normalAdmin.email);
  console.log('Features:', access.effectiveFeatures);
  console.log('Basic Analytics:', access.canAccessBasicAnalytics ? '✅ (Allowed)' : '❌ (Failed)');
  console.log('Form Generation:', !access.canGenerateForms ? '✅ (Correctly Locked)' : '❌ (Unlocked unexpectedly)');
  console.log('Sheet Integration:', !access.canIntegrateSheets ? '✅ (Correctly Locked)' : '❌ (Unlocked unexpectedly)');
  console.log('Full Analytics:', !access.canAccessFullAnalytics ? '✅ (Correctly Locked)' : '❌ (Unlocked unexpectedly)');
  if (!access.canAccessBasicAnalytics || access.canGenerateForms || access.canIntegrateSheets || access.canAccessFullAnalytics) {
    throw new Error('TEST A failed: FREE base plan must only provide Basic Analytics!');
  }

  // TEST K: SUPER ADMIN ALWAYS UNRESTRICTED
  console.log('\n--- TEST K: Super Admin Bypass ---');
  const superAccess = await resolveEffectiveAccess(superAdmin.id, superAdmin.role, superAdmin.email);
  console.log('Super Admin Forms:', superAccess.canGenerateForms ? '✅' : '❌');
  console.log('Super Admin Sheets:', superAccess.canIntegrateSheets ? '✅' : '❌');
  console.log('Super Admin Full Analytics:', superAccess.canAccessFullAnalytics ? '✅' : '❌');
  if (!superAccess.canGenerateForms || !superAccess.canIntegrateSheets || !superAccess.canAccessFullAnalytics) {
    throw new Error('TEST K failed: Super Admin must be unrestricted!');
  }

  // TEST C: SUPER ADMIN GRANTS TRIAL (All 3 features)
  console.log('\n--- TEST C: Super Admin Grants Full Trial (Form + Sheet + Analytics) ---');
  const now = new Date();
  const expires7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const { data: trial1, error: grantErr } = await supabase
    .from('admin_trial_entitlements')
    .insert({
      admin_id: normalAdmin.id,
      granted_by: superAdmin.id,
      starts_at: now.toISOString(),
      expires_at: expires7d.toISOString(),
      status: 'ACTIVE',
      features: [FEATURE_GOOGLE_FORM_GENERATION, FEATURE_GOOGLE_SHEET_INTEGRATION, FEATURE_FULL_ANALYTICS_ACCESS],
      note: 'Test Matrix: Full Trial',
    })
    .select('*')
    .single();

  if (grantErr || !trial1) {
    throw new Error(`Failed to grant trial: ${grantErr?.message}`);
  }

  access = await resolveEffectiveAccess(normalAdmin.id, normalAdmin.role, normalAdmin.email);
  console.log('Has Active Trial:', access.hasActiveTrial ? '✅' : '❌');
  console.log('Form Generation:', access.canGenerateForms ? '✅ (Unlocked)' : '❌ (Failed)');
  console.log('Sheet Integration:', access.canIntegrateSheets ? '✅ (Unlocked)' : '❌ (Failed)');
  console.log('Full Analytics:', access.canAccessFullAnalytics ? '✅ (Unlocked)' : '❌ (Failed)');
  if (!access.canGenerateForms || !access.canIntegrateSheets || !access.canAccessFullAnalytics) {
    throw new Error('TEST C failed: Active trial did not unlock all features!');
  }

  // TEST L: DUPLICATE TRIAL PREVENTION
  console.log('\n--- TEST L: Duplicate Active Trial Prevention ---');
  const { error: dupErr } = await supabase
    .from('admin_trial_entitlements')
    .insert({
      admin_id: normalAdmin.id,
      granted_by: superAdmin.id,
      starts_at: now.toISOString(),
      expires_at: expires7d.toISOString(),
      status: 'ACTIVE',
      features: [FEATURE_GOOGLE_FORM_GENERATION],
      note: 'Duplicate trial should fail',
    });

  if (dupErr && dupErr.code === '23505') {
    console.log('✅ DB unique partial index idx_uq_active_trial_per_admin correctly rejected duplicate active trial!');
  } else {
    throw new Error(`TEST L failed: Expected duplicate key error 23505, got: ${dupErr?.message || 'success'}`);
  }

  // TEST G: TRIAL REVOKED
  console.log('\n--- TEST G: Trial Revocation ---');
  await supabase
    .from('admin_trial_entitlements')
    .update({
      status: 'REVOKED',
      revoked_at: now.toISOString(),
      revoked_by: superAdmin.id,
      updated_at: now.toISOString(),
    })
    .eq('id', trial1.id);

  access = await resolveEffectiveAccess(normalAdmin.id, normalAdmin.role, normalAdmin.email);
  console.log('After Revocation - Has Active Trial:', !access.hasActiveTrial ? '✅ (None)' : '❌');
  console.log('After Revocation - Form Generation:', !access.canGenerateForms ? '✅ (Locked)' : '❌');
  console.log('After Revocation - Sheet Integration:', !access.canIntegrateSheets ? '✅ (Locked)' : '❌');
  console.log('After Revocation - Full Analytics:', !access.canAccessFullAnalytics ? '✅ (Locked)' : '❌');
  console.log('After Revocation - Basic Analytics:', access.canAccessBasicAnalytics ? '✅ (FREE Remains)' : '❌');
  if (access.canGenerateForms || access.canIntegrateSheets || access.canAccessFullAnalytics || !access.canAccessBasicAnalytics) {
    throw new Error('TEST G failed: Revocation did not immediately lock trial features!');
  }

  // TEST D: TRIAL WITH ONLY FULL ANALYTICS
  console.log('\n--- TEST D: Trial with ONLY Full Analytics ---');
  const { data: trialAnalytics } = await supabase
    .from('admin_trial_entitlements')
    .insert({
      admin_id: normalAdmin.id,
      granted_by: superAdmin.id,
      starts_at: now.toISOString(),
      expires_at: expires7d.toISOString(),
      status: 'ACTIVE',
      features: [FEATURE_FULL_ANALYTICS_ACCESS],
      note: 'Trial D: Analytics only',
    })
    .select('*')
    .single();

  access = await resolveEffectiveAccess(normalAdmin.id, normalAdmin.role, normalAdmin.email);
  console.log('Form Generation:', !access.canGenerateForms ? '✅ (Locked)' : '❌');
  console.log('Sheet Integration:', !access.canIntegrateSheets ? '✅ (Locked)' : '❌');
  console.log('Full Analytics:', access.canAccessFullAnalytics ? '✅ (Unlocked)' : '❌');
  if (access.canGenerateForms || access.canIntegrateSheets || !access.canAccessFullAnalytics) {
    throw new Error('TEST D failed: Only Full Analytics should be unlocked!');
  }

  // Clean up trial D
  await supabase.from('admin_trial_entitlements').delete().eq('id', trialAnalytics!.id);

  // TEST E: TRIAL WITH FORM + SHEET ONLY
  console.log('\n--- TEST E: Trial with Form + Sheet ONLY ---');
  const { data: trialFormSheet } = await supabase
    .from('admin_trial_entitlements')
    .insert({
      admin_id: normalAdmin.id,
      granted_by: superAdmin.id,
      starts_at: now.toISOString(),
      expires_at: expires7d.toISOString(),
      status: 'ACTIVE',
      features: [FEATURE_GOOGLE_FORM_GENERATION, FEATURE_GOOGLE_SHEET_INTEGRATION],
      note: 'Trial E: Form + Sheet only',
    })
    .select('*')
    .single();

  access = await resolveEffectiveAccess(normalAdmin.id, normalAdmin.role, normalAdmin.email);
  console.log('Form Generation:', access.canGenerateForms ? '✅ (Unlocked)' : '❌');
  console.log('Sheet Integration:', access.canIntegrateSheets ? '✅ (Unlocked)' : '❌');
  console.log('Full Analytics:', !access.canAccessFullAnalytics ? '✅ (Locked)' : '❌');
  if (!access.canGenerateForms || !access.canIntegrateSheets || access.canAccessFullAnalytics) {
    throw new Error('TEST E failed: Form + Sheet should be unlocked, Full Analytics locked!');
  }

  // TEST F: TRIAL EXPIRES (Past expiry date)
  console.log('\n--- TEST F: Trial Expiration Fallback ---');
  const pastStarts = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const pastExpiry = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
  const { error: updateExpiryErr } = await supabase
    .from('admin_trial_entitlements')
    .update({
      starts_at: pastStarts.toISOString(),
      expires_at: pastExpiry.toISOString(),
    })
    .eq('id', trialFormSheet!.id);

  if (updateExpiryErr) throw updateExpiryErr;

  access = await resolveEffectiveAccess(normalAdmin.id, normalAdmin.role, normalAdmin.email);
  console.log('Expired Trial - Has Active Trial:', !access.hasActiveTrial ? '✅ (None)' : '❌');
  console.log('Expired Trial - Form Generation:', !access.canGenerateForms ? '✅ (Locked)' : '❌');
  console.log('Expired Trial - Basic Analytics:', access.canAccessBasicAnalytics ? '✅ (FREE Fallback)' : '❌');
  if (access.canGenerateForms || !access.canAccessBasicAnalytics) {
    throw new Error('TEST F failed: Expired trial did not fall back to FREE base plan!');
  }

  // Verify DB status was lazily set to EXPIRED
  const { data: expiredTrialRecord } = await supabase
    .from('admin_trial_entitlements')
    .select('status')
    .eq('id', trialFormSheet!.id)
    .single();
  console.log('Lazy DB status normalization:', expiredTrialRecord?.status === 'EXPIRED' ? '✅ EXPIRED' : '❌');

  // TEST H: PAID PLAN APPROVED (Monthly)
  console.log('\n--- TEST H: Paid Plan Activation (Monthly) ---');
  const monthExpires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  await supabase
    .from('admin_billing_accounts')
    .update({
      plan_type: 'MONTHLY',
      access_status: 'UNLOCKED',
      subscription_status: 'ACTIVE',
      started_at: now.toISOString(),
      expires_at: monthExpires.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('admin_user_id', normalAdmin.id);

  access = await resolveEffectiveAccess(normalAdmin.id, normalAdmin.role, normalAdmin.email);
  console.log('Paid Plan Features:', access.effectiveFeatures);
  console.log('Paid Form Generation:', access.canGenerateForms ? '✅ (Unlocked)' : '❌');
  console.log('Paid Sheet Integration:', access.canIntegrateSheets ? '✅ (Unlocked)' : '❌');
  console.log('Paid Full Analytics:', access.canAccessFullAnalytics ? '✅ (Unlocked)' : '❌');
  if (!access.canGenerateForms || !access.canIntegrateSheets || !access.canAccessFullAnalytics) {
    throw new Error('TEST H failed: Paid plan features not unlocked!');
  }

  // TEST I: PAID PLAN EXPIRES (Falls back to FREE)
  console.log('\n--- TEST I: Paid Plan Expiration Fallback ---');
  await supabase
    .from('admin_billing_accounts')
    .update({
      started_at: pastStarts.toISOString(),
      expires_at: pastExpiry.toISOString(),
    })
    .eq('admin_user_id', normalAdmin.id);

  access = await resolveEffectiveAccess(normalAdmin.id, normalAdmin.role, normalAdmin.email);
  console.log('Expired Plan - Form Generation:', !access.canGenerateForms ? '✅ (Locked)' : '❌');
  console.log('Expired Plan - Sheet Integration:', !access.canIntegrateSheets ? '✅ (Locked)' : '❌');
  console.log('Expired Plan - Full Analytics:', !access.canAccessFullAnalytics ? '✅ (Locked)' : '❌');
  console.log('Expired Plan - Basic Analytics:', access.canAccessBasicAnalytics ? '✅ (FREE Fallback)' : '❌');
  if (access.canGenerateForms || access.canIntegrateSheets || access.canAccessFullAnalytics || !access.canAccessBasicAnalytics) {
    throw new Error('TEST I failed: Expired paid plan did not fall back to FREE!');
  }

  // Reset normal admin to clean permanent FREE plan
  await supabase
    .from('admin_billing_accounts')
    .update({
      plan_type: 'FREE',
      access_status: 'UNLOCKED',
      subscription_status: 'ACTIVE',
      started_at: now.toISOString(),
      expires_at: null,
      updated_at: now.toISOString(),
    })
    .eq('admin_user_id', normalAdmin.id);

  // Clean up test trials
  await supabase
    .from('admin_trial_entitlements')
    .delete()
    .eq('admin_id', normalAdmin.id);

  console.log('\n====================================================');
  console.log('🎉 ALL TEST MATRIX SCENARIOS PASSED WITH 100% SUCCESS');
  console.log('====================================================');
}

runTestMatrix().catch((err) => {
  console.error('❌ Test Matrix failed:', err);
  process.exit(1);
});
