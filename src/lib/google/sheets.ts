import { getGoogleServices } from './auth';
import { BCE_FEEDBACK_PARAMETERS } from './template';

export interface CreateSheetResult {
  spreadsheetId: string;
  spreadsheetUrl: string;
}

/**
 * Converts 1-based column number to spreadsheet letter (e.g., 1 -> A, 13 -> M)
 */
export function getColumnLetter(colIndex: number): string {
  let letter = '';
  let temp = colIndex;
  while (temp > 0) {
    const mod = (temp - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    temp = Math.floor((temp - mod) / 26);
  }
  return letter || 'A';
}

export const FEEDBACK_SHEET_HEADERS = [
  'Timestamp',
  'Response ID',
  'Student Name',
  'University Registration Number',
  ...BCE_FEEDBACK_PARAMETERS.map(p => `${p.id}. ${p.title}`),
  'Comments / Suggestions',
];

/**
 * Creates a new Google Spreadsheet for feedback responses and styles the header row
 */
export async function createFeedbackSpreadsheet(params: {
  title: string;
}): Promise<CreateSheetResult> {
  const { sheets } = getGoogleServices();

  const sheetTitle = `Responses — ${params.title}`;

  // 1. Create Spreadsheet
  const res = await sheets.spreadsheets.create({
    requestBody: {
      properties: {
        title: sheetTitle,
      },
      sheets: [
        {
          properties: {
            title: 'Form Responses',
            gridProperties: {
              frozenRowCount: 1,
            },
          },
        },
      ],
    },
  });

  const spreadsheetId = res.data.spreadsheetId;
  const spreadsheetUrl = res.data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  if (!spreadsheetId) {
    throw new Error('Google Sheets API failed to create spreadsheet');
  }

  const lastColLetter = getColumnLetter(FEEDBACK_SHEET_HEADERS.length);

  // 2. Initialize Header Row
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'Form Responses'!A1:${lastColLetter}1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [FEEDBACK_SHEET_HEADERS],
    },
  });

  // 3. Apply professional styling to header row (bold, dark navy background, white text)
  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: 0,
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: FEEDBACK_SHEET_HEADERS.length,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: {
                    red: 0.1,
                    green: 0.18,
                    blue: 0.36, // Navy BCE tone
                  },
                  textFormat: {
                    foregroundColor: {
                      red: 1.0,
                      green: 1.0,
                      blue: 1.0,
                    },
                    bold: true,
                    fontSize: 10,
                  },
                  horizontalAlignment: 'CENTER',
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
            },
          },
          {
            autoResizeDimensions: {
              dimensions: {
                sheetId: 0,
                dimension: 'COLUMNS',
                startIndex: 0,
                endIndex: FEEDBACK_SHEET_HEADERS.length,
              },
            },
          },
        ],
      },
    });
  } catch (styleErr) {
    // Non-fatal if styling fails on restricted service accounts
    console.warn('Google Sheet header styling warning:', styleErr);
  }

  return {
    spreadsheetId,
    spreadsheetUrl,
  };
}

/**
 * Appends feedback response rows to the sheet
 */
export async function appendResponsesToSheet(
  spreadsheetId: string,
  rows: (string | number)[][]
) {
  if (rows.length === 0) return { updatedRows: 0 };

  const { sheets } = getGoogleServices();
  const lastColLetter = getColumnLetter(FEEDBACK_SHEET_HEADERS.length);

  const res = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `'Form Responses'!A:${lastColLetter}`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: rows,
    },
  });

  return {
    updatedRows: res.data.updates?.updatedRows || rows.length,
  };
}

/**
 * Reads existing response IDs from the sheet to avoid duplicate sync writes
 */
export async function getExistingSheetResponseIds(spreadsheetId: string): Promise<Set<string>> {
  try {
    const { sheets } = getGoogleServices();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "'Form Responses'!B2:B",
    });

    const rows = res.data.values || [];
    return new Set(rows.map(r => String(r[0])));
  } catch {
    return new Set();
  }
}
