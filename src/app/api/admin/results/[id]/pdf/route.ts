import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/admin-auth';
import { createClient } from '@/lib/supabase/server';
import { fetchRawSheetResponses } from '@/lib/analytics/sheets-reader';
import { normalizeSheetRows } from '@/lib/analytics/normalizer';
import { calculateFormAnalytics } from '@/lib/analytics/engine';
import { generateIndividualFacultyPDF } from '@/lib/analytics/pdf-generator';
import { isGoogleConfigured } from '@/lib/google/auth';
import { isValidUUID } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  _request: NextRequest,
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

    const supabase = await createClient();

    // 2. Fetch Form Metadata with Relationships
    const { data: form, error: formErr } = await supabase
      .from('feedback_forms')
      .select(`
        *,
        faculty:faculties(*),
        subject:subjects(*),
        academic_year:academic_years(*),
        branch:branches(*),
        semester:semesters(*)
      `)
      .eq('id', formId)
      .single();

    if (formErr || !form) {
      return NextResponse.json({ error: 'Feedback form not found.' }, { status: 404 });
    }

    // 3. Fetch Real Sheet Responses
    let canonicalRows: ReturnType<typeof normalizeSheetRows> = [];

    if (form.google_sheet_id && isGoogleConfigured()) {
      try {
        const sheetData = await fetchRawSheetResponses(form.google_sheet_id);
        if (sheetData.rows.length > 0) {
          canonicalRows = normalizeSheetRows(sheetData.headers, sheetData.rows);
        }
      } catch (sheetErr) {
        console.warn(`PDF generator sheet read warning for form ${formId}:`, sheetErr);
      }
    }

    // 4. Calculate Analytics (Strictly same engine as dashboard)
    const report = calculateFormAnalytics({
      formId: form.id,
      title: form.title,
      academicYear: form.academic_year?.name || 'Academic Session',
      branch: form.branch?.name || 'Branch',
      semester: form.semester?.name || 'Semester',
      facultyName: form.faculty?.name || 'Faculty Member',
      subjectName: form.subject?.name || 'Subject',
      subjectCode: form.subject?.code || '',
      formType: form.form_type || 'FACULTY_SPECIFIC',
      status: form.status,
      lastSyncedAt: form.last_synced_at,
      googleSheetUrl: form.google_sheet_url,
      googleFormUrl: form.google_form_url,
      responses: canonicalRows,
    });

    // 5. Generate PDF
    const pdfBuffer = await generateIndividualFacultyPDF(report);

    const safeSlug = (form.slug || `faculty-${form.id}`).replace(/[^a-zA-Z0-9-_]/g, '_');
    const filename = `BCE-Faculty-Feedback-${safeSlug}.pdf`;

    return new Response(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (err: unknown) {
    console.error('Individual PDF generation error:', err);
    return NextResponse.json({ error: 'Failed to generate faculty report PDF.' }, { status: 500 });
  }
}
