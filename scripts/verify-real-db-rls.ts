import { createClient } from '@supabase/supabase-js';
import { validateAndPrepareFormDraftAction, provisionGoogleFormAndSheetAction } from '../src/app/admin/forms/actions';
import { getGoogleServices } from '../src/lib/google/auth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function verifyRealDbRls() {
  console.log('================================================================');
  console.log('           REAL DATABASE RLS & FACULTY FEEDBACK TEST            ');
  console.log('================================================================\n');

  // 1. Get real authenticated admin session for iambestadi@gmail.com
  console.log('1. Authenticating as Super Admin (iambestadi@gmail.com)...');
  const serviceClient = createClient(supabaseUrl, serviceRoleKey);
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
    throw new Error(`Failed to authenticate admin: ${sessionErr?.message}`);
  }

  const accessToken = sessionData.session.access_token;
  console.log('✓ Obtained authenticated admin JWT.');

  // Create client carrying the user Bearer token (strictly user authenticated, no service role)
  const authenticatedClient = createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  // Verify that public.is_admin returns true for this user
  const { data: adminRecord } = await authenticatedClient
    .from('admins')
    .select('id, user_id, email, role, status')
    .eq('email', 'iambestadi@gmail.com')
    .single();

  console.log('✓ Authenticated admin record:', adminRecord);

  // 2. Fetch an active faculty-subject assignment
  const { data: assignment, error: asgErr } = await authenticatedClient
    .from('faculty_subject_assignments')
    .select(`
      id,
      academic_year_id,
      branch_id,
      semester_id,
      faculty_id,
      subject_id,
      faculty:faculties(id, name),
      subject:subjects(id, name, code)
    `)
    .eq('is_active', true)
    .limit(1)
    .single();

  if (asgErr || !assignment) {
    throw new Error(`Failed to find active assignment for test: ${asgErr?.message}`);
  }

  console.log('✓ Found active assignment for test:', {
    assignmentId: assignment.id,
    faculty: (assignment.faculty as any)?.name,
    subject: (assignment.subject as any)?.name,
  });

  // 3. Test validateAndPrepareFormDraftAction with authenticatedClient
  console.log('\n2. Testing validateAndPrepareFormDraftAction (FACULTY_FEEDBACK)...');
  const payload = {
    academicYearId: assignment.academic_year_id,
    branchId: assignment.branch_id,
    semesterId: assignment.semester_id,
    facultyId: assignment.faculty_id,
    subjectId: assignment.subject_id,
    formType: 'FACULTY_FEEDBACK' as const,
    items: [
      {
        facultyId: assignment.faculty_id,
        subjectId: assignment.subject_id,
        assignmentId: assignment.id,
      },
    ],
  };

  // Clean any previous test form for this assignment
  await serviceClient
    .from('feedback_forms')
    .delete()
    .eq('academic_year_id', assignment.academic_year_id)
    .eq('branch_id', assignment.branch_id)
    .eq('semester_id', assignment.semester_id)
    .eq('faculty_id', assignment.faculty_id)
    .eq('subject_id', assignment.subject_id);

  const prepRes = await validateAndPrepareFormDraftAction(payload, authenticatedClient);
  console.log('Draft Preparation Result:', {
    success: prepRes.success,
    draftFormId: prepRes.draftFormId,
    error: prepRes.error,
    itemsCount: (prepRes as any).validatedItems?.length,
  });

  if (!prepRes.success || !prepRes.draftFormId) {
    throw new Error(`Draft preparation failed: ${prepRes.error}`);
  }

  // Verify feedback_forms row in DB
  const { data: dbForm, error: formQueryErr } = await authenticatedClient
    .from('feedback_forms')
    .select('id, title, status, form_type, created_by')
    .eq('id', prepRes.draftFormId)
    .single();

  if (formQueryErr || !dbForm) {
    throw new Error(`Failed to query created draft form: ${formQueryErr?.message}`);
  }

  console.log('✓ feedback_forms row exists in database:', dbForm);
  console.log('✓ created_by references admins.id:', dbForm.created_by === adminRecord?.id ? 'MATCHES admins.id' : `MISMATCH: ${dbForm.created_by} vs ${adminRecord?.id}`);
  if (dbForm.created_by !== adminRecord?.id) {
    throw new Error('created_by does not match adminRecord.id');
  }

  const validatedItems = (prepRes as any).validatedItems;
  console.log(`✓ form has exactly one validated item: ${validatedItems?.length === 1 ? 'YES' : 'NO'}`);
  if (!validatedItems || validatedItems.length !== 1) {
    throw new Error(`Expected 1 validated item, got: ${validatedItems?.length}`);
  }

  // 4. Test provisionGoogleFormAndSheetAction
  console.log('\n3. Testing provisionGoogleFormAndSheetAction with authenticatedClient...');
  const provRes = await provisionGoogleFormAndSheetAction({
    draftFormId: prepRes.draftFormId,
    title: prepRes.title || 'Verification Form',
    description: prepRes.description || '',
    items: validatedItems,
    client: authenticatedClient,
  });

  console.log('Provisioning Result:', {
    success: provRes.success,
    formId: provRes.form?.google_form_id,
    sheetId: provRes.form?.google_sheet_id,
    error: provRes.error,
  });

  if (!provRes.success || !provRes.form) {
    throw new Error(`Provisioning failed: ${provRes.error}`);
  }

  console.log('✓ Google Form created:', provRes.form.google_form_id);
  console.log('✓ Google Sheet created:', provRes.form.google_sheet_id);

  // Verify feedback_form_items junction table in DB
  const { data: itemRows, error: itemsErr } = await serviceClient
    .from('feedback_form_items')
    .select('*')
    .eq('form_id', prepRes.draftFormId);

  console.log(`✓ feedback_form_items entries: ${itemRows?.length}`, itemsErr ? `Error: ${itemsErr.message}` : '');
  if (!itemRows || itemRows.length !== 1) {
    throw new Error(`Expected 1 item in feedback_form_items, got: ${itemRows?.length}`);
  }

  // 5. Verify unauthenticated client CANNOT insert into feedback_forms
  console.log('\n4. Testing Unauthenticated Request Security Restriction...');
  const unauthenticatedClient = createClient(supabaseUrl, anonKey);
  const { data: unauthData, error: unauthErr } = await unauthenticatedClient
    .from('feedback_forms')
    .insert({
      title: 'Hacker Attempt Form',
      academic_year_id: assignment.academic_year_id,
      branch_id: assignment.branch_id,
      semester_id: assignment.semester_id,
      faculty_id: assignment.faculty_id,
      subject_id: assignment.subject_id,
      form_type: 'FACULTY_FEEDBACK',
      status: 'DRAFT',
      slug: 'hacker-attempt-' + Date.now(),
      created_by: adminRecord?.id,
    })
    .select()
    .single();

  console.log('Unauthenticated Insert Result:', unauthData ? 'VIOLATION: INSERT SUCCEEDED' : 'BLOCKED', 'Error code:', unauthErr?.code, 'Message:', unauthErr?.message);
  if (!unauthErr || unauthErr.code !== '42501') {
    throw new Error(`Expected RLS 42501 error for unauthenticated user, got: ${unauthErr?.code} ${unauthErr?.message}`);
  }
  console.log('✓ RLS correctly denied unauthenticated INSERT with code 42501.');

  // Clean up test form and Google files
  console.log('\n5. Cleaning up test artifacts...');
  await authenticatedClient.from('feedback_form_items').delete().eq('form_id', prepRes.draftFormId);
  await authenticatedClient.from('feedback_forms').delete().eq('id', prepRes.draftFormId);
  console.log('✓ Cleaned up test form from Supabase.');

  try {
    const { drive } = getGoogleServices();
    if (provRes.form?.google_form_id) {
      await drive.files.delete({ fileId: provRes.form.google_form_id });
    }
    if (provRes.form?.google_sheet_id) {
      await drive.files.delete({ fileId: provRes.form.google_sheet_id });
    }
    console.log('✓ Cleaned up test Google Form and Sheet from Drive.');
  } catch (driveCleanErr) {
    console.log('Note: Drive cleanup notice:', driveCleanErr);
  }

  console.log('\n================================================================');
  console.log('     REAL DATABASE RLS + 5-POINT FACULTY FORM PASSED 100%       ');
  console.log('================================================================\n');
}

verifyRealDbRls().catch(err => {
  console.error('\nFAILED REAL DB RLS TEST:', err);
  process.exit(1);
});
