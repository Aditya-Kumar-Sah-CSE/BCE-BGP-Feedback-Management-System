import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return new NextResponse(
      `<html>
        <body style="font-family: sans-serif; padding: 40px; background: #0b192c; color: #fff;">
          <h2 style="color: #ef4444;">Google Authorization Failed</h2>
          <p>${error}</p>
          <a href="/admin/dashboard/forms" style="color: #60a5fa;">Return to Admin Dashboard</a>
        </body>
      </html>`,
      { headers: { 'Content-Type': 'text/html' }, status: 400 }
    );
  }

  if (!code) {
    return new NextResponse(
      `<html>
        <body style="font-family: sans-serif; padding: 40px; background: #0b192c; color: #fff;">
          <h2 style="color: #ef4444;">Authorization Code Missing</h2>
          <p>No authorization code received from Google.</p>
          <a href="/admin/dashboard/forms" style="color: #60a5fa;">Return to Admin Dashboard</a>
        </body>
      </html>`,
      { headers: { 'Content-Type': 'text/html' }, status: 400 }
    );
  }

  try {
    const origin = request.nextUrl.origin;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${origin}/api/auth/google/callback`;

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );

    const { tokens } = await oauth2Client.getToken(code);
    const refreshToken = tokens.refresh_token;

    // Automatically update .env.local if refresh token is present
    let envUpdated = false;
    if (refreshToken) {
      try {
        const envPath = path.join(process.cwd(), '.env.local');
        if (fs.existsSync(envPath)) {
          let envContent = fs.readFileSync(envPath, 'utf8');
          if (envContent.includes('GOOGLE_REFRESH_TOKEN=')) {
            envContent = envContent.replace(
              /GOOGLE_REFRESH_TOKEN=.*/g,
              `GOOGLE_REFRESH_TOKEN=${refreshToken}`
            );
          } else {
            envContent += `\nGOOGLE_REFRESH_TOKEN=${refreshToken}\n`;
          }
          fs.writeFileSync(envPath, envContent, 'utf8');
          process.env.GOOGLE_REFRESH_TOKEN = refreshToken;
          envUpdated = true;
        }
      } catch (fileErr) {
        console.warn('Could not auto-write .env.local:', fileErr);
      }
    }

    return new NextResponse(
      `<!DOCTYPE html>
      <html>
        <head>
          <title>Google OAuth Connected — BCE Feedback Portal</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              background: #0b192c;
              color: #f8fafc;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              padding: 20px;
              box-sizing: border-box;
            }
            .card {
              background: #1e293b;
              border: 1px solid #334155;
              border-radius: 16px;
              padding: 32px;
              max-width: 640px;
              width: 100%;
              box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
            }
            .badge {
              display: inline-block;
              background: rgba(16, 185, 129, 0.2);
              color: #34d399;
              border: 1px solid rgba(16, 185, 129, 0.3);
              padding: 4px 12px;
              border-radius: 9999px;
              font-size: 12px;
              font-weight: 700;
              text-transform: uppercase;
              margin-bottom: 12px;
            }
            h1 {
              font-size: 20px;
              margin: 0 0 8px 0;
              color: #ffffff;
            }
            p {
              font-size: 13px;
              color: #94a3b8;
              line-height: 1.5;
              margin: 0 0 20px 0;
            }
            .token-box {
              background: #0f172a;
              border: 1px solid #334155;
              border-radius: 10px;
              padding: 14px;
              font-family: monospace;
              font-size: 12px;
              color: #38bdf8;
              word-break: break-all;
              margin-bottom: 20px;
            }
            .status-box {
              background: rgba(56, 189, 248, 0.1);
              border: 1px solid rgba(56, 189, 248, 0.2);
              color: #bae6fd;
              padding: 12px;
              border-radius: 8px;
              font-size: 12px;
              margin-bottom: 24px;
            }
            .btn {
              display: inline-block;
              background: #2563eb;
              color: #ffffff;
              padding: 10px 20px;
              border-radius: 8px;
              text-decoration: none;
              font-size: 13px;
              font-weight: 600;
              transition: background 0.15s;
            }
            .btn:hover {
              background: #1d4ed8;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="badge">OAuth 2.0 Connected</div>
            <h1>Google Authorization Successful</h1>
            <p>Your Google account has authorized the BCE Faculty Feedback Management System with Forms, Sheets, and Drive permissions.</p>
            
            ${
              refreshToken
                ? `<div class="status-box">
                    ${
                      envUpdated
                        ? '✓ <strong>GOOGLE_REFRESH_TOKEN</strong> was automatically and securely configured in server-side <code>.env.local</code>!'
                        : '✓ <strong>GOOGLE_REFRESH_TOKEN</strong> was successfully received and configured on the server!'
                    }
                   </div>
                   <p style="color: #34d399; font-size: 12px; font-weight: 600;">Server-side Google Forms & Sheets integration is now fully operational.</p>`
                : `<div class="status-box" style="background: rgba(245, 158, 11, 0.1); border-color: rgba(245, 158, 11, 0.3); color: #fde68a;">
                    Notice: Google did not return a new refresh token because this app was previously authorized. If you need a fresh token, visit <a href="/api/auth/google" style="color: #60a5fa;">Authorize Again with Consent</a>.
                   </div>`
            }

            <div style="display: flex; gap: 12px; align-items: center;">
              <a href="/admin/dashboard/forms" class="btn">Go to Forms Dashboard</a>
              <a href="/admin/dashboard/forms/create" class="btn" style="background: #059669;">Generate Google Form</a>
            </div>
          </div>
        </body>
      </html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return new NextResponse(
      `<html>
        <body style="font-family: sans-serif; padding: 40px; background: #0b192c; color: #fff;">
          <h2 style="color: #ef4444;">Token Exchange Failed</h2>
          <p>${errMsg}</p>
          <a href="/admin/dashboard/forms" style="color: #60a5fa;">Return to Admin Dashboard</a>
        </body>
      </html>`,
      { headers: { 'Content-Type': 'text/html' }, status: 500 }
    );
  }
}
