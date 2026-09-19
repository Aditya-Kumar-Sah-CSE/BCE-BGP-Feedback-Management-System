import {
  shouldShowSubmissionMetadata,
  generateStudentResponsePDF,
  StudentResponsePDFData,
} from './src/lib/analytics/pdf-generator';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

/**
 * Extracts plain text from a PDFKit binary buffer by deflating PDF content streams
 * and decoding hex/literal TJ arrays.
 */
function extractPdfText(pdfBuffer: Buffer): string {
  const str = pdfBuffer.toString('latin1');
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let fullText = '';
  let match;
  while ((match = streamRegex.exec(str)) !== null) {
    try {
      const inflated = zlib.inflateSync(Buffer.from(match[1], 'latin1')).toString('utf8');
      // Decode hex strings like <4243452d20> to utf-8 text
      const decoded = inflated.replace(/<([0-9a-fA-F]+)>/g, (_, hex) => {
        try {
          return Buffer.from(hex, 'hex').toString('utf8');
        } catch {
          return '';
        }
      });
      fullText += ' ' + decoded;
    } catch {
      // Uncompressed stream or image stream
    }
  }
  return fullText;
}

/**
 * Extracts the starting Y coordinate of the faculty section banner to verify dynamic reflow.
 */
function getFacultyBannerY(pdfBuffer: Buffer): number | null {
  const str = pdfBuffer.toString('latin1');
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match;
  while ((match = streamRegex.exec(str)) !== null) {
    try {
      const inflated = zlib.inflateSync(Buffer.from(match[1], 'latin1')).toString('utf8');
      const m = inflated.match(/36\s+([\d.]+)\s+523\.28\s+20\s+re/);
      if (m) return parseFloat(m[1]);
    } catch {
      // Ignore
    }
  }
  return null;
}

async function runTests() {
  console.log('===============================================================');
  console.log('  STUDENT FEEDBACK SUBMISSION RECORD PDF METADATA TEST SUITE   ');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${msg}`);
      failed++;
    }
  }

  // ==========================================================
  // 1. UNIT TESTS: shouldShowSubmissionMetadata Helper
  // ==========================================================
  console.log('--- 1. Unit Tests: shouldShowSubmissionMetadata ---');

  const unitTestCases: Array<{ session: string | null | undefined; expected: boolean }> = [
    { session: '2022-2023', expected: false },
    { session: '2023-2024', expected: false },
    { session: '2024-2025', expected: false },
    { session: '2025-2026', expected: false }, // Final Rule: 2025-2026 MUST HIDE
    { session: '2026-2027', expected: true },  // Final Rule: 2026-2027 MUST SHOW
    { session: '2027-2028', expected: true },  // Future: SHOW
    { session: '2028-2029', expected: true },  // Future: SHOW
    { session: '2030-2031', expected: true },  // Future: SHOW
    // Formatting edge cases
    { session: '2025 - 2026', expected: false },
    { session: '2026 - 2027', expected: true },
    { session: '2026/2027', expected: true },
    { session: '2025/2026', expected: false },
    { session: 'Academic Session 2026-2027', expected: true },
    { session: 'Academic Session 2025-2026', expected: false },
    { session: '2026', expected: true },
    { session: '2025', expected: false },
    { session: 'Academic Session', expected: false },
    { session: '', expected: false },
    { session: null, expected: false },
    { session: undefined, expected: false },
  ];

  for (const tc of unitTestCases) {
    const actual = shouldShowSubmissionMetadata(tc.session);
    assert(
      actual === tc.expected,
      `shouldShowSubmissionMetadata("${tc.session}") => ${actual} (expected: ${tc.expected})`
    );
  }

  // ==========================================================
  // 2. REAL PDF GENERATION TESTS
  // ==========================================================
  console.log('\n--- 2. Real PDF Generation Tests ---');

  const baseData: Omit<StudentResponsePDFData, 'academicYear' | 'formTitle'> = {
    studentName: 'Aditya Kumar Sah',
    registrationNumber: '21105129001',
    studentEmail: 'aditya.kumar.sah@bcebhagalpur.ac.in',
    branch: 'Computer Science & Engineering',
    semester: 'Semester 8',
    submittedAt: '2026-09-19T10:00:00.000Z',
    submissionId: 'BCE-SUB-2026-XYZ9876543210ABCDEF1234567890',
    facultyEvaluations: [
      {
        facultyName: 'Dr. Abha Kumari',
        subjectName: 'Python Programming (10021)',
        ratings: [
          { parameterId: 1, parameterTitle: 'Syllabus covered by teacher as per curriculum', rating: 'Excellent' },
          { parameterId: 2, parameterTitle: 'Communication skills', rating: 'Very Good' },
          { parameterId: 3, parameterTitle: 'Effectiveness of Teaching/Learning', rating: 'Excellent' },
          { parameterId: 4, parameterTitle: 'Accessibility of the teacher in and out of class', rating: 'Good' },
          { parameterId: 5, parameterTitle: 'Willingness to offer help and advice', rating: 'Excellent' },
          { parameterId: 6, parameterTitle: 'Ability of teacher to teach/explain confidently', rating: 'Very Good' },
          { parameterId: 7, parameterTitle: 'Punctuality and regularity in classes', rating: 'Excellent' },
          { parameterId: 8, parameterTitle: 'Fairness and impartiality in evaluation', rating: 'Excellent' },
        ],
      },
    ],
    generalFeedback: 'Outstanding academic environment and pedagogy.',
  };

  const outputDir = path.join(__dirname, 'test-artifacts-pdf');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // TEST A: Academic Session 2024-2025 (HIDDEN)
  console.log('\n- TEST A: Academic Session = 2024-2025 (Historical - Expected: Hidden)');
  const pdf2024 = await generateStudentResponsePDF({
    ...baseData,
    academicYear: '2024-2025',
    formTitle: 'Feedback Form — Semester 8 Students — Computer Science & Engineering — 2024-2025',
  });
  fs.writeFileSync(path.join(outputDir, 'student-record-2024-2025.pdf'), pdf2024);
  const text2024 = extractPdfText(pdf2024);
  assert(!text2024.includes('Submission Date:'), '2024-2025: Submission Date is NOT rendered');
  assert(!text2024.includes('Submission ID:'), '2024-2025: Submission ID is NOT rendered');
  assert(text2024.includes('2024-2025'), '2024-2025: Academic Session is rendered');
  assert(pdf2024.length > 3000, `2024-2025: Valid PDF generated (${pdf2024.length} bytes)`);

  // TEST B: Academic Session 2025-2026 (HIDDEN per final rule)
  console.log('\n- TEST B: Academic Session = 2025-2026 (Final Rule - Expected: Hidden)');
  const pdf2025 = await generateStudentResponsePDF({
    ...baseData,
    academicYear: '2025-2026',
    formTitle: 'Feedback Form — Semester 8 Students — Computer Science & Engineering — 2025-2026',
  });
  fs.writeFileSync(path.join(outputDir, 'student-record-2025-2026.pdf'), pdf2025);
  const text2025 = extractPdfText(pdf2025);
  assert(!text2025.includes('Submission Date:'), '2025-2026: Submission Date is NOT rendered');
  assert(!text2025.includes('Submission ID:'), '2025-2026: Submission ID is NOT rendered');
  assert(text2025.includes('2025-2026'), '2025-2026: Academic Session is rendered');
  assert(pdf2025.length > 3000, `2025-2026: Valid PDF generated (${pdf2025.length} bytes)`);

  // TEST C: Academic Session 2026-2027 (VISIBLE per final rule)
  console.log('\n- TEST C: Academic Session = 2026-2027 (Current/Active - Expected: Visible)');
  const pdf2026 = await generateStudentResponsePDF({
    ...baseData,
    academicYear: '2026-2027',
    formTitle: 'Feedback Form — Semester 8 Students — Computer Science & Engineering — 2026-2027',
  });
  fs.writeFileSync(path.join(outputDir, 'student-record-2026-2027.pdf'), pdf2026);
  const text2026 = extractPdfText(pdf2026);
  assert(text2026.includes('Submission Date:'), '2026-2027: Submission Date IS rendered');
  assert(text2026.includes('Submission ID:'), '2026-2027: Submission ID IS rendered');
  assert(text2026.includes('2026-2027'), '2026-2027: Academic Session is rendered');
  assert(pdf2026.length > 3000, `2026-2027: Valid PDF generated (${pdf2026.length} bytes)`);

  // TEST D: Academic Session 2027-2028 (VISIBLE)
  console.log('\n- TEST D: Academic Session = 2027-2028 (Future - Expected: Visible)');
  const pdf2027 = await generateStudentResponsePDF({
    ...baseData,
    academicYear: '2027-2028',
    formTitle: 'Feedback Form — Semester 8 Students — Computer Science & Engineering — 2027-2028',
  });
  fs.writeFileSync(path.join(outputDir, 'student-record-2027-2028.pdf'), pdf2027);
  const text2027 = extractPdfText(pdf2027);
  assert(text2027.includes('Submission Date:'), '2027-2028: Submission Date IS rendered');
  assert(text2027.includes('Submission ID:'), '2027-2028: Submission ID IS rendered');

  // TEST E: Long Multi-Faculty Form Title Wrapping & Dynamic Reflow
  console.log('\n- TEST E: Long Multi-Faculty Form Title Wrapping & Dynamic Reflow');
  const longTitle =
    'Feedback Form — Comprehensive Multi-Faculty Institutional Feedback Form for Semester 1 (1st Year) Students of Bhagalpur College of Engineering — Department of Computer Science & Engineering — Academic Session';

  const pdfLongHidden = await generateStudentResponsePDF({
    ...baseData,
    academicYear: '2025-2026',
    formTitle: `${longTitle} 2025-2026`,
  });
  fs.writeFileSync(path.join(outputDir, 'student-record-long-title-2025-2026.pdf'), pdfLongHidden);
  const textLongHidden = extractPdfText(pdfLongHidden);
  assert(!textLongHidden.includes('Submission Date:'), 'Long Title 2025-2026: Hidden metadata respected');
  assert(!textLongHidden.includes('Submission ID:'), 'Long Title 2025-2026: Hidden Submission ID respected');

  const pdfLongVisible = await generateStudentResponsePDF({
    ...baseData,
    academicYear: '2026-2027',
    formTitle: `${longTitle} 2026-2027`,
  });
  fs.writeFileSync(path.join(outputDir, 'student-record-long-title-2026-2027.pdf'), pdfLongVisible);
  const textLongVisible = extractPdfText(pdfLongVisible);
  assert(textLongVisible.includes('Submission Date:'), 'Long Title 2026-2027: Visible metadata respected');
  assert(textLongVisible.includes('Submission ID:'), 'Long Title 2026-2027: Visible Submission ID respected');

  // TEST F: Verify Dynamic Reflow (Faculty Banner Y reflows upwards when Row 5 is omitted)
  console.log('\n- TEST F: Dynamic Reflow Verification (Faculty banner shifts upwards for hidden sessions)');
  const yHidden = getFacultyBannerY(pdf2025);
  const yVisible = getFacultyBannerY(pdf2026);
  console.log(`  2025-2026 (Hidden) Faculty Banner Y: ${yHidden}pt`);
  console.log(`  2026-2027 (Visible) Faculty Banner Y: ${yVisible}pt`);
  assert(
    yHidden !== null && yVisible !== null && yHidden < yVisible,
    `Dynamic reflow confirmed: hidden metadata table is more compact (${yHidden}pt < ${yVisible}pt)`
  );

  console.log('\n===============================================================');
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
