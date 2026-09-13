import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/admin-auth';
import { syncFormResponsesAction } from '@/app/admin/forms/actions';
import { isValidUUID } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session.isAuthenticated || !session.isActive) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Active admin session required.' },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    if (!isValidUUID(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid feedback form identifier format.' },
        { status: 400 }
      );
    }

    const result = await syncFormResponsesAction(id);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Synchronization failed.';
    return NextResponse.json(
      { success: false, error: errMsg },
      { status: 500 }
    );
  }
}
