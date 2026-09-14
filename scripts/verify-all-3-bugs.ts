import assert from 'node:assert';
import { calculateFormAnalytics, countUniqueStudentResponses } from '../src/lib/analytics/engine';
import {
  generateSemesterComparativePDF,
  generateIndividualFacultyPDF,
} from '../src/lib/analytics/pdf-generator';
import type { CanonicalResponseRow } from '../src/lib/analytics/types';
import { createAdminClient } from '../src/lib/supabase/admin';
import { fetchRawSheetResponses } from '../src/lib/analytics/sheets-reader';
import { detectMultiGrids, normalizeSheetRowsForSpecificGrid, normalizeRatingValue } from '../src/lib/analytics/normalizer';
import { getFormAnalyticsAction } from '../src/app/admin/results/actions';

async function runTests() {
  console.log('=== VERIFYING FIXES FOR ALL 3 PRODUCTION BUGS ===\n');

  // -------------------------------------------------------------------------
  // TEST CASE 1: 1 student × 2 faculty grids (all Excellent)
  // Expected:
  // - totalStudents = 1
  // - evaluatedItems = 2
  // - compositeAverageScore = 5.00 / 5.00
  // - percentage = 100.0%
  // -------------------------------------------------------------------------
  console.log('--- TEST CASE 1: 1 student submission with 2 faculty grids (all Excellent) ---');
  const mockStudent1Grid1: CanonicalResponseRow = {
    responseId: 'resp-student-1',
    timestamp: new Date().toISOString(),
    ratings: {
      1: 'Excellent',
      2: 'Excellent',
      3: 'Excellent',
      4: 'Excellent',
      5: 'Excellent',
      6: 'Excellent',
      7: 'Excellent',
      8: 'Excellent',
    },
    comments: 'Superb teaching',
    isValid: true,
  };
  const mockStudent1Grid2: CanonicalResponseRow = {
    responseId: 'resp-student-1', // Same student response ID!
    timestamp: new Date().toISOString(),
    ratings: {
      1: 'Excellent',
      2: 'Excellent',
      3: 'Excellent',
      4: 'Excellent',
      5: 'Excellent',
      6: 'Excellent',
      7: 'Excellent',
      8: 'Excellent',
    },
    comments: 'Excellent explanation',
    isValid: true,
  };

  const case1Responses = [mockStudent1Grid1, mockStudent1Grid2];
  const case1TotalStudents = countUniqueStudentResponses(case1Responses);
  assert.strictEqual(case1TotalStudents, 1, 'Total students must be 1 for 1 student with 2 grids');

  const case1Report = calculateFormAnalytics({
    formId: 'test-case-1',
    title: 'Semester Feedback — CSE Sem 4',
    academicYear: '2023-2027',
    branch: 'Computer Science & Engineering',
    semester: 'Semester 4',
    facultyName: 'All Assigned Faculty',
    subjectName: 'All Semester Subjects',
    subjectCode: '',
    formType: 'SEMESTER_FEEDBACK',
    status: 'ACTIVE',
    lastSyncedAt: new Date().toISOString(),
    googleSheetUrl: undefined,
    googleFormUrl: undefined,
    responses: case1Responses,
  });

  console.log(`  Total Students: ${case1Report.totalStudents} (expected 1)`);
  console.log(`  Evaluated Items: ${case1Report.evaluatedItems} (expected 2)`);
  console.log(`  Score: ${case1Report.compositeAverageScore.toFixed(2)}/5.00 (expected 5.00)`);
  console.log(`  Percentage: ${case1Report.percentage?.toFixed(1)}% (expected 100.0%)`);

  assert.strictEqual(case1Report.totalStudents, 1);
  assert.strictEqual(case1Report.evaluatedItems, 2);
  assert.strictEqual(case1Report.compositeAverageScore, 5.0);
  assert.strictEqual(case1Report.percentage, 100.0);
  console.log('✓ TEST CASE 1 PASSED!\n');

  // -------------------------------------------------------------------------
  // TEST CASE 2: 1 student × 5 faculty grids (all Excellent)
  // Expected:
  // - totalStudents = 1 (NOT 5!)
  // - evaluatedItems = 5
  // - compositeAverageScore = 5.00 / 5.00
  // - percentage = 100.0%
  // -------------------------------------------------------------------------
  console.log('--- TEST CASE 2: 1 student submission with 5 faculty grids (all Excellent) ---');
  const case2Responses: CanonicalResponseRow[] = [1, 2, 3, 4, 5].map(gridNum => ({
    responseId: 'resp-student-solo',
    timestamp: new Date().toISOString(),
    ratings: {
      1: 'Excellent',
      2: 'Excellent',
      3: 'Excellent',
      4: 'Excellent',
      5: 'Excellent',
      6: 'Excellent',
      7: 'Excellent',
      8: 'Excellent',
    },
    comments: `Grid ${gridNum} excellent`,
    isValid: true,
  }));

  const case2TotalStudents = countUniqueStudentResponses(case2Responses);
  assert.strictEqual(case2TotalStudents, 1, 'Total students must be 1 for 1 student with 5 grids');

  const case2Report = calculateFormAnalytics({
    formId: 'test-case-2',
    title: 'Semester Feedback — CSE Sem 6',
    academicYear: '2022-2026',
    branch: 'Computer Science & Engineering',
    semester: 'Semester 6',
    facultyName: 'All Assigned Faculty',
    subjectName: 'All Semester Subjects',
    subjectCode: '',
    formType: 'SEMESTER_FEEDBACK',
    status: 'ACTIVE',
    lastSyncedAt: new Date().toISOString(),
    googleSheetUrl: undefined,
    googleFormUrl: undefined,
    responses: case2Responses,
  });

  console.log(`  Total Students: ${case2Report.totalStudents} (expected 1)`);
  console.log(`  Evaluated Items: ${case2Report.evaluatedItems} (expected 5)`);
  console.log(`  Score: ${case2Report.compositeAverageScore.toFixed(2)}/5.00 (expected 5.00)`);
  console.log(`  Percentage: ${case2Report.percentage?.toFixed(1)}% (expected 100.0%)`);

  assert.strictEqual(case2Report.totalStudents, 1);
  assert.strictEqual(case2Report.evaluatedItems, 5);
  assert.strictEqual(case2Report.compositeAverageScore, 5.0);
  assert.strictEqual(case2Report.percentage, 100.0);
  console.log('✓ TEST CASE 2 PASSED!\n');

  // -------------------------------------------------------------------------
  // TEST CASE 3: Mixed Ratings (5, 4, 3, 2, 1)
  // 5 parameters rated: Excellent(5), Very Good(4), Good(3), Satisfactory(2), Unsatisfactory(1)
  // Expected average = (5 + 4 + 3 + 2 + 1) / 5 = 3.00
  // Percentage = (3.00 / 5) * 100 = 60.0%
  // -------------------------------------------------------------------------
  console.log('--- TEST CASE 3: Mixed ratings (Excellent, Very Good, Good, Satisfactory, Unsatisfactory) ---');
  const case3Responses: CanonicalResponseRow[] = [
    {
      responseId: 'resp-student-mixed',
      timestamp: new Date().toISOString(),
      ratings: {
        1: 'Excellent',
        2: 'Very Good',
        3: 'Good',
        4: 'Satisfactory',
        5: 'Unsatisfactory',
        6: null,
        7: null,
        8: null,
      },
      comments: 'Mixed review',
      isValid: true,
    },
  ];

  const case3Report = calculateFormAnalytics({
    formId: 'test-case-3',
    title: 'Individual Faculty Form',
    academicYear: '2023-2027',
    branch: 'Civil Engineering',
    semester: 'Semester 3',
    facultyName: 'Dr. Test',
    subjectName: 'Structural Mechanics',
    subjectCode: 'CE301',
    formType: 'FACULTY_SPECIFIC',
    status: 'ACTIVE',
    lastSyncedAt: new Date().toISOString(),
    googleSheetUrl: undefined,
    googleFormUrl: undefined,
    responses: case3Responses,
  });

  console.log(`  Score: ${case3Report.compositeAverageScore.toFixed(2)}/5.00 (expected 3.00)`);
  console.log(`  Percentage: ${case3Report.percentage?.toFixed(1)}% (expected 60.0%)`);
  assert.strictEqual(case3Report.compositeAverageScore, 3.0);
  assert.strictEqual(case3Report.percentage, 60.0);
  console.log('✓ TEST CASE 3 PASSED!\n');

  // -------------------------------------------------------------------------
  // TEST CASE 4: Blank / Incomplete Ratings Excluded from Denominator
  // 1 response with only 3 parameters answered ('Excellent', 'Excellent', 'Excellent')
  // Parameters 4-8 unrated (null)
  // Expected average = (5 + 5 + 5) / 3 = 5.00 (NOT 15 / 8 = 1.875)
  // -------------------------------------------------------------------------
  console.log('--- TEST CASE 4: Blank / missing ratings excluded from denominator ---');
  const case4Responses: CanonicalResponseRow[] = [
    {
      responseId: 'resp-student-partial',
      timestamp: new Date().toISOString(),
      ratings: {
        1: 'Excellent',
        2: 'Excellent',
        3: 'Excellent',
        4: null,
        5: null,
        6: null,
        7: null,
        8: null,
      },
      comments: 'Partial answers',
      isValid: true,
    },
  ];

  const case4Report = calculateFormAnalytics({
    formId: 'test-case-4',
    title: 'Individual Faculty Form',
    academicYear: '2023-2027',
    branch: 'Mechanical Engineering',
    semester: 'Semester 5',
    facultyName: 'Dr. Partial',
    subjectName: 'Thermodynamics',
    subjectCode: 'ME501',
    formType: 'FACULTY_SPECIFIC',
    status: 'ACTIVE',
    lastSyncedAt: new Date().toISOString(),
    googleSheetUrl: undefined,
    googleFormUrl: undefined,
    responses: case4Responses,
  });

  console.log(`  Score: ${case4Report.compositeAverageScore.toFixed(2)}/5.00 (expected 5.00)`);
  console.log(`  Valid observations counted: ${case4Report.parameters.reduce((sum, p) => sum + p.validCount, 0)} (expected 3)`);
  assert.strictEqual(case4Report.compositeAverageScore, 5.0);
  console.log('✓ TEST CASE 4 PASSED!\n');

  // -------------------------------------------------------------------------
  // TEST CASE 5: Historical 4-Point System Compatibility via Normalizer
  // Raw inputs: '4', '3', '2', '1'
  // Normalizer maps: '4' -> 'Very Good' (4), '3' -> 'Good' (3), '2' -> 'Satisfactory' (2), '1' -> 'Unsatisfactory' (1)
  // Average = (4 + 3 + 2 + 1) / 4 = 2.50 / 5.00
  // -------------------------------------------------------------------------
  console.log('--- TEST CASE 5: Historical 4-point rating normalization & compatibility ---');
  const rawValues = ['4', '3', '2', '1'];
  const normalizedRatings: Record<number, any> = {};
  rawValues.forEach((val, idx) => {
    normalizedRatings[idx + 1] = normalizeRatingValue(val);
  });

  assert.strictEqual(normalizedRatings[1], 'Very Good');
  assert.strictEqual(normalizedRatings[2], 'Good');
  assert.strictEqual(normalizedRatings[3], 'Satisfactory');
  assert.strictEqual(normalizedRatings[4], 'Unsatisfactory');

  const case5Responses: CanonicalResponseRow[] = [
    {
      responseId: 'resp-student-4pt',
      timestamp: new Date().toISOString(),
      ratings: {
        ...normalizedRatings,
        5: null,
        6: null,
        7: null,
        8: null,
      },
      comments: 'Legacy form',
      isValid: true,
    },
  ];

  const case5Report = calculateFormAnalytics({
    formId: 'test-case-5',
    title: 'Historical 4-Point Form',
    academicYear: '2021-2025',
    branch: 'Electrical Engineering',
    semester: 'Semester 2',
    facultyName: 'Prof. Legacy',
    subjectName: 'Basic Electrical',
    subjectCode: 'EE201',
    formType: 'FACULTY_SPECIFIC',
    status: 'ACTIVE',
    lastSyncedAt: new Date().toISOString(),
    googleSheetUrl: undefined,
    googleFormUrl: undefined,
    responses: case5Responses,
  });

  console.log(`  Score: ${case5Report.compositeAverageScore.toFixed(2)}/5.00 (expected 2.50)`);
  assert.strictEqual(case5Report.compositeAverageScore, 2.5);
  console.log('✓ TEST CASE 5 PASSED!\n');

  // -------------------------------------------------------------------------
  // REAL DATA VERIFICATION: Google Sheet 1ehhlxPrBFZDpcgQolSJr4oNSitKSSSfAyhptpUt2kYo
  // Row 2 alone (all Excellent): must yield exactly 5.00 / 5.00 (100.0%)
  // Row 1 + 2 combined: yields 4.44 / 5.00, 2 students total
  // -------------------------------------------------------------------------
  console.log('--- REAL DATA VERIFICATION: Live Production Sheet ---');
  const liveSheetId = '1ehhlxPrBFZDpcgQolSJr4oNSitKSSSfAyhptpUt2kYo';
  const rawSheet = await fetchRawSheetResponses(liveSheetId);
  console.log(`  Fetched raw sheet rows: ${rawSheet.rows.length}`);
  const detectedGrids = detectMultiGrids(rawSheet.headers);
  console.log(`  Detected grids: ${detectedGrids.length} (${detectedGrids.map(g => g.facultyName).join(', ')})`);

  // Row 2 in isolation (The user's manual all-Excellent submission)
  const row2Only = [rawSheet.rows[1]];
  const row2Canonical = detectedGrids.flatMap(grid =>
    normalizeSheetRowsForSpecificGrid(rawSheet.headers, row2Only, grid.paramColIndices)
  );
  const row2Students = countUniqueStudentResponses(row2Canonical);
  const row2Report = calculateFormAnalytics({
    formId: 'real-row-2',
    title: 'Semester Feedback — CSE Sem 4',
    academicYear: '2023-2027',
    branch: 'Computer Science & Engineering',
    semester: 'Semester 4',
    facultyName: 'All Assigned Faculty',
    subjectName: 'All Semester Subjects',
    subjectCode: '',
    formType: 'SEMESTER_FEEDBACK',
    status: 'ACTIVE',
    lastSyncedAt: new Date().toISOString(),
    googleSheetUrl: undefined,
    googleFormUrl: undefined,
    responses: row2Canonical,
  });

  console.log(`  [Row 2 Alone] Total Students: ${row2Students} (expected 1)`);
  console.log(`  [Row 2 Alone] Evaluated Items: ${row2Canonical.length} (expected 2)`);
  console.log(`  [Row 2 Alone] Benchmark Score: ${row2Report.compositeAverageScore.toFixed(2)}/5.00 (expected 5.00)`);
  console.log(`  [Row 2 Alone] Benchmark Percentage: ${row2Report.percentage?.toFixed(1)}% (expected 100.0%)`);

  assert.strictEqual(row2Students, 1, 'Row 2 alone must be 1 student');
  assert.strictEqual(row2Report.compositeAverageScore, 5.0, 'Row 2 alone must be exactly 5.00/5.00');
  assert.strictEqual(row2Report.percentage, 100.0, 'Row 2 alone must be exactly 100.0%');

  // Both Rows Combined (Row 1 + Row 2)
  const combinedCanonical = detectedGrids.flatMap(grid =>
    normalizeSheetRowsForSpecificGrid(rawSheet.headers, rawSheet.rows, grid.paramColIndices)
  );
  const combinedStudents = countUniqueStudentResponses(combinedCanonical);
  const combinedReport = calculateFormAnalytics({
    formId: 'real-combined',
    title: 'Semester Feedback — CSE Sem 4',
    academicYear: '2023-2027',
    branch: 'Computer Science & Engineering',
    semester: 'Semester 4',
    facultyName: 'All Assigned Faculty',
    subjectName: 'All Semester Subjects',
    subjectCode: '',
    formType: 'SEMESTER_FEEDBACK',
    status: 'ACTIVE',
    lastSyncedAt: new Date().toISOString(),
    googleSheetUrl: undefined,
    googleFormUrl: undefined,
    responses: combinedCanonical,
  });

  console.log(`  [Both Rows Combined] Total Students: ${combinedStudents} (expected 2)`);
  console.log(`  [Both Rows Combined] Evaluated Items: ${combinedCanonical.length} (expected 4)`);
  console.log(`  [Both Rows Combined] Benchmark Score: ${combinedReport.compositeAverageScore.toFixed(2)}/5.00 (expected 4.44)`);

  assert.strictEqual(combinedStudents, 2, '2 Google Sheet rows must count as 2 students');
  assert.strictEqual(combinedCanonical.length, 4, '2 rows × 2 grids = 4 evaluated items');
  assert.strictEqual(Number(combinedReport.compositeAverageScore.toFixed(2)), 4.44, 'Combined weighted average must be 4.44');
  console.log('✓ REAL DATA VERIFICATION PASSED!\n');

  // -------------------------------------------------------------------------
  // TEST CASE 6: PDF GENERATION VERIFICATION
  // Test generateSemesterComparativePDF and generateIndividualFacultyPDF
  // - Returns valid Buffer
  // - Starts with %PDF-
  // - Length > 2000
  // - Contains 'Signature: ____________________'
  // -------------------------------------------------------------------------
  console.log('--- TEST CASE 6: Semester PDF Generation & Signature Verification ---');
  // Enrich report with facultyGrids
  combinedReport.isSemesterForm = true;
  combinedReport.facultyGrids = detectedGrids.map(grid => {
    const gridRows = normalizeSheetRowsForSpecificGrid(rawSheet.headers, rawSheet.rows, grid.paramColIndices);
    return {
      gridTitle: grid.gridTitle,
      facultyName: grid.facultyName,
      subjectName: grid.subjectName,
      subjectCode: grid.subjectCode,
      report: calculateFormAnalytics({
        formId: 'grid-form',
        title: grid.gridTitle,
        academicYear: '2023-2027',
        branch: 'Computer Science & Engineering',
        semester: 'Semester 4',
        facultyName: grid.facultyName,
        subjectName: grid.subjectName,
        subjectCode: grid.subjectCode,
        formType: 'SEMESTER_FEEDBACK',
        status: 'ACTIVE',
        lastSyncedAt: new Date().toISOString(),
        googleSheetUrl: undefined,
        googleFormUrl: undefined,
        responses: gridRows,
      }),
    };
  });

  const pdfBuffer = await generateSemesterComparativePDF(combinedReport);
  console.log(`  Generated Semester Comparative PDF buffer size: ${pdfBuffer.length} bytes`);
  assert(pdfBuffer.length > 2000, 'PDF buffer should be larger than 2000 bytes');
  const pdfHeader = pdfBuffer.subarray(0, 5).toString('ascii');
  assert.strictEqual(pdfHeader, '%PDF-', 'PDF must start with %PDF-');

  const extractPdfStreams = (buffer: Buffer): string => {
    const binary = buffer.toString('binary');
    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let match: RegExpExecArray | null;
    let decompressedText = '';
    while ((match = streamRegex.exec(binary)) !== null) {
      try {
        const streamBytes = Buffer.from(match[1], 'binary');
        const unzipped = require('node:zlib').inflateSync(streamBytes).toString('utf8');
        decompressedText += unzipped + '\n';
        // PDFKit encodes text as hex strings e.g. [<5369676e61747572653a> 40 <205f5f5f5f...>] TJ
        const hexTokens = unzipped.match(/<([0-9a-fA-F]+)>/g) || [];
        const textFromHex = hexTokens.map((h: string) => Buffer.from(h.slice(1, -1), 'hex').toString('utf8')).join('');
        decompressedText += textFromHex + '\n';
      } catch {
        decompressedText += match[1] + '\n';
      }
    }
    return decompressedText;
  };

  const pdfText = extractPdfStreams(pdfBuffer);
  const hasSignature = pdfText.includes('Signature: ____________________') || (pdfText.includes('Signature:') && pdfText.includes('____________________'));
  console.log(`  Semester PDF Signature block verified: ${hasSignature}`);
  assert(hasSignature, 'Semester PDF must contain Signature block');

  // Also test Individual Faculty PDF signature
  const facultyPdfBuffer = await generateIndividualFacultyPDF(combinedReport.facultyGrids[0].report);
  console.log(`  Generated Faculty PDF buffer size: ${facultyPdfBuffer.length} bytes`);
  assert(facultyPdfBuffer.length > 2000, 'Faculty PDF buffer should be larger than 2000 bytes');
  const facultyPdfText = extractPdfStreams(facultyPdfBuffer);
  const hasFacultySig = facultyPdfText.includes('Signature: ____________________') || (facultyPdfText.includes('Signature:') && facultyPdfText.includes('____________________'));
  console.log(`  Faculty PDF Signature block verified: ${hasFacultySig}`);
  assert(hasFacultySig, 'Faculty PDF must contain Signature block');
  console.log('✓ PDF GENERATION & SIGNATURE VERIFICATION PASSED!\n');

  // -------------------------------------------------------------------------
  // TEST CASE 7: Action & Database Integration Check
  // Verify getFormAnalyticsAction on live form id ed1f6cf5-cc5e-422f-8381-ed44a1cea9cc
  // -------------------------------------------------------------------------
  console.log('--- TEST CASE 7: Live Form Analytics Action Verification ---');
  const liveFormId = 'ed1f6cf5-cc5e-422f-8381-ed44a1cea9cc';
  const mockAdminClient = {
    auth: {
      getUser: async () => ({
        data: {
          user: {
            id: 'mock-admin-id',
            email: 'iambestadi@gmail.com',
            user_metadata: { name: 'Aditya (Super Admin)' },
          },
        },
        error: null,
      }),
    },
    rpc: async () => ({ data: null, error: null }),
  };

  const actionRes = await getFormAnalyticsAction(liveFormId, { client: mockAdminClient });
  assert.strictEqual(actionRes.success, true, `getFormAnalyticsAction must succeed: ${actionRes.error}`);
  assert(actionRes.report, 'Report must be returned');

  console.log(`  Action form title: ${actionRes.report.title}`);
  console.log(`  Action totalResponses (Students): ${actionRes.report.totalResponses}`);
  console.log(`  Action validResponses (Evaluated items): ${actionRes.report.validResponses}`);
  console.log(`  Action composite score: ${actionRes.report.compositeAverageScore.toFixed(2)}/5.00`);

  // Verify form response_count in DB matches unique student count
  const supabase = createAdminClient();
  if (!supabase) throw new Error('Supabase admin client failed to initialize');
  const { data: dbForm } = await supabase
    .from('feedback_forms')
    .select('response_count')
    .eq('id', liveFormId)
    .single();

  console.log(`  Database stored response_count: ${dbForm?.response_count}`);
  assert.strictEqual(dbForm?.response_count, actionRes.report.totalResponses, 'Database response_count must match unique students count');
  console.log('✓ ACTION & DATABASE INTEGRATION VERIFIED!\n');

  console.log('=====================================================');
  console.log('ALL 3 PRODUCTION BUGS HAVE BEEN VERIFIED AS RESOLVED!');
  console.log('=====================================================');
}

runTests().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
