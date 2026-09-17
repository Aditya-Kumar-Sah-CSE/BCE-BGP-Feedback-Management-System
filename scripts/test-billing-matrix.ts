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
const FEATURE_ANALYTICS_PDF = 'Analytics PDF reports';

function planHasFeature(features: string[] | null | undefined, featureName: string): boolean {
  if (!features || !Array.isArray(features)) return false;

  const target = featureName.trim().toLowerCase().replace(/[\s_-]+/g, ' ');

  const aliasGroups: Record<string, string[]> = {
    form: ['google form generation', 'form generation', 'form_generation'],
    sheet: ['google sheet integration', 'sheet integration', 'sheet_integration', 'sheet sync'],
    basic: ['basic analytics', 'basic_analytics'],
    full: ['full analytics access', 'full analytics', 'full_analytics'],
    pdf: ['analytics pdf reports', 'analytics pdf', 'analytics_pdf', 'pdf reports', 'pdf_reports', 'pdf reports and exports', 'pdf reports/exports', 'pdf export', 'pdf exports'],
  };

  return features.some((f) => {
    const norm = String(f).trim().toLowerCase().replace(/[\s_-]+/g, ' ');
    if (norm === target || norm.includes(target) || target.includes(norm)) return true;

    for (const group of Object.values(aliasGroups)) {
      const matchesF = group.some(alias => norm.includes(alias) || alias.includes(norm));
      const matchesTarget = group.some(alias => target.includes(alias) || alias.includes(target));
      if (matchesF && matchesTarget) return true;
    }

    return false;
  });
}

async function resolveEffectiveAccess(adminId: string, role: string, email: string) {
  if (role === 'SUPER_ADMIN' || email.toLowerCase().trim() === 'iambestadi@gmail.com') {
    return {
      isSuperAdmin: true,
      canGenerateForms: true,
      canIntegrateSheets: true,
      canAccessBasicAnalytics: true,
      canAccessFullAnalytics: true,
      canAccessPdf: true,
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
    canAccessBasicAnalytics: planHasFeature(effectiveFeatures, FEATURE_BASIC_ANALYTICS),
    canAccessFullAnalytics: planHasFeature(effectiveFeatures, FEATURE_FULL_ANALYTICS_ACCESS),
    canAccessPdf: planHasFeature(effectiveFeatures, FEATURE_ANALYTICS_PDF),
  };
}

async function runTestMatrix() {
  console.log('====================================================');
  console.log('🚀 MANDATORY BILLING & PLAN ENTITLEMENT TEST MATRIX');
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

  // ----------------------------------------------------
  // MATRIX ROW 1: FREE PLAN
  // ----------------------------------------------------
  console.log('--- 1. FREE PLAN ENTITLEMENT VERIFICATION ---');
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

  let access = await resolveEffectiveAccess(normalAdmin.id, normalAdmin.role, normalAdmin.email);
  console.log('FREE Features:', access.effectiveFeatures);
  console.log('FREE → Form Generation:    ', !access.canGenerateForms ? 'DENIED ✅' : 'ALLOWED ❌');
  console.log('FREE → Sheet Integration:   ', !access.canIntegrateSheets ? 'DENIED ✅' : 'ALLOWED ❌');
  console.log('FREE → Basic Analytics:     ', access.canAccessBasicAnalytics ? 'ALLOWED ✅' : 'DENIED ❌');
  console.log('FREE → Full Analytics:      ', !access.canAccessFullAnalytics ? 'DENIED ✅' : 'ALLOWED ❌');
  console.log('FREE → PDF Reports/Exports: ', !access.canAccessPdf ? 'DENIED ✅' : 'ALLOWED ❌');

  if (access.canGenerateForms || access.canIntegrateSheets || !access.canAccessBasicAnalytics || access.canAccessFullAnalytics || access.canAccessPdf) {
    throw new Error('FREE PLAN MATRIX FAILED: Only Basic Analytics must be ALLOWED, all others DENIED!');
  }

  // ----------------------------------------------------
  // MATRIX ROW 2: BASIC PLAN
  // ----------------------------------------------------
  console.log('\n--- 2. BASIC PLAN ENTITLEMENT VERIFICATION ---');
  const now = new Date();
  const monthExpires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  await supabase
    .from('admin_billing_accounts')
    .update({
      plan_type: 'BASIC',
      access_status: 'UNLOCKED',
      subscription_status: 'ACTIVE',
      started_at: now.toISOString(),
      expires_at: monthExpires.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('admin_user_id', normalAdmin.id);

  access = await resolveEffectiveAccess(normalAdmin.id, normalAdmin.role, normalAdmin.email);
  console.log('BASIC Features:', access.effectiveFeatures);
  console.log('BASIC → Form Generation:    ', access.canGenerateForms ? 'ALLOWED ✅' : 'DENIED ❌');
  console.log('BASIC → Sheet Integration:   ', access.canIntegrateSheets ? 'ALLOWED ✅' : 'DENIED ❌');
  console.log('BASIC → Basic Analytics:     ', access.canAccessBasicAnalytics ? 'ALLOWED ✅' : 'DENIED ❌');
  console.log('BASIC → Full Analytics:      ', !access.canAccessFullAnalytics ? 'DENIED ✅' : 'ALLOWED ❌');
  console.log('BASIC → PDF Reports/Exports: ', !access.canAccessPdf ? 'DENIED ✅' : 'ALLOWED ❌');

  if (!access.canGenerateForms || !access.canIntegrateSheets || !access.canAccessBasicAnalytics || access.canAccessFullAnalytics || access.canAccessPdf) {
    throw new Error('BASIC PLAN MATRIX FAILED: Form, Sheet, Basic Analytics must be ALLOWED, Full Analytics & PDF must be DENIED!');
  }

  // ----------------------------------------------------
  // MATRIX ROW 3: FULL ACCESS PLAN
  // ----------------------------------------------------
  console.log('\n--- 3. FULL ACCESS PLAN ENTITLEMENT VERIFICATION ---');
  await supabase
    .from('admin_billing_accounts')
    .update({
      plan_type: 'FULL_ACCESS',
      access_status: 'UNLOCKED',
      subscription_status: 'ACTIVE',
      started_at: now.toISOString(),
      expires_at: monthExpires.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('admin_user_id', normalAdmin.id);

  access = await resolveEffectiveAccess(normalAdmin.id, normalAdmin.role, normalAdmin.email);
  console.log('FULL ACCESS Features:', access.effectiveFeatures);
  console.log('FULL ACCESS → Form Generation:    ', access.canGenerateForms ? 'ALLOWED ✅' : 'DENIED ❌');
  console.log('FULL ACCESS → Sheet Integration:   ', access.canIntegrateSheets ? 'ALLOWED ✅' : 'DENIED ❌');
  console.log('FULL ACCESS → Basic Analytics:     ', access.canAccessBasicAnalytics ? 'ALLOWED ✅' : 'DENIED ❌');
  console.log('FULL ACCESS → Full Analytics:      ', access.canAccessFullAnalytics ? 'ALLOWED ✅' : 'DENIED ❌');
  console.log('FULL ACCESS → PDF Reports/Exports: ', access.canAccessPdf ? 'ALLOWED ✅' : 'DENIED ❌');

  if (!access.canGenerateForms || !access.canIntegrateSheets || !access.canAccessBasicAnalytics || !access.canAccessFullAnalytics || !access.canAccessPdf) {
    throw new Error('FULL ACCESS PLAN MATRIX FAILED: All 5 features must be ALLOWED!');
  }

  // ----------------------------------------------------
  // MATRIX ROW 4: SUPER ADMIN UNRESTRICTED ACCESS
  // ----------------------------------------------------
  console.log('\n--- 4. SUPER ADMIN UNRESTRICTED ACCESS ---');
  const superAccess = await resolveEffectiveAccess(superAdmin.id, superAdmin.role, superAdmin.email);
  console.log('Super Admin → Form Generation:    ', superAccess.canGenerateForms ? 'ALLOWED ✅' : 'DENIED ❌');
  console.log('Super Admin → Sheet Integration:   ', superAccess.canIntegrateSheets ? 'ALLOWED ✅' : 'DENIED ❌');
  console.log('Super Admin → Basic Analytics:     ', superAccess.canAccessBasicAnalytics ? 'ALLOWED ✅' : 'DENIED ❌');
  console.log('Super Admin → Full Analytics:      ', superAccess.canAccessFullAnalytics ? 'ALLOWED ✅' : 'DENIED ❌');
  console.log('Super Admin → PDF Reports/Exports: ', superAccess.canAccessPdf ? 'ALLOWED ✅' : 'DENIED ❌');

  if (!superAccess.canGenerateForms || !superAccess.canIntegrateSheets || !superAccess.canAccessBasicAnalytics || !superAccess.canAccessFullAnalytics || !superAccess.canAccessPdf) {
    throw new Error('SUPER ADMIN MATRIX FAILED: Must have unrestricted access to all features!');
  }

  // ----------------------------------------------------
  // MATRIX ROW 5: ACTIVE TRIAL ON FREE PLAN (Selective Unlock)
  // ----------------------------------------------------
  console.log('\n--- 5. ACTIVE TRIAL (Granting only PDF + Full Analytics on FREE) ---');
  // Reset admin to FREE
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

  const expires7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const { data: trialSelective } = await supabase
    .from('admin_trial_entitlements')
    .insert({
      admin_id: normalAdmin.id,
      granted_by: superAdmin.id,
      starts_at: now.toISOString(),
      expires_at: expires7d.toISOString(),
      status: 'ACTIVE',
      features: [FEATURE_FULL_ANALYTICS_ACCESS, FEATURE_ANALYTICS_PDF],
      note: 'Selective Trial: Analytics + PDF',
    })
    .select('*')
    .single();

  access = await resolveEffectiveAccess(normalAdmin.id, normalAdmin.role, normalAdmin.email);
  console.log('Trial Features:', access.effectiveFeatures);
  console.log('Trial → Form Generation:    ', !access.canGenerateForms ? 'DENIED ✅ (Not in trial)' : 'ALLOWED ❌');
  console.log('Trial → Sheet Integration:   ', !access.canIntegrateSheets ? 'DENIED ✅ (Not in trial)' : 'ALLOWED ❌');
  console.log('Trial → Basic Analytics:     ', access.canAccessBasicAnalytics ? 'ALLOWED ✅ (Base FREE)' : 'DENIED ❌');
  console.log('Trial → Full Analytics:      ', access.canAccessFullAnalytics ? 'ALLOWED ✅ (From trial)' : 'DENIED ❌');
  console.log('Trial → PDF Reports/Exports: ', access.canAccessPdf ? 'ALLOWED ✅ (From trial)' : 'DENIED ❌');

  if (access.canGenerateForms || access.canIntegrateSheets || !access.canAccessBasicAnalytics || !access.canAccessFullAnalytics || !access.canAccessPdf) {
    throw new Error('SELECTIVE TRIAL MATRIX FAILED!');
  }

  // ----------------------------------------------------
  // MATRIX ROW 6: TRIAL EXPIRY FALLBACK
  // ----------------------------------------------------
  console.log('\n--- 6. TRIAL EXPIRY FALLBACK TO FREE ---');
  const pastStarts = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const pastExpiry = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);

  await supabase
    .from('admin_trial_entitlements')
    .update({
      starts_at: pastStarts.toISOString(),
      expires_at: pastExpiry.toISOString(),
    })
    .eq('id', trialSelective!.id);

  access = await resolveEffectiveAccess(normalAdmin.id, normalAdmin.role, normalAdmin.email);
  console.log('Expired Trial → Form Generation:    ', !access.canGenerateForms ? 'DENIED ✅' : 'ALLOWED ❌');
  console.log('Expired Trial → Sheet Integration:   ', !access.canIntegrateSheets ? 'DENIED ✅' : 'ALLOWED ❌');
  console.log('Expired Trial → Basic Analytics:     ', access.canAccessBasicAnalytics ? 'ALLOWED ✅ (Base FREE fallback)' : 'DENIED ❌');
  console.log('Expired Trial → Full Analytics:      ', !access.canAccessFullAnalytics ? 'DENIED ✅ (Trial expired)' : 'ALLOWED ❌');
  console.log('Expired Trial → PDF Reports/Exports: ', !access.canAccessPdf ? 'DENIED ✅ (Trial expired)' : 'ALLOWED ❌');

  if (access.canGenerateForms || access.canIntegrateSheets || !access.canAccessBasicAnalytics || access.canAccessFullAnalytics || access.canAccessPdf) {
    throw new Error('TRIAL EXPIRY FALLBACK FAILED: Must revert to FREE base plan!');
  }

  // ----------------------------------------------------
  // MATRIX ROW 7: PAID PLAN EXPIRY FALLBACK
  // ----------------------------------------------------
  console.log('\n--- 7. PAID PLAN EXPIRY FALLBACK TO FREE ---');
  await supabase
    .from('admin_billing_accounts')
    .update({
      plan_type: 'FULL_ACCESS',
      access_status: 'UNLOCKED',
      subscription_status: 'ACTIVE',
      started_at: pastStarts.toISOString(),
      expires_at: pastExpiry.toISOString(),
    })
    .eq('admin_user_id', normalAdmin.id);

  access = await resolveEffectiveAccess(normalAdmin.id, normalAdmin.role, normalAdmin.email);
  console.log('Expired Paid → Form Generation:    ', !access.canGenerateForms ? 'DENIED ✅' : 'ALLOWED ❌');
  console.log('Expired Paid → Sheet Integration:   ', !access.canIntegrateSheets ? 'DENIED ✅' : 'ALLOWED ❌');
  console.log('Expired Paid → Basic Analytics:     ', access.canAccessBasicAnalytics ? 'ALLOWED ✅ (Base FREE fallback)' : 'DENIED ❌');
  console.log('Expired Paid → Full Analytics:      ', !access.canAccessFullAnalytics ? 'DENIED ✅ (Plan expired)' : 'ALLOWED ❌');
  console.log('Expired Paid → PDF Reports/Exports: ', !access.canAccessPdf ? 'DENIED ✅ (Plan expired)' : 'ALLOWED ❌');

  if (access.canGenerateForms || access.canIntegrateSheets || !access.canAccessBasicAnalytics || access.canAccessFullAnalytics || access.canAccessPdf) {
    throw new Error('PAID PLAN EXPIRY FALLBACK FAILED: Must revert to FREE base plan!');
  }

  // ----------------------------------------------------
  // CLEANUP
  // ----------------------------------------------------
  await supabase
    .from('admin_trial_entitlements')
    .delete()
    .eq('admin_id', normalAdmin.id);

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

  console.log('\n====================================================');
  console.log('🎉 ALL MANDATORY TEST MATRIX CHECKS PASSED (100%)');
  console.log('====================================================');
}

runTestMatrix().catch((err) => {
  console.error('❌ Test Matrix failed:', err);
  process.exit(1);
});
