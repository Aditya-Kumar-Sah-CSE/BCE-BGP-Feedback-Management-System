'use server';

import { createClient } from '@/lib/supabase/server';
import { getAdminSession } from '@/lib/auth/admin-auth';
import { fetchRawSheetResponses } from '@/lib/analytics/sheets-reader';
import { normalizeSheetRows } from '@/lib/analytics/normalizer';
import { calculateFormAnalytics, aggregateAnalytics } from '@/lib/analytics/engine';
import type { FormAnalyticsReport, AggregatedAnalyticsReport } from '@/lib/analytics/types';
import { syncFormResponsesToSheet } from '@/lib/google/sync';
import { isGoogleConfigured } from '@/lib/google/auth';
import { isValidUUID } from '@/lib/validation';

/**
 * Fetches real-time analytics for a specific feedback form.
 * Directly sources responses from the connected Google Sheet and normalizes them.
 */
export async function getFormAnalyticsAction(formId: string): Promise<{
  success: boolean;
  error?: string;
  report?: FormAnalyticsReport;
}> {
  // 1. Admin Authentication Check
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isActive) {
    return { success: false, error: 'Unauthorized. Active admin credentials required.' };
  }

  if (!isValidUUID(formId)) {
    return { success: false, error: 'Invalid feedback form identifier format.' };
  }

  const supabase = await createClient();

  // 2. Fetch Form Metadata
  const { data: form, error: formErr } = await supabase
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

  if (formErr || !form) {
    return { success: false, error: formErr?.message || 'Feedback form not found.' };
  }

  // 3. Fetch Real Response Data from Google Sheet
  let canonicalRows: ReturnType<typeof normalizeSheetRows> = [];

  if (form.google_sheet_id && isGoogleConfigured()) {
    try {
      const sheetData = await fetchRawSheetResponses(form.google_sheet_id);
      if (sheetData.rows.length > 0) {
        canonicalRows = normalizeSheetRows(sheetData.headers, sheetData.rows);

        // Update database response_count if changed
        if (form.response_count !== sheetData.totalRowCount) {
          await supabase
            .from('feedback_forms')
            .update({
              response_count: sheetData.totalRowCount,
              updated_at: new Date().toISOString(),
            })
            .eq('id', formId);
        }
      }
    } catch (sheetErr) {
      console.warn(`Could not read sheet for form ${formId}:`, sheetErr);
    }
  }

  // 4. Compute Unified Analytics
  const report = calculateFormAnalytics({
    formId: form.id,
    title: form.title,
    academicYear: form.academic_year?.name || 'Academic Session',
    branch: form.branch?.name || 'Branch',
    semester: form.semester?.name || 'Semester',
    facultyName: form.faculty?.name || 'Faculty Member',
    subjectName: form.subject?.name || 'Subject',
    subjectCode: form.subject?.code || '',
    formType: form.form_type || 'FACULTY_SPECIFIC',
    status: form.status,
    lastSyncedAt: form.last_synced_at,
    googleSheetUrl: form.google_sheet_url,
    googleFormUrl: form.google_form_url,
    responses: canonicalRows,
  });

  return { success: true, report };
}

export interface ScopeFilters {
  academicYearId?: string;
  branchId?: string;
  semesterId?: string;
  facultyId?: string;
  subjectId?: string;
}

/**
 * Fetches institutional scope analytics aggregated across matching feedback forms.
 */
export async function getOverallAnalyticsAction(filters?: ScopeFilters): Promise<{
  success: boolean;
  error?: string;
  report?: AggregatedAnalyticsReport;
}> {
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isActive) {
    return { success: false, error: 'Unauthorized. Active admin credentials required.' };
  }

  // Validate filter UUIDs if present
  if (filters?.academicYearId && filters.academicYearId !== 'ALL' && !isValidUUID(filters.academicYearId)) {
    return { success: false, error: 'Invalid Academic Year filter format.' };
  }
  if (filters?.branchId && filters.branchId !== 'ALL' && !isValidUUID(filters.branchId)) {
    return { success: false, error: 'Invalid Branch filter format.' };
  }
  if (filters?.semesterId && filters.semesterId !== 'ALL' && !isValidUUID(filters.semesterId)) {
    return { success: false, error: 'Invalid Semester filter format.' };
  }
  if (filters?.facultyId && filters.facultyId !== 'ALL' && !isValidUUID(filters.facultyId)) {
    return { success: false, error: 'Invalid Faculty filter format.' };
  }
  if (filters?.subjectId && filters.subjectId !== 'ALL' && !isValidUUID(filters.subjectId)) {
    return { success: false, error: 'Invalid Subject filter format.' };
  }

  const supabase = await createClient();

  // Query matching feedback forms
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
  if (filters?.facultyId && filters.facultyId !== 'ALL') {
    query = query.eq('faculty_id', filters.facultyId);
  }
  if (filters?.subjectId && filters.subjectId !== 'ALL') {
    query = query.eq('subject_id', filters.subjectId);
  }

  const { data: forms, error: formsErr } = await query;

  if (formsErr) {
    return { success: false, error: formsErr.message };
  }

  const allForms = forms || [];

  // Compute individual form reports
  const formReports: FormAnalyticsReport[] = [];

  for (const form of allForms) {
    let canonicalRows: ReturnType<typeof normalizeSheetRows> = [];

    if (form.google_sheet_id && isGoogleConfigured()) {
      try {
        const sheetData = await fetchRawSheetResponses(form.google_sheet_id);
        if (sheetData.rows.length > 0) {
          canonicalRows = normalizeSheetRows(sheetData.headers, sheetData.rows);
        }
      } catch (err) {
        console.warn(`Error reading sheet for form ${form.id}:`, err);
      }
    }

    const singleReport = calculateFormAnalytics({
      formId: form.id,
      title: form.title,
      academicYear: form.academic_year?.name || 'Academic Session',
      branch: form.branch?.name || 'Branch',
      semester: form.semester?.name || 'Semester',
      facultyName: form.faculty?.name || 'Faculty Member',
      subjectName: form.subject?.name || 'Subject',
      subjectCode: form.subject?.code || '',
      formType: form.form_type || 'FACULTY_SPECIFIC',
      status: form.status,
      lastSyncedAt: form.last_synced_at,
      googleSheetUrl: form.google_sheet_url,
      googleFormUrl: form.google_form_url,
      responses: canonicalRows,
    });

    formReports.push(singleReport);
  }

  // Determine human-readable scope title
  const parts: string[] = [];
  let academicYearName = '';
  let branchName = '';
  let semesterName = '';
  let facultyName = '';
  let subjectName = '';

  if (formReports.length > 0) {
    if (filters?.academicYearId && filters.academicYearId !== 'ALL') {
      academicYearName = formReports[0].academicYear;
      parts.push(academicYearName);
    }
    if (filters?.branchId && filters.branchId !== 'ALL') {
      branchName = formReports[0].branch;
      parts.push(branchName);
    }
    if (filters?.semesterId && filters.semesterId !== 'ALL') {
      semesterName = formReports[0].semester;
      parts.push(semesterName);
    }
    if (filters?.facultyId && filters.facultyId !== 'ALL') {
      facultyName = formReports[0].facultyName;
      parts.push(facultyName);
    }
    if (filters?.subjectId && filters.subjectId !== 'ALL') {
      subjectName = `${formReports[0].subjectName} (${formReports[0].subjectCode})`;
      parts.push(subjectName);
    }
  }

  const scopeTitle = parts.length > 0 ? parts.join(' → ') : 'Institution-Wide (All Active Feedback)';

  const aggregated = aggregateAnalytics(formReports, scopeTitle, {
    academicYearId: filters?.academicYearId,
    academicYearName,
    branchId: filters?.branchId,
    branchName,
    semesterId: filters?.semesterId,
    semesterName,
    facultyId: filters?.facultyId,
    facultyName,
    subjectId: filters?.subjectId,
    subjectName,
  });

  return { success: true, report: aggregated };
}

/**
 * Triggers on-demand response synchronization from Google Forms into Google Sheet,
 * then returns the updated sync status and count.
 */
export async function syncSingleFormResponsesAction(formId: string) {
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isActive) {
    return { success: false, error: 'Unauthorized. Active admin credentials required.' };
  }

  if (!isValidUUID(formId)) {
    return { success: false, error: 'Invalid feedback form identifier format.' };
  }

  const supabase = await createClient();
  const { data: form, error } = await supabase
    .from('feedback_forms')
    .select('id, title, google_form_id, google_sheet_id')
    .eq('id', formId)
    .single();

  if (error || !form) {
    return { success: false, error: 'Form not found.' };
  }

  if (!form.google_form_id || !form.google_sheet_id) {
    return { success: false, error: 'Google Form ID or Sheet ID not associated with this record.' };
  }

  if (!isGoogleConfigured()) {
    return {
      success: false,
      error: 'Google OAuth credentials are not configured on this server. Configure GOOGLE_REFRESH_TOKEN in .env.local to enable response synchronization.',
    };
  }

  const syncRes = await syncFormResponsesToSheet({
    googleFormId: form.google_form_id,
    googleSheetId: form.google_sheet_id,
  });

  if (!syncRes.success) {
    return { success: false, error: syncRes.message };
  }

  const nowIso = new Date().toISOString();
  await supabase
    .from('feedback_forms')
    .update({
      response_count: syncRes.totalResponses,
      last_synced_at: nowIso,
      updated_at: nowIso,
    })
    .eq('id', formId);

  return {
    success: true,
    message: syncRes.message,
    syncedCount: syncRes.syncedCount,
    totalResponses: syncRes.totalResponses,
  };
}
