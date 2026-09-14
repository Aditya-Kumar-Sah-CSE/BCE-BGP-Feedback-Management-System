import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/admin-auth';
import { createClient } from '@/lib/supabase/server';
import { fetchRawSheetResponses } from '@/lib/analytics/sheets-reader';
import {
  normalizeSheetRows,
  detectMultiGrids,
  normalizeSheetRowsForSpecificGrid,
} from '@/lib/analytics/normalizer';
import { calculateFormAnalytics } from '@/lib/analytics/engine';
import {
  generateIndividualFacultyPDF,
  generateSemesterComparativePDF,
} from '@/lib/analytics/pdf-generator';
import { isGoogleConfigured } from '@/lib/google/auth';
import { isValidUUID } from '@/lib/validation';
import type { FacultyGridAnalyticsItem } from '@/lib/analytics/types';

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

    const isSemester = form.form_type === 'SEMESTER_FEEDBACK';
    const targetFaculty = request.nextUrl.searchParams.get('faculty');
    const requestedScope = request.nextUrl.searchParams.get('scope');

    // 3. Fetch Real Sheet Responses
    let canonicalRows: ReturnType<typeof normalizeSheetRows> = [];
    let facultyGrids: FacultyGridAnalyticsItem[] = [];
    let studentRowCount = 0;

    if (form.google_sheet_id && isGoogleConfigured()) {
      try {
        const sheetData = await fetchRawSheetResponses(form.google_sheet_id);
        studentRowCount = sheetData.totalRowCount;

        if (sheetData.rows.length > 0) {
          if (isSemester) {
            const detectedGrids = detectMultiGrids(sheetData.headers);

            if (detectedGrids.length > 0) {
              facultyGrids = detectedGrids.map(grid => {
                const gridRows = normalizeSheetRowsForSpecificGrid(
                  sheetData.headers,
                  sheetData.rows,
                  grid.paramColIndices
                );

                const gridReport = calculateFormAnalytics({
                  formId: form.id,
                  title: `${grid.subjectName} — ${grid.facultyName}`,
                  academicYear: form.academic_year?.name || 'Academic Session',
                  branch: form.branch?.name || 'Branch',
                  semester: form.semester?.name || 'Semester',
                  facultyName: grid.facultyName || 'Faculty Member',
                  subjectName: grid.subjectName || 'Subject',
                  subjectCode: grid.subjectCode || '',
                  formType: 'SEMESTER_FEEDBACK',
                  status: form.status,
                  lastSyncedAt: form.last_synced_at,
                  googleSheetUrl: form.google_sheet_url,
                  googleFormUrl: form.google_form_url,
                  responses: gridRows,
                });

                return {
                  gridTitle: grid.gridTitle,
                  facultyName: grid.facultyName,
                  subjectName: grid.subjectName,
                  subjectCode: grid.subjectCode,
                  report: gridReport,
                };
              });

              canonicalRows = detectedGrids.flatMap(grid =>
                normalizeSheetRowsForSpecificGrid(
                  sheetData.headers,
                  sheetData.rows,
                  grid.paramColIndices
                )
              );
            } else {
              canonicalRows = normalizeSheetRows(sheetData.headers, sheetData.rows);
            }
          } else {
            canonicalRows = normalizeSheetRows(sheetData.headers, sheetData.rows);
          }
        }
      } catch (sheetErr) {
        console.warn(`PDF generator sheet read warning for form ${formId}:`, sheetErr);
      }
    }

    // 4. Calculate Analytics
    const report = calculateFormAnalytics({
      formId: form.id,
      title: form.title,
      academicYear: form.academic_year?.name || 'Academic Session',
      branch: form.branch?.name || 'Branch',
      semester: form.semester?.name || 'Semester',
      facultyName: isSemester ? 'All Assigned Faculty' : form.faculty?.name || 'Faculty Member',
      subjectName: isSemester ? 'All Semester Subjects' : form.subject?.name || 'Subject',
      subjectCode: form.subject?.code || '',
      formType: form.form_type || 'FACULTY_SPECIFIC',
      status: form.status,
      lastSyncedAt: form.last_synced_at,
      googleSheetUrl: form.google_sheet_url,
      googleFormUrl: form.google_form_url,
      responses: canonicalRows,
    });

    if (isSemester) {
      report.isSemesterForm = true;
      report.facultyGrids = facultyGrids;
      if (studentRowCount > 0) {
        report.totalResponses = studentRowCount;
      }
    }

    // 5. Select Report Mode: Individual Faculty or Overall Semester Comparative
    let pdfBuffer: Buffer;
    let filename: string;
    const safeSlug = (form.slug || `feedback-${form.id}`).replace(/[^a-zA-Z0-9-_]/g, '_');

    if (isSemester && (requestedScope === 'SEMESTER' || !targetFaculty)) {
      // Comparative Semester PDF
      pdfBuffer = await generateSemesterComparativePDF(report);
      filename = `BCE-Semester-Comparative-${safeSlug}.pdf`;
    } else if (isSemester && targetFaculty) {
      // Specific Faculty inside semester form
      const matchedGrid = facultyGrids.find(
        fg =>
          fg.facultyName.toLowerCase() === targetFaculty.toLowerCase() ||
          fg.gridTitle.toLowerCase().includes(targetFaculty.toLowerCase())
      );

      const targetReport = matchedGrid ? matchedGrid.report : report;
      pdfBuffer = await generateIndividualFacultyPDF(targetReport);
      const facSlug = (matchedGrid?.facultyName || targetFaculty).replace(/[^a-zA-Z0-9-_]/g, '_');
      filename = `BCE-Faculty-Feedback-${facSlug}-${safeSlug}.pdf`;
    } else {
      // Legacy single faculty form
      pdfBuffer = await generateIndividualFacultyPDF(report);
      filename = `BCE-Faculty-Feedback-${safeSlug}.pdf`;
    }

    return new Response(pdfBuffer as unknown as BodyInit, {
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

