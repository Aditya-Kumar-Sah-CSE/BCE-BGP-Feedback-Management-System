import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { EmailOtpType } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const nextParam = searchParams.get('next');
  const authError = searchParams.get('error_description') || searchParams.get('error');

  // Determine safe redirect destination
  const defaultNext = type === 'recovery' ? '/admin/reset-password' : '/admin/dashboard';
  const next = nextParam && nextParam.startsWith('/admin') ? nextParam : defaultNext;

  if (authError) {
    console.error('Supabase auth callback error param:', authError);
    const loginUrl = new URL('/admin/login', origin);
    loginUrl.searchParams.set('error', 'The reset link is invalid or has expired. Please request a new one.');
    return NextResponse.redirect(loginUrl);
  }

  const supabase = await createClient();

  // 1. Handle PKCE code exchange
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error('exchangeCodeForSession error:', error.message);
  }

  // 2. Handle token_hash verification (OTP / recovery flow)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type,
    });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error('verifyOtp error:', error.message);
  }

  // If code or token_hash failed or was not provided
  const loginUrl = new URL('/admin/login', origin);
  loginUrl.searchParams.set('error', 'Invalid or expired password reset link. Please try again.');
  return NextResponse.redirect(loginUrl);
}
