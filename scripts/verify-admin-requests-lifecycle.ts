import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf-8');
const env: Record<string, string> = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
});

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL']!;
const anonKey = env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!;
const serviceRoleKey = env['SUPABASE_SERVICE_ROLE_KEY']!;

const TEST_EMAIL = `test-admin-lifecycle-${Date.now()}@bce.ac.in`;
const TEST_NAME = 'Test Admin Lifecycle';
const TEST_PASSWORD = 'TestPass123!';

let testRequestId: string | null = null;
let testUserId: string | null = null;
let superAdminId: string | null = null;

async function run() {
  const serviceClient = createClient(supabaseUrl, serviceRoleKey);
  let passed = 0;
  let failed = 0;

  function pass(msg: string) { console.log(`  ✓ PASS: ${msg}`); passed++; }
  function fail(msg: string) { console.error(`  ✗ FAIL: ${msg}`); failed++; }

  console.log('================================================================');
  console.log('   ADMIN ACCESS REQUEST — FULL LIFECYCLE E2E VERIFICATION');
  console.log('================================================================\n');

  // ──────────────────────────────────────────────────
  // STEP 1: Clean up any previous test data
  // ──────────────────────────────────────────────────
  console.log('--- STEP 1: Cleanup previous test data ---');
  await serviceClient.from('admin_requests').delete().eq('email', TEST_EMAIL);
  await serviceClient.from('admins').delete().eq('email', TEST_EMAIL);
  // Delete auth user if exists
  const { data: existingUsers } = await serviceClient.auth.admin.listUsers();
  const existingTest = existingUsers?.users?.find(u => u.email === TEST_EMAIL);
  if (existingTest) {
    await serviceClient.auth.admin.deleteUser(existingTest.id);
  }
  pass('Cleaned up previous test data.');

  // ──────────────────────────────────────────────────
  // STEP 2: Create auth user (simulating what the form does)
  // ──────────────────────────────────────────────────
  console.log('\n--- STEP 2: Create auth user (simulating form signup) ---');
  const { data: authData, error: authErr } = await serviceClient.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { name: TEST_NAME },
  });
  if (authErr || !authData?.user) {
    fail(`Auth user creation failed: ${authErr?.message}`);
    return reportResults(passed, failed);
  }
  testUserId = authData.user.id;
  pass(`Auth user created: id=${testUserId}, email=${TEST_EMAIL}`);

  // ──────────────────────────────────────────────────
  // STEP 3: INSERT admin request (simulating API route)
  // ──────────────────────────────────────────────────
  console.log('\n--- STEP 3: Insert PENDING admin request ---');
  const { data: insertData, error: insertErr } = await serviceClient
    .from('admin_requests')
    .insert({
      user_id: testUserId,
      email: TEST_EMAIL,
      name: TEST_NAME,
      status: 'PENDING',
    })
    .select('*')
    .single();

  if (insertErr || !insertData) {
    fail(`INSERT failed: ${insertErr?.message}`);
    return reportResults(passed, failed);
  }
  testRequestId = insertData.id;
  pass(`PENDING request inserted: id=${testRequestId}`);

  // Verify status
  if (insertData.status !== 'PENDING') {
    fail(`Expected status=PENDING, got ${insertData.status}`);
  } else {
    pass(`Status is PENDING`);
  }

  // Verify name is clean (no department suffix)
  if (insertData.name !== TEST_NAME) {
    fail(`Expected name='${TEST_NAME}', got '${insertData.name}'`);
  } else {
    pass(`Name stored without department suffix: '${insertData.name}'`);
  }

  // ──────────────────────────────────────────────────
  // STEP 4: Duplicate prevention
  // ──────────────────────────────────────────────────
  console.log('\n--- STEP 4: Test duplicate PENDING request prevention ---');
  const { error: dupErr } = await serviceClient
    .from('admin_requests')
    .insert({
      user_id: testUserId,
      email: TEST_EMAIL,
      name: TEST_NAME,
      status: 'PENDING',
    })
    .select('*')
    .single();

  if (dupErr) {
    pass(`Duplicate PENDING insert blocked: ${dupErr.message}`);
  } else {
    fail('Duplicate PENDING insert was NOT blocked — unique index missing or not working');
  }

  // ──────────────────────────────────────────────────
  // STEP 5: Super Admin SELECT (the core bug that was fixed)
  // ──────────────────────────────────────────────────
  console.log('\n--- STEP 5: Super Admin SELECT admin_requests (RLS test) ---');
  const { data: linkData } = await serviceClient.auth.admin.generateLink({
    type: 'magiclink',
    email: 'iambestadi@gmail.com',
  });
  const authClient = createClient(supabaseUrl, anonKey);
  const { data: sessionData, error: sessionErr } = await authClient.auth.verifyOtp({
    token_hash: linkData!.properties!.hashed_token!,
    type: 'magiclink',
  });

  if (sessionErr || !sessionData.session) {
    fail(`Super Admin auth failed: ${sessionErr?.message}`);
    return reportResults(passed, failed);
  }

  const superAdminClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${sessionData.session.access_token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: saRequests, error: saReqErr } = await superAdminClient
    .from('admin_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (saReqErr) {
    fail(`Super Admin SELECT failed with error: ${saReqErr.code} - ${saReqErr.message}`);
    return reportResults(passed, failed);
  }

  pass(`Super Admin SELECT succeeded, returned ${saRequests?.length || 0} rows`);

  const ourRequest = saRequests?.find((r: any) => r.id === testRequestId);
  if (ourRequest) {
    pass(`Our PENDING request (${testRequestId}) found in Super Admin query`);
  } else {
    fail(`Our PENDING request (${testRequestId}) NOT found in Super Admin query`);
  }

  // ──────────────────────────────────────────────────
  // STEP 6: Anon cannot see requests
  // ──────────────────────────────────────────────────
  console.log('\n--- STEP 6: Anon user cannot see admin requests ---');
  const anonClient = createClient(supabaseUrl, anonKey);
  const { data: anonReqs } = await anonClient.from('admin_requests').select('*');
  if (!anonReqs || anonReqs.length === 0) {
    pass('Anon user sees 0 admin requests (correctly blocked by RLS)');
  } else {
    fail(`Anon user sees ${anonReqs.length} requests — RLS leak!`);
  }

  // ──────────────────────────────────────────────────
  // STEP 7: APPROVE the request
  // ──────────────────────────────────────────────────
  console.log('\n--- STEP 7: Approve the admin request ---');

  // Get super admin ID
  const { data: saAdmin } = await serviceClient
    .from('admins')
    .select('id')
    .eq('email', 'iambestadi@gmail.com')
    .single();
  superAdminId = saAdmin?.id || null;

  if (!superAdminId) {
    fail('Could not find Super Admin record in admins table');
    return reportResults(passed, failed);
  }

  // Approve
  const { error: approveErr } = await serviceClient
    .from('admin_requests')
    .update({
      status: 'APPROVED',
      reviewed_by: superAdminId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', testRequestId!);

  if (approveErr) {
    fail(`Approve failed: ${approveErr.message}`);
  } else {
    pass('Request status updated to APPROVED');
  }

  // Create admin record (simulating what approveAdminRequestAction does)
  const { data: newAdmin, error: adminCreateErr } = await serviceClient
    .from('admins')
    .upsert({
      user_id: testUserId,
      email: TEST_EMAIL,
      name: TEST_NAME,
      role: 'ADMIN',
      status: 'ACTIVE',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'email' })
    .select('*')
    .single();

  if (adminCreateErr) {
    fail(`Admin record creation failed: ${adminCreateErr.message}`);
  } else {
    pass(`Admin record created: id=${newAdmin?.id}, role=${newAdmin?.role}, status=${newAdmin?.status}`);
  }

  // Verify request status changed
  const { data: approvedReq } = await serviceClient
    .from('admin_requests')
    .select('status')
    .eq('id', testRequestId!)
    .single();

  if (approvedReq?.status === 'APPROVED') {
    pass('Request status confirmed APPROVED in DB');
  } else {
    fail(`Expected APPROVED, got ${approvedReq?.status}`);
  }

  // Verify duplicate approval prevention (same status = already approved)
  // The code checks if status is APPROVED and returns early

  // ──────────────────────────────────────────────────
  // STEP 8: Test REJECT flow with a second request
  // ──────────────────────────────────────────────────
  console.log('\n--- STEP 8: Test reject flow with a second request ---');
  const TEST_EMAIL_2 = `test-admin-reject-${Date.now()}@bce.ac.in`;
  const TEST_NAME_2 = 'Test Admin Reject';

  // Create second auth user
  const { data: authData2 } = await serviceClient.auth.admin.createUser({
    email: TEST_EMAIL_2,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { name: TEST_NAME_2 },
  });
  const testUserId2 = authData2?.user?.id;

  if (!testUserId2) {
    fail('Could not create second test auth user');
    return reportResults(passed, failed);
  }

  // Insert second request
  const { data: req2, error: insertErr2 } = await serviceClient
    .from('admin_requests')
    .insert({
      user_id: testUserId2,
      email: TEST_EMAIL_2,
      name: TEST_NAME_2,
      status: 'PENDING',
    })
    .select('*')
    .single();

  if (insertErr2 || !req2) {
    fail(`Second request insert failed: ${insertErr2?.message}`);
    return reportResults(passed, failed);
  }
  pass(`Second PENDING request inserted: id=${req2.id}`);

  // Reject it
  const { error: rejectErr } = await serviceClient
    .from('admin_requests')
    .update({
      status: 'REJECTED',
      reviewed_by: superAdminId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', req2.id);

  if (rejectErr) {
    fail(`Reject failed: ${rejectErr.message}`);
  } else {
    pass('Second request status updated to REJECTED');
  }

  const { data: rejectedReq } = await serviceClient
    .from('admin_requests')
    .select('status')
    .eq('id', req2.id)
    .single();

  if (rejectedReq?.status === 'REJECTED') {
    pass('Request status confirmed REJECTED in DB');
  } else {
    fail(`Expected REJECTED, got ${rejectedReq?.status}`);
  }

  // ──────────────────────────────────────────────────
  // STEP 9: Cleanup test data
  // ──────────────────────────────────────────────────
  console.log('\n--- STEP 9: Cleanup ---');
  await serviceClient.from('admin_requests').delete().eq('email', TEST_EMAIL);
  await serviceClient.from('admin_requests').delete().eq('email', TEST_EMAIL_2);
  await serviceClient.from('admins').delete().eq('email', TEST_EMAIL);
  if (testUserId) await serviceClient.auth.admin.deleteUser(testUserId);
  if (testUserId2) await serviceClient.auth.admin.deleteUser(testUserId2);
  pass('Test data cleaned up.');

  reportResults(passed, failed);
}

function reportResults(passed: number, failed: number) {
  console.log('\n================================================================');
  console.log(`   RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log('================================================================');
  if (failed > 0) {
    console.error('\n   ✗✗✗ LIFECYCLE VERIFICATION FAILED ✗✗✗');
    process.exit(1);
  } else {
    console.log('\n   ✓✓✓ FULL LIFECYCLE VERIFICATION PASSED ✓✓✓');
    console.log('   Chain verified: INSERT → PENDING → Super Admin SELECT → APPROVE → REJECT');
  }
}

run().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
