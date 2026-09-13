import { getGoogleServices } from './auth';
import { appendResponsesToSheet, getExistingSheetResponseIds } from './sheets';
import { BCE_FEEDBACK_PARAMETERS } from './template';

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  totalResponses: number;
  message: string;
  error?: string;
}

/**
 * Synchronizes submitted Google Form responses into the connected Google Sheet
 * using official Google Forms API v1 and Google Sheets API v4.
 *
 * Idempotent: Skips response IDs that are already present in the sheet.
 */
export async function syncFormResponsesToSheet(params: {
  googleFormId: string;
  googleSheetId: string;
}): Promise<SyncResult> {
  const { googleFormId, googleSheetId } = params;

  try {
    const { forms } = getGoogleServices();

    // 1. Fetch form structure to map question IDs to questions 1..8
    const formMetadata = await forms.forms.get({ formId: googleFormId });
    const items = formMetadata.data.items || [];

    // Map questionId -> parameter index (0..7)
    const questionIdToParamIndex = new Map<string, number>();

    items.forEach(item => {
      const qId = item.questionItem?.question?.questionId;
      const title = item.title || '';
      if (qId) {
        // Find which parameter matches this item title
        const paramIndex = BCE_FEEDBACK_PARAMETERS.findIndex(
          p => title.toLowerCase().includes(p.title.toLowerCase())
        );
        if (paramIndex !== -1) {
          questionIdToParamIndex.set(qId, paramIndex);
        }
      }
    });

    // 2. Fetch all submitted responses from Forms API
    const responsesRes = await forms.forms.responses.list({ formId: googleFormId });
    const allResponses = responsesRes.data.responses || [];
    const totalResponses = allResponses.length;

    if (totalResponses === 0) {
      return {
        success: true,
        syncedCount: 0,
        totalResponses: 0,
        message: 'No responses submitted yet in Google Form.',
      };
    }

    // 3. Check which responses are already recorded in the Google Sheet
    const existingIds = await getExistingSheetResponseIds(googleSheetId);

    const rowsToAppend: (string | number)[][] = [];

    for (const resp of allResponses) {
      const responseId = resp.responseId || '';
      if (existingIds.has(responseId)) {
        continue; // Already synced
      }

      const timestamp = resp.lastSubmittedTime || resp.createTime || new Date().toISOString();
      const answerRow: string[] = new Array(8).fill('N/A');

      if (resp.answers) {
        for (const [qId, answerObj] of Object.entries(resp.answers)) {
          const paramIdx = questionIdToParamIndex.get(qId);
          if (paramIdx !== undefined && paramIdx >= 0 && paramIdx < 8) {
            const val = answerObj.textAnswers?.answers?.[0]?.value || '';
            answerRow[paramIdx] = val;
          }
        }
      }

      rowsToAppend.push([
        timestamp,
        responseId,
        ...answerRow,
      ]);
    }

    // 4. Append new response rows to the sheet
    if (rowsToAppend.length > 0) {
      await appendResponsesToSheet(googleSheetId, rowsToAppend);
    }

    return {
      success: true,
      syncedCount: rowsToAppend.length,
      totalResponses,
      message:
        rowsToAppend.length > 0
          ? `Successfully synchronized ${rowsToAppend.length} new response(s) to Google Sheet (Total: ${totalResponses}).`
          : `Sheet is up to date (${totalResponses} response(s) already recorded).`,
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      syncedCount: 0,
      totalResponses: 0,
      message: `Failed to synchronize responses: ${errMsg}`,
      error: errMsg,
    };
  }
}
