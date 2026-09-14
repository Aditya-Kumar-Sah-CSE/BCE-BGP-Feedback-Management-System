import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/admin-auth';
import { getFormAnalyticsAction } from '@/app/admin/results/actions';
import {
  generateIndividualFacultyPDF,
  generateSemesterComparativePDF,
} from '@/lib/analytics/pdf-generator';
import { isValidUUID } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Mandatory Active Admin Authentication Check
    const session = await getAdminSession();
    if (!session.isAuthenticated || !session.isActive) {
      return NextResponse.json(
        { error: 'Unauthorized. Active admin credentials required to access report PDFs.' },
        { status: 401 }
      );
    }

    const { id: formId } = await context.params;
    if (!formId || !isValidUUID(formId)) {
      return NextResponse.json({ error: 'Valid Feedback Form ID is required.' }, { status: 400 });
    }

    // 2. Fetch Form Analytics using shared authoritative action (guaranteeing 100% parity with dashboard)
    const result = await getFormAnalyticsAction(formId);
    if (!result.success || !result.report) {
      return NextResponse.json(
        { error: result.error || 'Feedback form not found or analytics unavailable.' },
        { status: 404 }
      );
    }

    const report = result.report;
    const isSemester = report.isSemesterForm || report.formType === 'SEMESTER_FEEDBACK';
    const targetFaculty = request.nextUrl.searchParams.get('faculty');
    const requestedScope = request.nextUrl.searchParams.get('scope');

    // 3. Select Report Mode: Individual Faculty or Overall Semester Comparative
    let pdfBuffer: Buffer;
    let filename: string;
    const safeSlug = report.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    if (isSemester && (requestedScope === 'SEMESTER' || !targetFaculty)) {
      // Comparative Semester PDF
      pdfBuffer = await generateSemesterComparativePDF(report);
      filename = `BCE-Semester-Comparative-${safeSlug || report.formId}.pdf`;
    } else if (isSemester && targetFaculty) {
      // Specific Faculty inside semester form
      const matchedGrid = report.facultyGrids?.find(
        fg =>
          fg.facultyName.toLowerCase() === targetFaculty.toLowerCase() ||
          fg.gridTitle.toLowerCase().includes(targetFaculty.toLowerCase())
      );

      const targetReport = matchedGrid ? matchedGrid.report : report;
      pdfBuffer = await generateIndividualFacultyPDF(targetReport);
      const facSlug = (matchedGrid?.facultyName || targetFaculty).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      filename = `BCE-Faculty-Feedback-${facSlug}-${safeSlug || report.formId}.pdf`;
    } else {
      // Legacy single faculty form
      pdfBuffer = await generateIndividualFacultyPDF(report);
      filename = `BCE-Faculty-Feedback-${safeSlug || report.formId}.pdf`;
    }

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (err: unknown) {
    console.error('PDF generation error:', err);
    return NextResponse.json({ error: 'Failed to generate report PDF.' }, { status: 500 });
  }
}

