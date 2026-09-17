import assert from 'node:assert';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { fetchRawSheetResponses } from '../src/lib/analytics/sheets-reader';
import { detectMultiGrids, normalizeSheetRowsForSpecificGrid } from '../src/lib/analytics/normalizer';
import { calculateFormAnalytics } from '../src/lib/analytics/engine';
import {
  generateSemesterComparativePDF,
  generateIndividualFacultyPDF,
} from '../src/lib/analytics/pdf-generator';

async function verifyPdfFix() {
  console.log('================================================================');
  console.log('     VERIFICATION OF PDF METADATA LAYOUT & 2-COLUMN GRID       ');
  console.log('================================================================\n');

  // 1. Fetch real production sheet data
  const liveSheetId = '1ehhlxPrBFZDpcgQolSJr4oNSitKSSSfAyhptpUt2kYo';
  console.log('1. Loading Real Production Google Sheet Data...');
  const rawSheet = await fetchRawSheetResponses(liveSheetId);
  console.log(`   Fetched ${rawSheet.rows.length} rows, ${rawSheet.headers.length} headers.`);
  assert(rawSheet.rows.length > 0, 'Real sheet data must not be empty');

  const detectedGrids = detectMultiGrids(rawSheet.headers);
  console.log(`   Detected grids: ${detectedGrids.length} (${detectedGrids.map(g => g.facultyName).join(', ')})`);
  assert.strictEqual(detectedGrids.length, 2, 'Expected 2 faculty grids in real sheet');

  const combinedCanonical = detectedGrids.flatMap(grid =>
    normalizeSheetRowsForSpecificGrid(rawSheet.headers, rawSheet.rows, grid.paramColIndices)
  );

  const baseReport = calculateFormAnalytics({
    formId: 'prod-form-id',
    title: 'Feedback Form — Semester 4 (2nd Year) Students — Computer Science & Engineering 2025-2026',
    academicYear: '2025-2026',
    branch: 'Computer Science & Engineering',
    semester: 'Semester 4 (2nd Year)',
    facultyName: 'All Assigned Faculty',
    subjectName: 'All Semester Subjects',
    subjectCode: '',
    formType: 'SEMESTER_FEEDBACK',
    status: 'ACTIVE',
    lastSyncedAt: new Date().toISOString(),
    responses: combinedCanonical,
  });

  baseReport.isSemesterForm = true;
  baseReport.facultyGrids = detectedGrids.map(grid => {
    const gridRows = normalizeSheetRowsForSpecificGrid(rawSheet.headers, rawSheet.rows, grid.paramColIndices);
    return {
      gridTitle: grid.gridTitle,
      facultyName: grid.facultyName,
      subjectName: grid.subjectName,
      subjectCode: grid.subjectCode,
      report: calculateFormAnalytics({
        formId: 'grid-form',
        title: grid.gridTitle,
        academicYear: '2025-2026',
        branch: 'Computer Science & Engineering',
        semester: 'Semester 4 (2nd Year)',
        facultyName: grid.facultyName,
        subjectName: grid.subjectName,
        subjectCode: grid.subjectCode,
        formType: 'SEMESTER_FEEDBACK',
        status: 'ACTIVE',
        lastSyncedAt: new Date().toISOString(),
        responses: gridRows,
      }),
    };
  });

  // Verify analytics values are preserved
  console.log('\n2. Verifying Analytics Values Preservation:');
  console.log(`   Composite Benchmark Score: ${baseReport.compositeAverageScore.toFixed(2)} / 5.00`);
  console.log(`   Percentage: ${baseReport.percentage?.toFixed(1)}%`);
  console.log(`   Total Students: ${baseReport.totalStudents}`);
  console.log(`   Evaluated Items: ${baseReport.evaluatedItems}`);
  assert.strictEqual(baseReport.totalStudents, 2, 'Total students must remain 2');
  assert.strictEqual(baseReport.evaluatedItems, 4, 'Evaluated items must remain 4');
  assert.strictEqual(Number(baseReport.compositeAverageScore.toFixed(2)), 4.44, 'Benchmark score must remain 4.44/5.00');

  // Test Case A: Short Title
  console.log('\n3. Generating PDF with Normal Short Title...');
  const shortReport = { ...baseReport, title: 'Semester Feedback — CSE Sem 4' };
  const shortPdf = await generateSemesterComparativePDF(shortReport);
  assert(shortPdf.length > 2000, 'PDF buffer size should exceed 2000 bytes');
  assert.strictEqual(shortPdf.subarray(0, 5).toString('ascii'), '%PDF-');
  fs.writeFileSync('scratch/final-short.pdf', shortPdf);
  const shortPages = (shortPdf.toString('utf8').match(/\/Type\s*\/Page\b/g) || []).length;
  console.log(`   ✓ Short title PDF: ${shortPdf.length} bytes, pageCount = ${shortPages} (Expected 1)`);
  assert.strictEqual(shortPages, 1, 'Short title PDF must fit on exactly 1 page');

  // Test Case B: Real Production Title (from User's Screenshot)
  console.log('\n4. Generating PDF with Real Production Title (User Screenshot)...');
  const prodReport = {
    ...baseReport,
    title: 'Feedback Form — Semester 4 (2nd Year) Students — Computer Science & Engineering 2025-2026',
  };
  const prodPdf = await generateSemesterComparativePDF(prodReport);
  assert(prodPdf.length > 2000, 'PDF buffer size should exceed 2000 bytes');
  assert.strictEqual(prodPdf.subarray(0, 5).toString('ascii'), '%PDF-');
  fs.writeFileSync('scratch/final-prod.pdf', prodPdf);
  const prodPages = (prodPdf.toString('utf8').match(/\/Type\s*\/Page\b/g) || []).length;
  console.log(`   ✓ Production title PDF: ${prodPdf.length} bytes, pageCount = ${prodPages} (Expected 1)`);
  assert.strictEqual(prodPages, 1, 'Production title PDF must fit on exactly 1 page');

  // Test Case C: Very Long Multi-Faculty Semester Title
  console.log('\n5. Generating PDF with Very Long Title...');
  const veryLongReport = {
    ...baseReport,
    title: 'Feedback Form — Semester 4 (2nd Year) Students — Computer Science & Engineering — Multi-Faculty Comprehensive Semester Feedback and Faculty Evaluation for 2025-2026 Session (All Batches)',
  };
  const veryLongPdf = await generateSemesterComparativePDF(veryLongReport);
  assert(veryLongPdf.length > 2000, 'PDF buffer size should exceed 2000 bytes');
  assert.strictEqual(veryLongPdf.subarray(0, 5).toString('ascii'), '%PDF-');
  fs.writeFileSync('scratch/final-very-long.pdf', veryLongPdf);
  const veryLongPages = (veryLongPdf.toString('utf8').match(/\/Type\s*\/Page\b/g) || []).length;
  console.log(`   ✓ Very long title PDF: ${veryLongPdf.length} bytes, pageCount = ${veryLongPages} (Expected 1)`);
  assert.strictEqual(veryLongPages, 1, 'Very long title PDF must fit on exactly 1 page');

  // Test Case D: Individual Faculty PDF
  console.log('\n6. Generating Individual Faculty PDF...');
  const facultyPdf = await generateIndividualFacultyPDF(baseReport.facultyGrids[0].report);
  assert(facultyPdf.length > 2000, 'Faculty PDF buffer size should exceed 2000 bytes');
  assert.strictEqual(facultyPdf.subarray(0, 5).toString('ascii'), '%PDF-');
  fs.writeFileSync('scratch/final-faculty.pdf', facultyPdf);
  const facultyPages = (facultyPdf.toString('utf8').match(/\/Type\s*\/Page\b/g) || []).length;
  console.log(`   ✓ Individual faculty PDF: ${facultyPdf.length} bytes, pageCount = ${facultyPages} (Expected 1)`);
  assert.strictEqual(facultyPages, 1, 'Individual faculty PDF must fit on exactly 1 page');

  // Render to PNGs using pdftoppm for visual inspection
  console.log('\n7. Rendering PDFs to PNG for Visual Verification...');
  execSync('pdftoppm -png -r 150 scratch/final-prod.pdf scratch/final-prod-page');
  execSync('pdftoppm -png -r 150 scratch/final-short.pdf scratch/final-short-page');
  execSync('pdftoppm -png -r 150 scratch/final-very-long.pdf scratch/final-very-long-page');
  execSync('pdftoppm -png -r 150 scratch/final-faculty.pdf scratch/final-faculty-page');
  console.log('   ✓ All test PDFs rendered to high-resolution PNGs successfully.');

  console.log('\n================================================================');
  console.log('     🎉 ALL PDF VERIFICATION CHECKS PASSED SUCCESSFULLY!        ');
  console.log('================================================================\n');
}

verifyPdfFix().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
