/**
 * Cryptographically Secure HMAC-SHA256 Response Tokens
 * Bhagalpur College of Engineering (Govt. of Bihar)
 * 
 * Generates short-lived, ownership-bound, tamper-proof tokens for students
 * to securely download/view ONLY their own feedback response.
 */

import crypto from 'crypto';

export interface ResponseTokenPayload {
  responseId: string; // google_response_id or db id
  formId: string;
  email: string;
  exp: number; // Unix timestamp in seconds
}

function getSigningSecret(): string {
  const secret =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.GOOGLE_CLIENT_SECRET ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'bce-feedback-hmac-sha256-default-signing-salt-2026';
  return secret;
}

/**
 * Generates a signed token valid for the specified duration (default: 7 days)
 */
export function generateResponseToken(
  payload: Omit<ResponseTokenPayload, 'exp'>,
  expiresInSeconds: number = 7 * 24 * 60 * 60
): string {
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const fullPayload: ResponseTokenPayload = {
    ...payload,
    exp,
  };

  const payloadString = JSON.stringify(fullPayload);
  const payloadBase64 = Buffer.from(payloadString, 'utf-8').toString('base64url');

  const secret = getSigningSecret();
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payloadBase64)
    .digest('base64url');

  return `${payloadBase64}.${signature}`;
}

/**
 * Verifies a token's HMAC signature and expiration.
 * Returns payload if valid, or null if tampered, expired, or invalid.
 */
export function verifyResponseToken(token: string): ResponseTokenPayload | null {
  if (!token || typeof token !== 'string') {
    return null;
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return null;
  }

  const [payloadBase64, signature] = parts;
  if (!payloadBase64 || !signature) {
    return null;
  }

  try {
    const secret = getSigningSecret();
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payloadBase64)
      .digest('base64url');

    const sigBuffer = Buffer.from(signature, 'utf-8');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf-8');

    if (sigBuffer.length !== expectedBuffer.length) {
      return null;
    }

    if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      return null;
    }

    const payloadString = Buffer.from(payloadBase64, 'base64url').toString('utf-8');
    const payload: ResponseTokenPayload = JSON.parse(payloadString);

    // Validate payload fields
    if (!payload.responseId || !payload.formId || !payload.email || typeof payload.exp !== 'number') {
      return null;
    }

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (now > payload.exp) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
