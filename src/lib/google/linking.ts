export interface LinkingResult {
  success: boolean;
  destinationType: 'NATIVE_SHEET' | 'APPLICATION_MANAGED';
  message: string;
  error?: string;
}

/**
 * Attempts to bind the Form's native response destination to the Google Sheet
 * using a deployed Google Apps Script Web App if configured.
 *
 * If the Apps Script Web App is not configured or unavailable, falls back
 * transparently to Application-Managed Response Synchronization.
 */
export async function linkFormToSpreadsheet(
  formId: string,
  sheetId: string
): Promise<LinkingResult> {
  const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
  const scriptSecret = process.env.GOOGLE_APPS_SCRIPT_SECRET;

  if (!scriptUrl) {
    return {
      success: true,
      destinationType: 'APPLICATION_MANAGED',
      message:
        'Apps Script Web App connector not configured (GOOGLE_APPS_SCRIPT_URL). Using Application-Managed Response Synchronization via Google Forms Responses API + Sheets API.',
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'linkFormToSheet',
        formId,
        sheetId,
        secret: scriptSecret || '',
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      return {
        success: false,
        destinationType: 'APPLICATION_MANAGED',
        message: `Apps Script call returned HTTP ${response.status}: ${errText}. Using Application-Managed Synchronization.`,
        error: errText,
      };
    }

    const data = await response.json();

    if (data.success) {
      return {
        success: true,
        destinationType: 'NATIVE_SHEET',
        message:
          'Successfully connected Google Form native response destination to Google Sheet via Google Apps Script.',
      };
    } else {
      return {
        success: false,
        destinationType: 'APPLICATION_MANAGED',
        message: `Apps Script failed to link: ${data.error || 'Unknown error'}. Using Application-Managed Synchronization.`,
        error: data.error,
      };
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      destinationType: 'APPLICATION_MANAGED',
      message: `Failed to reach Google Apps Script connector (${errMsg}). Using Application-Managed Synchronization.`,
      error: errMsg,
    };
  }
}
