'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAdminSession } from '@/lib/auth/admin-auth';

async function getAdminDb() {
  return createAdminClient() || await createClient();
}
import { FeedbackForm, FeedbackFormStatus } from '@/types/database';
import { isGoogleConfigured, getGoogleConfigStatus } from '@/lib/google/auth';
import { createGoogleFeedbackForm } from '@/lib/google/forms';
import { createFeedbackSpreadsheet } from '@/lib/google/sheets';
import { linkFormToSpreadsheet } from '@/lib/google/linking';
import { syncFormResponsesToSheet } from '@/lib/google/sync';
import {
  generateFeedbackFormTitle,
  generateFeedbackFormDescription,
} from '@/lib/google/template';
import { isValidUUID, createFormPayloadSchema, formStatusSchema } from '@/lib/validation';

// Helper: Record audit logs
async function logAuditAction(
  supabase: any,
  actor: { adminId?: string | null; email?: string },
  action: string,
  entityType: string,
  entityId: string,
  details: string,
  metadata: Record<string, unknown> = {}
) {
  try {
    await supabase.from('audit_logs').insert({
      admin_id: actor.adminId || null,
      actor_email: actor.email,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
      metadata,
    });
  } catch (err) {
    console.error('Audit log write error:', err);
  }
}

/**
 * Check Google configuration status for the UI
 */
export async function getGoogleStatusAction() {
  return getGoogleConfigStatus();
}

/**
 * Fetch feedback forms with optional filters
 */
/**
 * Fetch feedback forms with optional filters and pagination
 */
export async function getFeedbackFormsAction(filters?: {
  academicYearId?: string;
  branchId?: string;
  semesterId?: string;
  status?: FeedbackFormStatus;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isActive) {
    return { success: false, error: 'Unauthorized. Active admin session required.', forms: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
  }

  const supabase = await getAdminDb();
  const page = filters?.page ? Math.max(1, filters.page) : 1;
  const pageSize = filters?.pageSize ? Math.max(5, Math.min(100, filters.pageSize)) : 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('feedback_forms')
    .select(`
      id,
      title,
      description,
      academic_year_id,
      branch_id,
      semester_id,
      faculty_id,
      subject_id,
      form_type,
      status,
      slug,
      google_form_url,
      google_sheet_url,
      response_destination_type,
      response_count,
      created_at,
      published_at,
      closed_at,
      faculty:faculties(id, name, department),
      subject:subjects(id, name, code),
      academic_year:academic_years(id, name),
      branch:branches(id, name, code),
      semester:semesters(id, name)
    `, { count: 'exact' })
    .order('created_at', { ascending: false });

  if (filters?.academicYearId && filters.academicYearId !== 'ALL') {
    query = query.eq('academic_year_id', filters.academicYearId);
  }
  if (filters?.branchId && filters.branchId !== 'ALL') {
    query = query.eq('branch_id', filters.branchId);
  }
  if (filters?.semesterId && filters.semesterId !== 'ALL') {
    query = query.eq('semester_id', filters.semesterId);
  }
  if (filters?.status && (filters.status as string) !== 'ALL') {
    query = query.eq('status', filters.status);
  }
  if (filters?.search && filters.search.trim()) {
    const q = filters.search.trim();
    query = query.or(`title.ilike.%${q}%,slug.ilike.%${q}%`);
  }

  if (filters?.page) {
    query = query.range(from, to);
  }

  const { data, count, error } = await query;

  if (error) {
    return { success: false, error: error.message, forms: [], total: 0, page, pageSize, totalPages: 0 };
  }

  const total = count || 0;
  const forms = (data || []) as unknown as FeedbackForm[];

  return {
    success: true,
    forms,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * Fetch a single feedback form with its details and audit logs
 */
export async function getFeedbackFormByIdAction(formId: string) {
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isActive) {
    return { success: false, error: 'Unauthorized. Active admin session required.' };
  }

  if (!isValidUUID(formId)) {
    return { success: false, error: 'Invalid feedback form identifier format.' };
  }

  const supabase = await getAdminDb();

  const { data: form, error } = await supabase
    .from('feedback_forms')
    .select(`
      *,
      faculty:faculties(*),
      subject:subjects(*),
      academic_year:academic_years(*),
      branch:branches(*),
      semester:semesters(*)
    `)
    .eq('id', formId)
    .single();

  if (error || !form) {
    return { success: false, error: error?.message || 'Form not found' };
  }

  // Fetch form-specific audit logs
  const { data: logs } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('entity_id', formId)
    .order('created_at', { ascending: false });

  return {
    success: true,
    form: form as FeedbackForm,
    auditLogs: logs || [],
  };
}

export interface CreateFormPayload {
  academicYearId: string;
  branchId: string;
  semesterId: string;
  facultyId: string;
  subjectId: string;
  formType: 'FACULTY_SPECIFIC' | 'BRANCH_SPECIFIC';
}

/**
 * 6-Step Admin Form Generation Flow
 * Generates Google Form + 8 BCE questions, creates Google Sheet,
 * links responses (native or application-managed), records Supabase metadata and audit logs.
 */
export async function createGoogleFeedbackFormAction(payload: CreateFormPayload) {
  // 1. Authorization check
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isActive) {
    return { success: false, error: 'Unauthorized. Active admin session required.' };
  }

  // 2. Validate input payload
  const validation = createFormPayloadSchema.safeParse(payload);
  if (!validation.success) {
    const issue = validation.error.issues[0];
    return { success: false, error: issue ? issue.message : 'Invalid form creation parameters.' };
  }

  const adminId = session.admin?.id || session.user?.id || null;
  const adminEmail = session.admin?.email || session.user?.email || '';

  const supabase = await getAdminDb();

  // 2. Validate Academic Relationships
  // Fetch academic year, branch, semester, faculty, subject
  const [
    { data: academicYear },
    { data: branch },
    { data: semester },
    { data: faculty },
    { data: subject },
  ] = await Promise.all([
    supabase.from('academic_years').select('*').eq('id', payload.academicYearId).single(),
    supabase.from('branches').select('*').eq('id', payload.branchId).single(),
    supabase.from('semesters').select('*').eq('id', payload.semesterId).single(),
    supabase.from('faculties').select('*').eq('id', payload.facultyId).single(),
    supabase.from('subjects').select('*').eq('id', payload.subjectId).single(),
  ]);

  if (!academicYear || !academicYear.is_active) {
    return { success: false, error: 'Selected Academic Year is invalid or inactive.' };
  }
  if (!branch || !branch.is_active) {
    return { success: false, error: 'Selected Branch is invalid or inactive.' };
  }
  if (!semester || !semester.is_active) {
    return { success: false, error: 'Selected Semester is invalid or inactive.' };
  }
  if (!faculty || !faculty.is_active) {
    return { success: false, error: 'Selected Faculty is invalid or inactive.' };
  }
  if (!subject || !subject.is_active) {
    return { success: false, error: 'Selected Subject is invalid or inactive.' };
  }

  // Validate Faculty-Subject assignment exists in this session
  const { data: assignment } = await supabase
    .from('faculty_subject_assignments')
    .select('id')
    .eq('academic_year_id', payload.academicYearId)
    .eq('faculty_id', payload.facultyId)
    .eq('subject_id', payload.subjectId)
    .eq('is_active', true)
    .maybeSingle();

  if (!assignment) {
    return {
      success: false,
      error: `Invalid assignment: ${faculty.name} is not assigned to teach ${subject.name} (${subject.code}) in ${academicYear.name}. Please assign them in Academic Management first.`,
    };
  }

  // Idempotency check: Check if an active/draft form already exists for this exact combination
  const { data: existingForm } = await supabase
    .from('feedback_forms')
    .select('id, status, title')
    .eq('academic_year_id', payload.academicYearId)
    .eq('branch_id', payload.branchId)
    .eq('semester_id', payload.semesterId)
    .eq('faculty_id', payload.facultyId)
    .eq('subject_id', payload.subjectId)
    .in('status', ['DRAFT', 'PUBLISHED'])
    .maybeSingle();

  if (existingForm) {
    return {
      success: false,
      error: `A feedback form already exists for this faculty and subject in this session (${existingForm.title}, Status: ${existingForm.status}). Please edit or archive the existing form instead of creating a duplicate.`,
    };
  }

  // Check Google API configuration
  if (!isGoogleConfigured()) {
    return {
      success: false,
      error:
        'Google API credentials are not configured on the server. Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN (or GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) in .env.local.',
    };
  }

  // 3. Generate Form Definitions
  const metaInputs = {
    facultyName: faculty.name,
    subjectName: `${subject.name} (${subject.code})`,
    semesterName: semester.name,
    academicYearName: academicYear.name,
    branchName: branch.name,
  };

  const title = generateFeedbackFormTitle(metaInputs);
  const description = generateFeedbackFormDescription(metaInputs);

  // Log start
  await logAuditAction(
    supabase,
    { adminId, email: adminEmail },
    'FORM_CREATE_STARTED',
    'feedback_forms',
    'pending',
    `Initiated form generation for ${title}`
  );

  let googleFormResult;
  let googleSheetResult;

  try {
    // 4 & 5. Concurrently create Google Form (+ 8 Questions) and connected Google Sheet (+ Headers)
    const [formResult, sheetResult] = await Promise.all([
      createGoogleFeedbackForm({ title, description }),
      createFeedbackSpreadsheet({ title }),
    ]);
    googleFormResult = formResult;
    googleSheetResult = sheetResult;

    await Promise.all([
      logAuditAction(
        supabase,
        { adminId, email: adminEmail },
        'FORM_CREATED',
        'feedback_forms',
        googleFormResult.formId,
        `Created Google Form (${googleFormResult.formId}) with 8 standard BCE evaluation parameters`
      ),
      logAuditAction(
        supabase,
        { adminId, email: adminEmail },
        'SHEET_CREATED',
        'feedback_forms',
        googleSheetResult.spreadsheetId,
        `Created Google Sheet (${googleSheetResult.spreadsheetId}) with styled headers`
      ),
    ]);

    // 6. Reliably connect Form responses to Sheet (Apps Script native or Application-Managed)
    const linkingResult = await linkFormToSpreadsheet(
      googleFormResult.formId,
      googleSheetResult.spreadsheetId
    );

    await logAuditAction(
      supabase,
      { adminId, email: adminEmail },
      'FORM_SHEET_LINKED',
      'feedback_forms',
      googleFormResult.formId,
      `Form-to-Sheet response connection mode: ${linkingResult.destinationType}. ${linkingResult.message}`,
      {
        formId: googleFormResult.formId,
        sheetId: googleSheetResult.spreadsheetId,
        destinationType: linkingResult.destinationType,
      }
    );

    // 7. Save metadata in Supabase
    // Generate safe unique slug
    const cleanSlug = `${faculty.name}-${subject.code}-${semester.name}-${academicYear.name}-${Date.now()}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const insertPayload: Record<string, any> = {
      title,
      description,
      academic_year_id: payload.academicYearId,
      branch_id: payload.branchId,
      semester_id: payload.semesterId,
      faculty_id: payload.facultyId,
      subject_id: payload.subjectId,
      form_type: payload.formType,
      status: 'DRAFT',
      slug: cleanSlug,
      google_form_id: googleFormResult.formId,
      google_form_url: googleFormResult.responderUri,
      google_form_edit_url: googleFormResult.editUri,
      google_sheet_id: googleSheetResult.spreadsheetId,
      google_sheet_url: googleSheetResult.spreadsheetUrl,
      response_destination_type: linkingResult.destinationType,
      response_count: 0,
      created_by: adminId,
    };

    let savedForm: FeedbackForm | null = null;
    const currentPayload = { ...insertPayload };
    let lastInsertError: any = null;

    const extractMissingCol = (msg: string): string | null => {
      const m1 = msg.match(/Could not find the '([^']+)' column/i);
      if (m1) return m1[1];
      const m2 = msg.match(/column (?:[a-zA-Z0-9_]+\.)?([a-zA-Z0-9_]+) does not exist/i);
      if (m2) return m2[1];
      const m3 = msg.match(/column "([^"]+)"/i);
      if (m3) return m3[1];
      return null;
    };

    for (let attempt = 0; attempt < 20; attempt++) {
      const { data: inserted, error: insertErr } = await supabase
        .from('feedback_forms')
        .insert(currentPayload)
        .select()
        .single();

      if (!insertErr && inserted) {
        savedForm = {
          ...insertPayload,
          ...inserted,
        } as FeedbackForm;
        break;
      }

      if (insertErr) {
        lastInsertError = insertErr;
        console.warn(`feedback_forms insert attempt ${attempt + 1} failed:`, insertErr.message);

        const colToRemove = extractMissingCol(insertErr.message);

        if (colToRemove && colToRemove in currentPayload) {
          console.warn(`Stripping missing column '${colToRemove}' from insert payload and retrying...`);
          delete currentPayload[colToRemove];
          continue;
        }

        throw new Error(`Failed to save feedback form record to database: ${insertErr.message}`);
      }
    }

    if (!savedForm) {
      throw new Error(`Failed to save feedback form record to database: ${lastInsertError?.message || 'Database schema column mismatch'}`);
    }

    revalidatePath('/admin/dashboard/forms');
    revalidatePath('/admin/dashboard');

    return {
      success: true,
      form: savedForm,
      destinationType: linkingResult.destinationType,
      message: `Google Form successfully created in DRAFT state. Response destination: ${
        linkingResult.destinationType === 'NATIVE_SHEET'
          ? 'Native Google Form Destination (Google Apps Script)'
          : 'Application-Managed Synchronization (Forms Responses API + Sheets API)'
      }.`,
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('Form creation failed:', err);

    await logAuditAction(
      supabase,
      { adminId, email: adminEmail },
      'FORM_CREATE_FAILED',
      'feedback_forms',
      googleFormResult?.formId || 'unknown',
      `Form creation aborted: ${errMsg}`,
      { error: errMsg }
    );

    return {
      success: false,
      error: `Google Form generation failed: ${errMsg}`,
    };
  }
}

/**
 * Step 1 of Staged Form Creation:
 * Fast Local Preparation (<150ms).
 * Validates assignment & idempotency, and stores Supabase DRAFT record.
 */
export async function validateAndPrepareFormDraftAction(payload: CreateFormPayload) {
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isActive) {
    return { success: false, error: 'Unauthorized. Active admin session required.' };
  }

  const validation = createFormPayloadSchema.safeParse(payload);
  if (!validation.success) {
    const issue = validation.error.issues[0];
    return { success: false, error: issue ? issue.message : 'Invalid form creation parameters.' };
  }

  const adminId = session.admin?.id || session.user?.id || null;
  const adminEmail = session.admin?.email || session.user?.email || '';
  const supabase = await getAdminDb();

  // Validate Academic Relationships with minimal column selects
  const [
    { data: academicYear },
    { data: branch },
    { data: semester },
    { data: faculty },
    { data: subject },
  ] = await Promise.all([
    supabase.from('academic_years').select('id, name, is_active').eq('id', payload.academicYearId).single(),
    supabase.from('branches').select('id, name, code, is_active').eq('id', payload.branchId).single(),
    supabase.from('semesters').select('id, name, is_active').eq('id', payload.semesterId).single(),
    supabase.from('faculties').select('id, name, is_active').eq('id', payload.facultyId).single(),
    supabase.from('subjects').select('id, name, code, is_active').eq('id', payload.subjectId).single(),
  ]);

  if (!academicYear || !academicYear.is_active) {
    return { success: false, error: 'Selected Academic Year is invalid or inactive.' };
  }
  if (!branch || !branch.is_active) {
    return { success: false, error: 'Selected Branch is invalid or inactive.' };
  }
  if (!semester || !semester.is_active) {
    return { success: false, error: 'Selected Semester is invalid or inactive.' };
  }
  if (!faculty || !faculty.is_active) {
    return { success: false, error: 'Selected Faculty is invalid or inactive.' };
  }
  if (!subject || !subject.is_active) {
    return { success: false, error: 'Selected Subject is invalid or inactive.' };
  }

  // Validate Faculty-Subject assignment
  const { data: assignment } = await supabase
    .from('faculty_subject_assignments')
    .select('id')
    .eq('academic_year_id', payload.academicYearId)
    .eq('faculty_id', payload.facultyId)
    .eq('subject_id', payload.subjectId)
    .eq('is_active', true)
    .maybeSingle();

  if (!assignment) {
    return {
      success: false,
      error: `Invalid assignment: ${faculty.name} is not assigned to teach ${subject.name} (${subject.code}) in ${academicYear.name}. Please assign them in Academic Management first.`,
    };
  }

  // Idempotency check: Form already exists?
  const { data: existingForm } = await supabase
    .from('feedback_forms')
    .select('id, status, title')
    .eq('academic_year_id', payload.academicYearId)
    .eq('branch_id', payload.branchId)
    .eq('semester_id', payload.semesterId)
    .eq('faculty_id', payload.facultyId)
    .eq('subject_id', payload.subjectId)
    .in('status', ['DRAFT', 'PUBLISHED'])
    .maybeSingle();

  if (existingForm) {
    return {
      success: false,
      error: `A feedback form already exists for this faculty and subject in this session (${existingForm.title}, Status: ${existingForm.status}). Please edit or archive the existing form instead of creating a duplicate.`,
    };
  }

  // Check Google API configuration
  if (!isGoogleConfigured()) {
    return {
      success: false,
      error:
        'Google API credentials are not configured on the server. Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN in .env.local.',
    };
  }

  const metaInputs = {
    facultyName: faculty.name,
    subjectName: `${subject.name} (${subject.code})`,
    semesterName: semester.name,
    academicYearName: academicYear.name,
    branchName: branch.name,
  };

  const title = generateFeedbackFormTitle(metaInputs);
  const description = generateFeedbackFormDescription(metaInputs);

  const cleanSlug = `${faculty.name}-${subject.code}-${semester.name}-${academicYear.name}-${Date.now()}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  const draftPayload = {
    title,
    description,
    academic_year_id: payload.academicYearId,
    branch_id: payload.branchId,
    semester_id: payload.semesterId,
    faculty_id: payload.facultyId,
    subject_id: payload.subjectId,
    form_type: payload.formType,
    status: 'DRAFT',
    slug: cleanSlug,
    response_count: 0,
    created_by: adminId,
  };

  const { data: draftRecord, error: insertErr } = await supabase
    .from('feedback_forms')
    .insert(draftPayload)
    .select()
    .single();

  if (insertErr || !draftRecord) {
    return {
      success: false,
      error: `Failed to initialize draft feedback form record: ${insertErr?.message || 'Database error'}`,
    };
  }

  await logAuditAction(
    supabase,
    { adminId, email: adminEmail },
    'FORM_CREATE_STARTED',
    'feedback_forms',
    draftRecord.id,
    `Initiated form generation for ${title}`
  );

  return {
    success: true,
    draftFormId: draftRecord.id,
    title,
    description,
    meta: metaInputs,
  };
}

/**
 * Step 2 of Staged Form Creation:
 * Remote Google API Work.
 * Concurrently creates Google Form + Google Sheet, links destination, and finalizes Supabase record.
 */
export async function provisionGoogleFormAndSheetAction(params: {
  draftFormId: string;
  title: string;
  description: string;
}) {
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isActive) {
    return { success: false, error: 'Unauthorized. Active admin session required.' };
  }

  const adminId = session.admin?.id || session.user?.id || null;
  const adminEmail = session.admin?.email || session.user?.email || '';
  const supabase = await getAdminDb();

  let googleFormResult;
  let googleSheetResult;

  try {
    // Concurrent creation of Google Form (+ 8 questions) and Google Sheet (+ styled headers)
    const [formResult, sheetResult] = await Promise.all([
      createGoogleFeedbackForm({ title: params.title, description: params.description }),
      createFeedbackSpreadsheet({ title: params.title }),
    ]);
    googleFormResult = formResult;
    googleSheetResult = sheetResult;

    // Link Form to Sheet
    const linkingResult = await linkFormToSpreadsheet(
      googleFormResult.formId,
      googleSheetResult.spreadsheetId
    );

    // Update Supabase draft record with finalized Google details
    const { data: updatedForm, error: updateErr } = await supabase
      .from('feedback_forms')
      .update({
        google_form_id: googleFormResult.formId,
        google_form_url: googleFormResult.responderUri,
        google_form_edit_url: googleFormResult.editUri,
        google_sheet_id: googleSheetResult.spreadsheetId,
        google_sheet_url: googleSheetResult.spreadsheetUrl,
        response_destination_type: linkingResult.destinationType,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.draftFormId)
      .select(`
        id,
        title,
        description,
        academic_year_id,
        branch_id,
        semester_id,
        faculty_id,
        subject_id,
        form_type,
        status,
        slug,
        google_form_id,
        google_form_url,
        google_form_edit_url,
        google_sheet_id,
        google_sheet_url,
        response_destination_type,
        response_count,
        created_at
      `)
      .single();

    if (updateErr) {
      console.warn('Failed to update draft record with Google details:', updateErr);
    }

    await Promise.all([
      logAuditAction(
        supabase,
        { adminId, email: adminEmail },
        'FORM_CREATED',
        'feedback_forms',
        googleFormResult.formId,
        `Created Google Form (${googleFormResult.formId}) with 8 standard BCE evaluation parameters`
      ),
      logAuditAction(
        supabase,
        { adminId, email: adminEmail },
        'SHEET_CREATED',
        'feedback_forms',
        googleSheetResult.spreadsheetId,
        `Created Google Sheet (${googleSheetResult.spreadsheetId}) with styled headers`
      ),
      logAuditAction(
        supabase,
        { adminId, email: adminEmail },
        'FORM_SHEET_LINKED',
        'feedback_forms',
        googleFormResult.formId,
        `Form-to-Sheet response connection mode: ${linkingResult.destinationType}. ${linkingResult.message}`,
        {
          formId: googleFormResult.formId,
          sheetId: googleSheetResult.spreadsheetId,
          destinationType: linkingResult.destinationType,
        }
      ),
    ]);

    return {
      success: true,
      form: updatedForm || {
        id: params.draftFormId,
        title: params.title,
        google_form_url: googleFormResult.responderUri,
        google_form_edit_url: googleFormResult.editUri,
        google_sheet_url: googleSheetResult.spreadsheetUrl,
        response_destination_type: linkingResult.destinationType,
      },
      destinationType: linkingResult.destinationType,
      message: `Google Form successfully created in DRAFT state. Response destination: ${
        linkingResult.destinationType === 'NATIVE_SHEET'
          ? 'Native Google Form Destination (Google Apps Script)'
          : 'Application-Managed Synchronization (Forms Responses API + Sheets API)'
      }.`,
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('Remote Google API provisioning failed:', err);

    // Clean up draft record on total failure so no orphan broken record remains
    try {
      await supabase.from('feedback_forms').delete().eq('id', params.draftFormId);
    } catch {
      // Ignore cleanup error
    }

    await logAuditAction(
      supabase,
      { adminId, email: adminEmail },
      'FORM_CREATE_FAILED',
      'feedback_forms',
      googleFormResult?.formId || params.draftFormId,
      `Form creation aborted: ${errMsg}`,
      { error: errMsg }
    );

    return {
      success: false,
      error: `Google Form generation failed: ${errMsg}`,
    };
  }
}


/**
 * Manage Form Status Lifecycle:
 * DRAFT → PUBLISHED → CLOSED → ARCHIVED
 */
export async function updateFormStatusAction(
  formId: string,
  newStatus: FeedbackFormStatus
) {
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isActive) {
    return { success: false, error: 'Unauthorized. Active admin session required.' };
  }

  if (!isValidUUID(formId)) {
    return { success: false, error: 'Invalid feedback form identifier format.' };
  }

  if (!formStatusSchema.safeParse(newStatus).success) {
    return { success: false, error: 'Invalid feedback form status value.' };
  }

  const adminId = session.admin?.id || session.user?.id || null;
  const adminEmail = session.admin?.email || session.user?.email || '';

  const supabase = await getAdminDb();

  // Fetch current form
  const { data: form, error: fetchErr } = await supabase
    .from('feedback_forms')
    .select('id, title, status')
    .eq('id', formId)
    .single();

  if (fetchErr || !form) {
    return { success: false, error: 'Form not found' };
  }

  const currentStatus = form.status as FeedbackFormStatus;

  // Validate allowed transitions
  const allowedTransitions: Record<FeedbackFormStatus, FeedbackFormStatus[]> = {
    DRAFT: ['PUBLISHED', 'ARCHIVED'],
    PUBLISHED: ['CLOSED', 'ARCHIVED'],
    CLOSED: ['PUBLISHED', 'ARCHIVED'], // Can reopen or archive
    ARCHIVED: ['DRAFT'], // Un-archive to draft
  };

  if (!allowedTransitions[currentStatus]?.includes(newStatus)) {
    return {
      success: false,
      error: `Invalid status transition: Cannot change form from ${currentStatus} to ${newStatus}.`,
    };
  }

  const updateData: Record<string, any> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  };

  const nowIso = new Date().toISOString();
  if (newStatus === 'PUBLISHED') updateData.published_at = nowIso;
  if (newStatus === 'CLOSED') updateData.closed_at = nowIso;
  if (newStatus === 'ARCHIVED') updateData.archived_at = nowIso;

  const { error: updateErr } = await supabase
    .from('feedback_forms')
    .update(updateData)
    .eq('id', formId);

  if (updateErr) {
    // Retry without new timestamp columns if database schema hasn't run migration
    const { error: fallbackErr } = await supabase
      .from('feedback_forms')
      .update({ status: newStatus, updated_at: nowIso })
      .eq('id', formId);

    if (fallbackErr) {
      return { success: false, error: fallbackErr.message };
    }
  }

  // Audit log
  const auditActionMap: Record<FeedbackFormStatus, string> = {
    DRAFT: 'FORM_UPDATED',
    PUBLISHED: 'FORM_PUBLISHED',
    CLOSED: 'FORM_CLOSED',
    ARCHIVED: 'FORM_ARCHIVED',
  };

  await logAuditAction(
    supabase,
    { adminId, email: adminEmail },
    auditActionMap[newStatus],
    'feedback_forms',
    formId,
    `Form "${form.title}" status changed from ${currentStatus} to ${newStatus}`
  );

  revalidatePath('/admin/dashboard/forms');
  revalidatePath(`/admin/dashboard/forms/${formId}`);
  revalidatePath('/');

  return {
    success: true,
    message: `Form status updated to ${newStatus}.`,
  };
}

/**
 * Trigger Response Synchronization (Application-Managed)
 */
export async function syncFormResponsesAction(formId: string) {
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isActive) {
    return { success: false, error: 'Unauthorized. Active admin session required.' };
  }

  if (!isValidUUID(formId)) {
    return { success: false, error: 'Invalid feedback form identifier format.' };
  }

  const adminId = session.admin?.id || session.user?.id || null;
  const adminEmail = session.admin?.email || session.user?.email || '';

  const supabase = await getAdminDb();

  const { data: form, error: fetchErr } = await supabase
    .from('feedback_forms')
    .select('*')
    .eq('id', formId)
    .single();

  if (fetchErr || !form) {
    return { success: false, error: `Form not found: ${fetchErr?.message || ''}` };
  }

  const resolvedFormId =
    form.google_form_id ||
    form.google_form_edit_url?.match(/\/forms\/d\/([a-zA-Z0-9_-]+)/)?.[1] ||
    form.google_form_url?.match(/\/forms\/d\/([a-zA-Z0-9_-]+)/)?.[1];

  const resolvedSheetId =
    form.google_sheet_id ||
    form.google_sheet_url?.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)?.[1];

  if (!resolvedFormId || !resolvedSheetId) {
    return {
      success: false,
      error: 'Form is missing Google Form ID or Google Sheet ID.',
    };
  }

  const syncResult = await syncFormResponsesToSheet({
    googleFormId: resolvedFormId,
    googleSheetId: resolvedSheetId,
  });

  if (!syncResult.success) {
    return { success: false, error: syncResult.message };
  }

  // Update Supabase sync metadata
  const nowIso = new Date().toISOString();
  try {
    await supabase
      .from('feedback_forms')
      .update({
        response_count: syncResult.totalResponses,
        last_synced_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', formId);
  } catch (err) {
    console.warn('Sync metadata update skipped (column may not exist yet):', err);
  }

  // Audit log
  await logAuditAction(
    supabase,
    { adminId, email: adminEmail },
    'FORM_RESPONSES_SYNCED',
    'feedback_forms',
    formId,
    `Synchronized responses for "${form.title}": ${syncResult.syncedCount} new row(s), total ${syncResult.totalResponses}`,
    {
      syncedCount: syncResult.syncedCount,
      totalResponses: syncResult.totalResponses,
    }
  );


  revalidatePath('/admin/dashboard/forms');
  revalidatePath(`/admin/dashboard/forms/${formId}`);

  return {
    success: true,
    message: syncResult.message,
    syncedCount: syncResult.syncedCount,
    totalResponses: syncResult.totalResponses,
  };
}
