'use server';

import {
  getFormAnalyticsData,
  getOverallAnalyticsData,
  type ScopeFilters,
} from '@/lib/analytics/service';
import { getAdminSession } from '@/lib/auth/admin-auth';
import { createClient } from '@/lib/supabase/server';
import { syncFormResponsesToSheet } from '@/lib/google/sync';
import { isGoogleConfigured } from '@/lib/google/auth';
import { isValidUUID } from '@/lib/validation';
import type { FormAnalyticsReport, AggregatedAnalyticsReport } from '@/lib/analytics/types';

export type { ScopeFilters };

/**
 * Server action to fetch real-time analytics for a specific feedback form.
 * Directly delegates to authoritative shared analytics service.
 */
export async function getFormAnalyticsAction(
  formId: string,
  options?: { client?: any }
): Promise<{
  success: boolean;
  error?: string;
  report?: FormAnalyticsReport;
}> {
  return getFormAnalyticsData(formId, options);
}

/**
 * Server action to fetch institutional scope analytics aggregated across matching feedback forms.
 */
export async function getOverallAnalyticsAction(
  filters?: ScopeFilters,
  options?: { client?: any }
): Promise<{
  success: boolean;
  error?: string;
  report?: AggregatedAnalyticsReport;
}> {
  return getOverallAnalyticsData(filters, options);
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
    .select('*')
    .eq('id', formId)
    .single();

  if (error || !form) {
    return { success: false, error: 'Form not found.' };
  }

  const resolvedFormId =
    form.google_form_id ||
    form.google_form_edit_url?.match(/\/forms\/d\/([a-zA-Z0-9_-]+)/)?.[1] ||
    form.google_form_url?.match(/\/forms\/d\/([a-zA-Z0-9_-]+)/)?.[1];

  const resolvedSheetId =
    form.google_sheet_id ||
    form.google_sheet_url?.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)?.[1];

  if (!resolvedFormId || !resolvedSheetId) {
    return { success: false, error: 'Google Form ID or Sheet ID not associated with this record.' };
  }

  if (!isGoogleConfigured()) {
    return {
      success: false,
      error: 'Google OAuth credentials are not configured on this server. Configure GOOGLE_REFRESH_TOKEN in .env.local to enable response synchronization.',
    };
  }

  const syncRes = await syncFormResponsesToSheet({
    googleFormId: resolvedFormId,
    googleSheetId: resolvedSheetId,
    formId,
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
