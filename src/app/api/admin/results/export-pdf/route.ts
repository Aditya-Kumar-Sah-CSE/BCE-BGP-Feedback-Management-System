import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/admin-auth';
import { getOverallAnalyticsData } from '@/lib/analytics/service';
import { generateOverallFeedbackPDF } from '@/lib/analytics/pdf-generator';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // 1. Mandatory Active Admin Authentication Check
    const session = await getAdminSession();
    if (!session.isAuthenticated || !session.isActive) {
      return NextResponse.json(
        { error: 'Unauthorized. Active admin credentials required to access institutional report PDFs.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const academicYearId = searchParams.get('academicYearId') || undefined;
    const branchId = searchParams.get('branchId') || undefined;
    const semesterId = searchParams.get('semesterId') || undefined;
    const facultyId = searchParams.get('facultyId') || undefined;
    const subjectId = searchParams.get('subjectId') || undefined;

    // 2. Compute Aggregated Analytics using pure service
    const result = await getOverallAnalyticsData({
      academicYearId,
      branchId,
      semesterId,
      facultyId,
      subjectId,
    });

    if (!result.success || !result.report) {
      return NextResponse.json(
        { error: result.error || 'Failed to generate analytics report.' },
        { status: 400 }
      );
    }

    // 3. Generate PDF Buffer
    const pdfBuffer = await generateOverallFeedbackPDF(result.report);

    const safeScopeName = result.report.scopeTitle
      .replace(/[^a-zA-Z0-9-_]/g, '_')
      .slice(0, 40);
    const filename = `BCE-Institutional-Feedback-${safeScopeName}.pdf`;

    return new Response(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (err: unknown) {
    const errorObj = err instanceof Error ? err : new Error(String(err));
    console.error('[INSTITUTIONAL_PDF_GENERATION_ERROR]', {
      errorName: errorObj.name,
      message: errorObj.message,
      stack: errorObj.stack,
    });
    return NextResponse.json({ error: 'Failed to generate institutional report PDF.' }, { status: 500 });
  }
}
