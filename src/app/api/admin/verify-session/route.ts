import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/admin-auth';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const session = await getAdminSession();
    return NextResponse.json(session);
  } catch (error: any) {
    console.error('Session verification error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
