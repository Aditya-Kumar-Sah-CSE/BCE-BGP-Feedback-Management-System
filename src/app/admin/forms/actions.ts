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
export async function getFeedbackFormsAction(filters?: {
  academicYearId?: string;
  branchId?: string;
  semesterId?: string;
  status?: FeedbackFormStatus;
  search?: string;
}) {
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isActive) {
    return { success: false, error: 'Unauthorized. Active admin session required.', forms: [] };
  }

  const supabase = await getAdminDb();

  let query = supabase
    .from('feedback_forms')
    .select(`
      *,
      faculty:faculties(*),
      subject:subjects(*),
      academic_year:academic_years(*),
      branch:branches(*),
      semester:semesters(*)
    `)
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

  const { data, error } = await query;

  if (error) {
    return { success: false, error: error.message, forms: [] };
  }

  let forms = (data || []) as FeedbackForm[];

  if (filters?.search && filters.search.trim()) {
    const searchLower = filters.search.toLowerCase().trim();
    forms = forms.filter(f =>
      f.title?.toLowerCase().includes(searchLower) ||
      f.faculty?.name?.toLowerCase().includes(searchLower) ||
      f.subject?.name?.toLowerCase().includes(searchLower) ||
      f.subject?.code?.toLowerCase().includes(searchLower)
    );
  }

  return { success: true, forms };
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
    // 4. Create Google Form + Add 8 Questions
    googleFormResult = await createGoogleFeedbackForm({ title, description });
    await logAuditAction(
      supabase,
      { adminId, email: adminEmail },
      'FORM_CREATED',
      'feedback_forms',
      googleFormResult.formId,
      `Created Google Form (${googleFormResult.formId}) with 8 standard BCE evaluation parameters`
    );

    // 5. Create connected Google Sheet + Headers
    googleSheetResult = await createFeedbackSpreadsheet({ title });
    await logAuditAction(
      supabase,
      { adminId, email: adminEmail },
      'SHEET_CREATED',
      'feedback_forms',
      googleSheetResult.spreadsheetId,
      `Created Google Sheet (${googleSheetResult.spreadsheetId}) with styled headers`
    );

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
    let currentPayload = { ...insertPayload };

    for (let attempt = 0; attempt < 8; attempt++) {
      const { data: inserted, error: insertErr } = await supabase
        .from('feedback_forms')
        .insert(currentPayload)
        .select()
        .single();

      if (!insertErr && inserted) {
        savedForm = inserted as FeedbackForm;
        break;
      }

      if (insertErr) {
        console.warn(`feedback_forms insert attempt ${attempt + 1} failed:`, insertErr.message);

        // Pattern 1: PGRST204 "Could not find the 'xyz' column of 'feedback_forms' in the schema cache"
        const missingColMatch = insertErr.message.match(/Could not find the '([^']+)' column/i);
        // Pattern 2: Postgres 42703 'column "xyz" of relation "feedback_forms" does not exist'
        const undefColMatch = insertErr.message.match(/column "([^"]+)"/i);
        const colToRemove = missingColMatch?.[1] || undefColMatch?.[1];

        if (colToRemove && colToRemove in currentPayload) {
          console.warn(`Stripping missing column '${colToRemove}' and retrying insert...`);
          delete currentPayload[colToRemove];
          continue;
        }

        throw new Error(`Failed to save feedback form record to database: ${insertErr.message}`);
      }
    }

    if (!savedForm) {
      throw new Error('Failed to save feedback form record to database: unknown database error');
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
    .select('id, title, google_form_id, google_sheet_id')
    .eq('id', formId)
    .single();

  if (fetchErr || !form) {
    return { success: false, error: 'Form not found' };
  }

  if (!form.google_form_id || !form.google_sheet_id) {
    return {
      success: false,
      error: 'Form is missing Google Form ID or Google Sheet ID.',
    };
  }

  const syncResult = await syncFormResponsesToSheet({
    googleFormId: form.google_form_id,
    googleSheetId: form.google_sheet_id,
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
