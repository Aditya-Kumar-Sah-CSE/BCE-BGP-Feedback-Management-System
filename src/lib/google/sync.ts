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
    const { forms, sheets } = getGoogleServices();

    // 1. Fetch form structure to map question IDs
    const formMetadata = await forms.forms.get({ formId: googleFormId });
    const items = formMetadata.data.items || [];

    // Map questionId -> parameter index (0..7) and identification / comment fields
    const questionIdToParamIndex = new Map<string, number>();
    let studentNameQuestionId: string | null = null;
    let regNoQuestionId: string | null = null;
    let commentsQuestionId: string | null = null;

    items.forEach(item => {
      const qId = item.questionItem?.question?.questionId;
      const title = (item.title || '').trim().toLowerCase();
      if (!qId) return;

      if (title.includes('student name') || (title.includes('name') && !title.includes('faculty') && !title.includes('subject'))) {
        studentNameQuestionId = qId;
      } else if (title.includes('registration') || title.includes('reg') || title.includes('roll')) {
        regNoQuestionId = qId;
      } else if (title.includes('comment') || title.includes('suggestion')) {
        commentsQuestionId = qId;
      } else {
        // Find which 8-parameter matches this item title
        const paramIndex = BCE_FEEDBACK_PARAMETERS.findIndex(
          p => title.includes(p.title.toLowerCase())
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

    // 3. Inspect target Google Sheet headers to format rows accordingly
    let sheetHasStudentCols = true;
    try {
      const headerRes = await sheets.spreadsheets.values.get({
        spreadsheetId: googleSheetId,
        range: "'Form Responses'!1:1",
      });
      const headerValues = (headerRes.data.values?.[0] || []).map(h => String(h).toLowerCase());
      if (headerValues.length > 0 && !headerValues.some(h => h.includes('student name') || h.includes('name'))) {
        sheetHasStudentCols = false;
      }
    } catch {
      sheetHasStudentCols = true;
    }

    // 4. Check which responses are already recorded in the Google Sheet
    const existingIds = await getExistingSheetResponseIds(googleSheetId);

    const rowsToAppend: (string | number)[][] = [];

    for (const resp of allResponses) {
      const responseId = resp.responseId || '';
      if (existingIds.has(responseId)) {
        continue; // Already synced
      }

      const timestamp = resp.lastSubmittedTime || resp.createTime || new Date().toISOString();
      const studentName = (studentNameQuestionId && resp.answers?.[studentNameQuestionId]?.textAnswers?.answers?.[0]?.value) || '';
      const regNo = (regNoQuestionId && resp.answers?.[regNoQuestionId]?.textAnswers?.answers?.[0]?.value) || '';
      const comments = (commentsQuestionId && resp.answers?.[commentsQuestionId]?.textAnswers?.answers?.[0]?.value) || '';

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

      if (sheetHasStudentCols) {
        rowsToAppend.push([
          timestamp,
          responseId,
          studentName,
          regNo,
          ...answerRow,
          comments,
        ]);
      } else {
        rowsToAppend.push([
          timestamp,
          responseId,
          ...answerRow,
        ]);
      }
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
