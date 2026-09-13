import { google } from 'googleapis';

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/forms.body',
  'https://www.googleapis.com/auth/forms.responses.readonly',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
];

export interface GoogleConfigStatus {
  isConfigured: boolean;
  authType: 'oauth' | 'service_account' | 'none';
  hasAppsScript: boolean;
  message: string;
}

/**
 * Returns configuration status without exposing credentials
 */
export function getGoogleConfigStatus(): GoogleConfigStatus {
  const hasOAuth = Boolean(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN
  );

  const hasServiceAccount = Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  );

  const hasAppsScript = Boolean(process.env.GOOGLE_APPS_SCRIPT_URL);

  if (hasOAuth) {
    return {
      isConfigured: true,
      authType: 'oauth',
      hasAppsScript,
      message: 'Google OAuth 2.0 configured with Refresh Token',
    };
  }

  if (hasServiceAccount) {
    return {
      isConfigured: true,
      authType: 'service_account',
      hasAppsScript,
      message: 'Google Service Account configured',
    };
  }

  return {
    isConfigured: false,
    authType: 'none',
    hasAppsScript,
    message: 'Google API credentials not configured in environment variables',
  };
}

export function isGoogleConfigured(): boolean {
  const status = getGoogleConfigStatus();
  return status.isConfigured;
}

/**
 * Creates authenticated Google Client server-side
 */
export function getGoogleAuthClient() {
  const status = getGoogleConfigStatus();

  if (status.authType === 'oauth') {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback'
    );

    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    });

    return oauth2Client;
  }

  if (status.authType === 'service_account') {
    // Process private key line breaks if escaped
    const privateKey = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').replace(/\\n/g, '\n');

    return new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: privateKey,
      scopes: GOOGLE_SCOPES,
    });
  }

  throw new Error(
    'Google API credentials missing. Please configure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN (or GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) in .env.local'
  );
}

/**
 * Returns authenticated Google API service clients
 */
export function getGoogleServices() {
  const auth = getGoogleAuthClient();

  return {
    forms: google.forms({ version: 'v1', auth }),
    sheets: google.sheets({ version: 'v4', auth }),
    drive: google.drive({ version: 'v3', auth }),
  };
}
