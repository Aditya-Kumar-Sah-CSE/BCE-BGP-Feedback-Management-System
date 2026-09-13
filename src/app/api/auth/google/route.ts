import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { GOOGLE_SCOPES } from '@/lib/google/auth';

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;

  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${origin}/api/auth/google/callback`;

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // Force consent prompt to guarantee refresh token generation
    scope: GOOGLE_SCOPES,
  });

  return NextResponse.redirect(authUrl);
}
