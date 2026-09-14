import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/admin-auth';
import {
  validateAndPrepareFormDraftAction,
  provisionGoogleFormAndSheetAction,
} from '@/app/admin/forms/actions';
import { CreateFormPayload } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isActive) {
    return NextResponse.json({ error: 'Unauthorized. Active admin session required.' }, { status: 401 });
  }

  let payload: CreateFormPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request payload.' }, { status: 400 });
  }

  // Set up streaming response
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const sendEvent = async (event: {
    status: 'PREPARING' | 'DRAFT_SAVED' | 'PROVISIONING' | 'LINKING' | 'FINALIZING' | 'COMPLETED' | 'ERROR';
    stepNumber: number;
    message: string;
    form?: any;
    error?: string;
  }) => {
    try {
      const line = JSON.stringify(event) + '\n';
      await writer.write(encoder.encode(line));
    } catch (e) {
      console.warn('Stream write error:', e);
    }
  };

  // Run the staged workflow asynchronously
  (async () => {
    try {
      // Step 1: Fast local validation & draft creation
      await sendEvent({
        status: 'PREPARING',
        stepNumber: 1,
        message: 'Validating academic assignment & session configuration...',
      });

      const prepRes = await validateAndPrepareFormDraftAction(payload);
      if (!prepRes.success || !prepRes.draftFormId) {
        await sendEvent({
          status: 'ERROR',
          stepNumber: 1,
          message: prepRes.error || 'Validation failed.',
          error: prepRes.error || 'Validation failed.',
        });
        await writer.close();
        return;
      }

      await sendEvent({
        status: 'DRAFT_SAVED',
        stepNumber: 2,
        message: 'Draft record created. Connecting to Google Forms & Sheets APIs...',
      });

      // Step 2: Provisioning Google Form + Sheet concurrently
      await sendEvent({
        status: 'PROVISIONING',
        stepNumber: 3,
        message: 'Creating Google Form container and connected Google Sheet in parallel...',
      });

      const provRes = await provisionGoogleFormAndSheetAction({
        draftFormId: prepRes.draftFormId,
        title: prepRes.title || 'Faculty Feedback Form',
        description: prepRes.description || '',
        items: (prepRes as any).validatedItems,
      });

      if (!provRes.success || !provRes.form) {
        await sendEvent({
          status: 'ERROR',
          stepNumber: 4,
          message: provRes.error || 'Google provisioning failed.',
          error: provRes.error || 'Google provisioning failed.',
        });
        await writer.close();
        return;
      }

      // Step 3: Complete
      await sendEvent({
        status: 'COMPLETED',
        stepNumber: 5,
        message: 'Google Form and response Sheet successfully generated!',
        form: provRes.form,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await sendEvent({
        status: 'ERROR',
        stepNumber: 5,
        message: `Unexpected error: ${msg}`,
        error: msg,
      });
    } finally {
      try {
        await writer.close();
      } catch {
        // Stream writer may already be closed
      }
    }
  })();

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
