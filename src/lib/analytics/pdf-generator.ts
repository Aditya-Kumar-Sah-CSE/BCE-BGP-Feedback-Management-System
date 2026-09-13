/**
 * Server-Side PDF Report Generator for BCE Faculty Feedback System
 * Uses PDFKit for pure server-side, vector-sharp PDF generation.
 * Bhagalpur College of Engineering (Govt. of Bihar)
 */

import PDFDocument from 'pdfkit';
import { FormAnalyticsReport, AggregatedAnalyticsReport } from './types';

// Palette Tokens
const COLORS = {
  primary: '#1B365D', // BCE Navy
  secondary: '#334155', // Slate 700
  accent: '#2563EB', // Blue 600
  success: '#059669', // Emerald 600
  warning: '#D97706', // Amber 600
  danger: '#DC2626', // Red 600
  border: '#CBD5E1', // Slate 300
  bgLight: '#F8FAFC', // Slate 50
  bgHeader: '#1E293B', // Slate 800
  textMuted: '#64748B', // Slate 500
  white: '#FFFFFF',
};

function streamToBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

/**
 * Draws standardized BCE Header banner
 */
function drawHeader(doc: PDFKit.PDFDocument, subtitle: string) {
  const pageWidth = 595.28; // A4 width in pt
  const margin = 36;
  const contentWidth = pageWidth - margin * 2;

  // Top decorative color bar
  doc.rect(margin, 30, contentWidth, 5).fill(COLORS.accent);

  // Institution Header
  doc
    .font('Helvetica-Bold')
    .fontSize(16)
    .fillColor(COLORS.primary)
    .text('BHAGALPUR COLLEGE OF ENGINEERING', margin, 42, {
      align: 'center',
      width: contentWidth,
    });

  doc
    .font('Helvetica')
    .fontSize(8.5)
    .fillColor(COLORS.textMuted)
    .text('Department of Science & Technology, Government of Bihar • Established 1960', margin, 62, {
      align: 'center',
      width: contentWidth,
    });

  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor(COLORS.secondary)
    .text(subtitle.toUpperCase(), margin, 75, {
      align: 'center',
      width: contentWidth,
    });

  // Divider line
  doc
    .strokeColor(COLORS.border)
    .lineWidth(0.75)
    .moveTo(margin, 93)
    .lineTo(pageWidth - margin, 93)
    .stroke();
}

/**
 * Draws Standardized Footer
 */
function drawFooter(doc: PDFKit.PDFDocument, pageNum: number, totalPages: number) {
  const margin = 36;
  const pageWidth = 595.28;
  const pageHeight = 841.89; // A4 height

  doc
    .strokeColor(COLORS.border)
    .lineWidth(0.5)
    .moveTo(margin, pageHeight - 42)
    .lineTo(pageWidth - margin, pageHeight - 42)
    .stroke();

  doc
    .font('Helvetica')
    .fontSize(7.5)
    .fillColor(COLORS.textMuted)
    .text(
      'BCE Bhagalpur Faculty Feedback Management System • Confidential Institutional Assessment Report • Student submissions are 100% anonymous',
      margin,
      pageHeight - 34,
      { width: pageWidth - margin * 2 - 60, align: 'left' }
    );

  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(COLORS.textMuted)
    .text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin - 60, pageHeight - 34, {
      width: 60,
      align: 'right',
    });
}

/**
 * Generates an Individual Faculty Feedback Report PDF
 */
export async function generateIndividualFacultyPDF(
  report: FormAnalyticsReport
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 36,
    autoFirstPage: true,
    info: {
      Title: `Faculty Feedback Report — ${report.facultyName} — ${report.subjectCode}`,
      Author: 'Bhagalpur College of Engineering',
      Subject: 'Faculty Evaluation Report',
      Keywords: 'BCE, Feedback, Faculty Evaluation',
    },
  });

  const bufferPromise = streamToBuffer(doc);
  const margin = 36;
  const pageWidth = 595.28;
  const contentWidth = pageWidth - margin * 2;

  // Page 1 Header
  drawHeader(doc, 'Faculty Feedback Evaluation Report');

  let currentY = 104;

  // Metadata Card (2 Columns)
  doc.rect(margin, currentY, contentWidth, 68).fillAndStroke(COLORS.bgLight, COLORS.border);

  const col1X = margin + 14;
  const col2X = margin + contentWidth / 2 + 10;
  const metaY = currentY + 10;

  // Col 1
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.secondary).text('Faculty Member: ', col1X, metaY, { continued: true });
  doc.font('Helvetica').fillColor('#000').text(report.facultyName || 'N/A');

  doc.font('Helvetica-Bold').text('Subject / Course: ', col1X, metaY + 14, { continued: true });
  doc.font('Helvetica').text(`${report.subjectName || 'N/A'} (${report.subjectCode || 'N/A'})`);

  doc.font('Helvetica-Bold').text('Branch / Discipline: ', col1X, metaY + 28, { continued: true });
  doc.font('Helvetica').text(report.branch || 'N/A');

  doc.font('Helvetica-Bold').text('Academic Session: ', col1X, metaY + 42, { continued: true });
  doc.font('Helvetica').text(report.academicYear || 'N/A');

  // Col 2
  doc.font('Helvetica-Bold').text('Semester: ', col2X, metaY, { continued: true });
  doc.font('Helvetica').text(report.semester || 'N/A');

  doc.font('Helvetica-Bold').text('Evaluation Type: ', col2X, metaY + 14, { continued: true });
  doc.font('Helvetica').text(report.formType || 'Faculty-Specific');

  doc.font('Helvetica-Bold').text('Lifecycle Status: ', col2X, metaY + 28, { continued: true });
  doc.font('Helvetica').text(report.status || 'PUBLISHED');

  doc.font('Helvetica-Bold').text('Report Generated: ', col2X, metaY + 42, { continued: true });
  doc.font('Helvetica').text(new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }));

  currentY += 80;

  // KPI Summary Metric Blocks (4 Boxes)
  const boxGap = 8;
  const boxWidth = (contentWidth - boxGap * 3) / 4;
  const boxHeight = 48;

  // Box 1: Total Responses
  doc.rect(margin, currentY, boxWidth, boxHeight).fillAndStroke('#EFF6FF', '#BFDBFE');
  doc.font('Helvetica').fontSize(7.5).fillColor('#1E40AF').text('TOTAL RESPONSES', margin, currentY + 8, { width: boxWidth, align: 'center' });
  doc.font('Helvetica-Bold').fontSize(16).fillColor('#1E3A8A').text(String(report.totalResponses), margin, currentY + 22, { width: boxWidth, align: 'center' });

  // Box 2: Valid Responses
  const box2X = margin + boxWidth + boxGap;
  doc.rect(box2X, currentY, boxWidth, boxHeight).fillAndStroke('#ECFDF5', '#A7F3D0');
  doc.font('Helvetica').fontSize(7.5).fillColor('#065F46').text('VALID SUBMISSIONS', box2X, currentY + 8, { width: boxWidth, align: 'center' });
  doc.font('Helvetica-Bold').fontSize(16).fillColor('#064E3B').text(String(report.validResponses), box2X, currentY + 22, { width: boxWidth, align: 'center' });

  // Box 3: Overall Rating Score
  const box3X = margin + (boxWidth + boxGap) * 2;
  const scoreColor = report.averageOverallScore >= 3.0 ? '#065F46' : report.averageOverallScore >= 2.0 ? '#92400E' : '#991B1B';
  const scoreBg = report.averageOverallScore >= 3.0 ? '#ECFDF5' : report.averageOverallScore >= 2.0 ? '#FEF3C7' : '#FEE2E2';
  const scoreBorder = report.averageOverallScore >= 3.0 ? '#A7F3D0' : report.averageOverallScore >= 2.0 ? '#FDE68A' : '#FECACA';

  doc.rect(box3X, currentY, boxWidth, boxHeight).fillAndStroke(scoreBg, scoreBorder);
  doc.font('Helvetica').fontSize(7.5).fillColor(scoreColor).text('OVERALL RATING', box3X, currentY + 8, { width: boxWidth, align: 'center' });
  doc.font('Helvetica-Bold').fontSize(16).fillColor(scoreColor).text(
    report.hasData ? `${report.averageOverallScore.toFixed(2)} / 4.00` : 'N/A',
    box3X,
    currentY + 22,
    { width: boxWidth, align: 'center' }
  );

  // Box 4: Performance Grade
  const box4X = margin + (boxWidth + boxGap) * 3;
  let gradeText = 'No Data';
  if (report.hasData) {
    if (report.averageOverallScore >= 3.5) gradeText = 'VERY GOOD';
    else if (report.averageOverallScore >= 2.75) gradeText = 'GOOD';
    else if (report.averageOverallScore >= 2.0) gradeText = 'SATISFACTORY';
    else gradeText = 'NEEDS ATTN';
  }
  doc.rect(box4X, currentY, boxWidth, boxHeight).fillAndStroke(COLORS.bgLight, COLORS.border);
  doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.secondary).text('PERFORMANCE GRADE', box4X, currentY + 8, { width: boxWidth, align: 'center' });
  doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.primary).text(gradeText, box4X, currentY + 24, { width: boxWidth, align: 'center' });

  currentY += boxHeight + 16;

  // Empty State Check
  if (!report.hasData) {
    doc.rect(margin, currentY, contentWidth, 70).fillAndStroke('#FFFBEB', '#FDE68A');
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#92400E').text('No Feedback Responses Available', margin, currentY + 18, {
      width: contentWidth,
      align: 'center',
    });
    doc.font('Helvetica').fontSize(9).fillColor('#B45309').text(
      'No student responses have been synchronized yet for this feedback form. Check back once students submit responses on the official Google Form.',
      margin + 20,
      currentY + 34,
      { width: contentWidth - 40, align: 'center' }
    );
    drawFooter(doc, 1, 1);
    doc.end();
    return bufferPromise;
  }

  // Parameter Evaluation Table Header
  doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.primary).text('EVALUATION PARAMETERS ANALYSIS (WEIGHTED SCALE: 1.00 — 4.00)', margin, currentY);
  currentY += 14;

  const tableTop = currentY;
  const colWidths = [190, 60, 50, 48, 55, 60, 60]; // Total 523pt
  const headers = ['Parameter (1 to 8)', 'Avg (4.0)', 'V. Good %', 'Good %', 'Satisfactory %', 'Unsatisfactory %', 'Visual Bar'];

  // Table header background
  doc.rect(margin, tableTop, contentWidth, 18).fill(COLORS.bgHeader);

  let curX = margin;
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(COLORS.white);
  headers.forEach((h, i) => {
    const align = i === 0 ? 'left' : 'center';
    doc.text(h, curX + 4, tableTop + 5, { width: colWidths[i] - 8, align });
    curX += colWidths[i];
  });

  currentY += 18;

  // Table Rows
  report.parameters.forEach((p, idx) => {
    const rowHeight = 22;
    const isAlt = idx % 2 === 1;

    // Zebra striping
    if (isAlt) {
      doc.rect(margin, currentY, contentWidth, rowHeight).fill('#F8FAFC');
    }
    // Bottom border
    doc.strokeColor('#E2E8F0').lineWidth(0.5).moveTo(margin, currentY + rowHeight).lineTo(margin + contentWidth, currentY + rowHeight).stroke();

    let cellX = margin;

    // Col 0: Parameter Title
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(COLORS.secondary);
    doc.text(`${p.parameterId}. ${p.title}`, cellX + 4, currentY + 7, { width: colWidths[0] - 8, align: 'left' });
    cellX += colWidths[0];

    // Col 1: Avg Score
    doc.font('Helvetica-Bold').fontSize(8).fillColor(p.averageScore >= 3.0 ? '#059669' : p.averageScore >= 2.0 ? '#D97706' : '#DC2626');
    doc.text(p.validCount > 0 ? p.averageScore.toFixed(2) : '-', cellX + 2, currentY + 7, { width: colWidths[1] - 4, align: 'center' });
    cellX += colWidths[1];

    // Col 2: Very Good %
    doc.font('Helvetica').fontSize(7.5).fillColor('#334155');
    doc.text(p.validCount > 0 ? `${p.veryGoodPct.toFixed(0)}%` : '-', cellX + 2, currentY + 7, { width: colWidths[2] - 4, align: 'center' });
    cellX += colWidths[2];

    // Col 3: Good %
    doc.text(p.validCount > 0 ? `${p.goodPct.toFixed(0)}%` : '-', cellX + 2, currentY + 7, { width: colWidths[3] - 4, align: 'center' });
    cellX += colWidths[3];

    // Col 4: Satisfactory %
    doc.text(p.validCount > 0 ? `${p.satisfactoryPct.toFixed(0)}%` : '-', cellX + 2, currentY + 7, { width: colWidths[4] - 4, align: 'center' });
    cellX += colWidths[4];

    // Col 5: Unsatisfactory %
    doc.text(p.validCount > 0 ? `${p.unsatisfactoryPct.toFixed(0)}%` : '-', cellX + 2, currentY + 7, { width: colWidths[5] - 4, align: 'center' });
    cellX += colWidths[5];

    // Col 6: Vector Bar Visual (Score out of 4.0 mapped to 50pt bar)
    const barWidth = 48;
    const barHeight = 8;
    const barX = cellX + 6;
    const barY = currentY + 7;

    // Background track
    doc.rect(barX, barY, barWidth, barHeight).fill('#E2E8F0');

    // Filled portion
    if (p.validCount > 0) {
      const fillW = Math.max(2, Math.min(barWidth, (p.averageScore / 4.0) * barWidth));
      const barColor = p.averageScore >= 3.0 ? '#10B981' : p.averageScore >= 2.0 ? '#F59E0B' : '#EF4444';
      doc.rect(barX, barY, fillW, barHeight).fill(barColor);
    }

    currentY += rowHeight;
  });

  currentY += 14;

  // Distribution Breakdown Summary
  doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.primary).text('AGGREGATE RATING DISTRIBUTION (ALL PARAMETERS)', margin, currentY);
  currentY += 14;

  const distCardHeight = 44;
  doc.rect(margin, currentY, contentWidth, distCardHeight).fillAndStroke(COLORS.bgLight, COLORS.border);

  const distColW = contentWidth / 4;
  const distY = currentY + 8;

  // Very Good
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#059669').text('VERY GOOD', margin, distY, { width: distColW, align: 'center' });
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#065F46').text(`${report.distribution.veryGoodCount} (${report.distribution.veryGoodPct}%)`, margin, distY + 12, { width: distColW, align: 'center' });

  // Good
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#2563EB').text('GOOD', margin + distColW, distY, { width: distColW, align: 'center' });
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#1E40AF').text(`${report.distribution.goodCount} (${report.distribution.goodPct}%)`, margin + distColW, distY + 12, { width: distColW, align: 'center' });

  // Satisfactory
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#D97706').text('SATISFACTORY', margin + distColW * 2, distY, { width: distColW, align: 'center' });
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#92400E').text(`${report.distribution.satisfactoryCount} (${report.distribution.satisfactoryPct}%)`, margin + distColW * 2, distY + 12, { width: distColW, align: 'center' });

  // Unsatisfactory
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#DC2626').text('UNSATISFACTORY', margin + distColW * 3, distY, { width: distColW, align: 'center' });
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#991B1B').text(`${report.distribution.unsatisfactoryCount} (${report.distribution.unsatisfactoryPct}%)`, margin + distColW * 3, distY + 12, { width: distColW, align: 'center' });

  currentY += distCardHeight + 14;

  // Data-Driven Factual Observations Section
  doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.primary).text('OBJECTIVE DATA-DRIVEN INTERPRETATION', margin, currentY);
  currentY += 14;

  doc.rect(margin, currentY, contentWidth, 100).fillAndStroke('#FAF5FF', '#E9D5FF');

  let obsY = currentY + 8;
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#6B21A8').text('Key Observations (Strictly Derived from Computed Submissions):', margin + 12, obsY);
  obsY += 12;

  // Sort parameters to highlight top and bottom areas
  const sortedParams = [...report.parameters].filter(p => p.validCount > 0).sort((a, b) => b.averageScore - a.averageScore);

  doc.font('Helvetica').fontSize(7.5).fillColor('#4C1D95');

  if (sortedParams.length > 0) {
    const highest = sortedParams[0];
    const lowest = sortedParams[sortedParams.length - 1];

    doc.text(`• Highest Rated Parameter: "${highest.title}" with a weighted score of ${highest.averageScore.toFixed(2)}/4.00 (${highest.veryGoodPct}% Very Good).`, margin + 14, obsY);
    obsY += 11;

    doc.text(`• Area for Academic Attention: "${lowest.title}" scored ${lowest.averageScore.toFixed(2)}/4.00 (${lowest.unsatisfactoryPct}% Unsatisfactory).`, margin + 14, obsY);
    obsY += 11;

    doc.text(`• Overall Feedback Satisfaction: ${(report.distribution.veryGoodPct + report.distribution.goodPct).toFixed(1)}% of all individual ratings were either Very Good or Good.`, margin + 14, obsY);
    obsY += 11;

    doc.text(`• Sample Reliability: Total valid student submissions evaluated: ${report.validResponses} (${report.unansweredResponses} incomplete/unanswered).`, margin + 14, obsY);
    obsY += 11;

    doc.text(`• Scoring Formula Applied: Weighted Average = (VG×4 + G×3 + S×2 + U×1) ÷ Total Valid Submissions.`, margin + 14, obsY);
  }

  // Draw Footer
  drawFooter(doc, 1, 1);

  doc.end();
  return bufferPromise;
}

/**
 * Generates an Institutional / Scope Aggregated Feedback Report PDF
 */
export async function generateOverallFeedbackPDF(
  report: AggregatedAnalyticsReport
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 36,
    autoFirstPage: true,
    info: {
      Title: `Overall Feedback Analysis Report — ${report.scopeTitle}`,
      Author: 'Bhagalpur College of Engineering',
      Subject: 'Institutional Feedback Report',
      Keywords: 'BCE, Feedback, Institutional Evaluation',
    },
  });

  const bufferPromise = streamToBuffer(doc);
  const margin = 36;
  const pageWidth = 595.28;
  const contentWidth = pageWidth - margin * 2;

  // Header
  drawHeader(doc, 'Institutional Feedback Analytics Report');

  let currentY = 104;

  // Scope Header Card
  doc.rect(margin, currentY, contentWidth, 54).fillAndStroke(COLORS.bgLight, COLORS.border);

  const scopeY = currentY + 9;
  doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.secondary).text('ANALYSIS SCOPE & TARGET DOMAIN: ', margin + 12, scopeY, { continued: true });
  doc.font('Helvetica-Bold').fillColor(COLORS.primary).text(report.scopeTitle);

  doc.font('Helvetica').fontSize(8).fillColor(COLORS.textMuted).text(
    `Scope Parameters: Session: ${report.filters.academicYearName || 'All'} • Branch: ${report.filters.branchName || 'All'} • Semester: ${report.filters.semesterName || 'All'} • Faculty: ${report.filters.facultyName || 'All'}`,
    margin + 12,
    scopeY + 15
  );

  doc.font('Helvetica').fontSize(8).fillColor(COLORS.textMuted).text(
    `Evaluation Date: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} • BCE Bhagalpur Academic Quality Assurance`,
    margin + 12,
    scopeY + 27
  );

  currentY += 64;

  // Executive KPI Summary Blocks
  const boxGap = 8;
  const boxWidth = (contentWidth - boxGap * 3) / 4;
  const boxHeight = 48;

  // Forms Count
  doc.rect(margin, currentY, boxWidth, boxHeight).fillAndStroke('#F1F5F9', '#CBD5E1');
  doc.font('Helvetica').fontSize(7.5).fillColor('#334155').text('ACTIVE FORMS', margin, currentY + 8, { width: boxWidth, align: 'center' });
  doc.font('Helvetica-Bold').fontSize(16).fillColor(COLORS.primary).text(
    `${report.formsWithResponses} / ${report.totalForms}`,
    margin,
    currentY + 22,
    { width: boxWidth, align: 'center' }
  );

  // Total Responses
  const box2X = margin + boxWidth + boxGap;
  doc.rect(box2X, currentY, boxWidth, boxHeight).fillAndStroke('#EFF6FF', '#BFDBFE');
  doc.font('Helvetica').fontSize(7.5).fillColor('#1E40AF').text('TOTAL RESPONSES', box2X, currentY + 8, { width: boxWidth, align: 'center' });
  doc.font('Helvetica-Bold').fontSize(16).fillColor('#1E3A8A').text(String(report.totalResponses), box2X, currentY + 22, { width: boxWidth, align: 'center' });

  // Valid Submissions
  const box3X = margin + (boxWidth + boxGap) * 2;
  doc.rect(box3X, currentY, boxWidth, boxHeight).fillAndStroke('#ECFDF5', '#A7F3D0');
  doc.font('Helvetica').fontSize(7.5).fillColor('#065F46').text('VALID SUBMISSIONS', box3X, currentY + 8, { width: boxWidth, align: 'center' });
  doc.font('Helvetica-Bold').fontSize(16).fillColor('#064E3B').text(String(report.validResponses), box3X, currentY + 22, { width: boxWidth, align: 'center' });

  // Scope Average
  const box4X = margin + (boxWidth + boxGap) * 3;
  const scoreColor = report.averageOverallScore >= 3.0 ? '#065F46' : report.averageOverallScore >= 2.0 ? '#92400E' : '#991B1B';
  const scoreBg = report.averageOverallScore >= 3.0 ? '#ECFDF5' : report.averageOverallScore >= 2.0 ? '#FEF3C7' : '#FEE2E2';
  const scoreBorder = report.averageOverallScore >= 3.0 ? '#A7F3D0' : report.averageOverallScore >= 2.0 ? '#FDE68A' : '#FECACA';

  doc.rect(box4X, currentY, boxWidth, boxHeight).fillAndStroke(scoreBg, scoreBorder);
  doc.font('Helvetica').fontSize(7.5).fillColor(scoreColor).text('SCOPE OVERALL RATING', box4X, currentY + 8, { width: boxWidth, align: 'center' });
  doc.font('Helvetica-Bold').fontSize(16).fillColor(scoreColor).text(
    report.hasData ? `${report.averageOverallScore.toFixed(2)} / 4.00` : 'N/A',
    box4X,
    currentY + 22,
    { width: boxWidth, align: 'center' }
  );

  currentY += boxHeight + 16;

  // Empty State Check
  if (!report.hasData) {
    doc.rect(margin, currentY, contentWidth, 70).fillAndStroke('#FFFBEB', '#FDE68A');
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#92400E').text('No Response Data in Selected Scope', margin, currentY + 18, {
      width: contentWidth,
      align: 'center',
    });
    doc.font('Helvetica').fontSize(9).fillColor('#B45309').text(
      'No student feedback responses match the selected filters yet. Responses will appear automatically once Google Form submissions are synchronized.',
      margin + 20,
      currentY + 34,
      { width: contentWidth - 40, align: 'center' }
    );
    drawFooter(doc, 1, 1);
    doc.end();
    return bufferPromise;
  }

  // Parameter Evaluation Table Header
  doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.primary).text('INSTITUTIONAL PARAMETER BENCHMARK (ALL FORMS IN SCOPE)', margin, currentY);
  currentY += 14;

  const tableTop = currentY;
  const colWidths = [190, 60, 50, 48, 55, 60, 60];
  const headers = ['Parameter (1 to 8)', 'Avg (4.0)', 'V. Good %', 'Good %', 'Satisfactory %', 'Unsatisfactory %', 'Visual Bar'];

  doc.rect(margin, tableTop, contentWidth, 18).fill(COLORS.bgHeader);

  let curX = margin;
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(COLORS.white);
  headers.forEach((h, i) => {
    const align = i === 0 ? 'left' : 'center';
    doc.text(h, curX + 4, tableTop + 5, { width: colWidths[i] - 8, align });
    curX += colWidths[i];
  });

  currentY += 18;

  report.parameters.forEach((p, idx) => {
    const rowHeight = 22;
    const isAlt = idx % 2 === 1;

    if (isAlt) doc.rect(margin, currentY, contentWidth, rowHeight).fill('#F8FAFC');
    doc.strokeColor('#E2E8F0').lineWidth(0.5).moveTo(margin, currentY + rowHeight).lineTo(margin + contentWidth, currentY + rowHeight).stroke();

    let cellX = margin;

    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(COLORS.secondary);
    doc.text(`${p.parameterId}. ${p.title}`, cellX + 4, currentY + 7, { width: colWidths[0] - 8, align: 'left' });
    cellX += colWidths[0];

    doc.font('Helvetica-Bold').fontSize(8).fillColor(p.averageScore >= 3.0 ? '#059669' : p.averageScore >= 2.0 ? '#D97706' : '#DC2626');
    doc.text(p.validCount > 0 ? p.averageScore.toFixed(2) : '-', cellX + 2, currentY + 7, { width: colWidths[1] - 4, align: 'center' });
    cellX += colWidths[1];

    doc.font('Helvetica').fontSize(7.5).fillColor('#334155');
    doc.text(p.validCount > 0 ? `${p.veryGoodPct.toFixed(0)}%` : '-', cellX + 2, currentY + 7, { width: colWidths[2] - 4, align: 'center' });
    cellX += colWidths[2];

    doc.text(p.validCount > 0 ? `${p.goodPct.toFixed(0)}%` : '-', cellX + 2, currentY + 7, { width: colWidths[3] - 4, align: 'center' });
    cellX += colWidths[3];

    doc.text(p.validCount > 0 ? `${p.satisfactoryPct.toFixed(0)}%` : '-', cellX + 2, currentY + 7, { width: colWidths[4] - 4, align: 'center' });
    cellX += colWidths[4];

    doc.text(p.validCount > 0 ? `${p.unsatisfactoryPct.toFixed(0)}%` : '-', cellX + 2, currentY + 7, { width: colWidths[5] - 4, align: 'center' });
    cellX += colWidths[5];

    // Bar
    const barWidth = 48;
    const barHeight = 8;
    const barX = cellX + 6;
    const barY = currentY + 7;
    doc.rect(barX, barY, barWidth, barHeight).fill('#E2E8F0');
    if (p.validCount > 0) {
      const fillW = Math.max(2, Math.min(barWidth, (p.averageScore / 4.0) * barWidth));
      const barColor = p.averageScore >= 3.0 ? '#10B981' : p.averageScore >= 2.0 ? '#F59E0B' : '#EF4444';
      doc.rect(barX, barY, fillW, barHeight).fill(barColor);
    }

    currentY += rowHeight;
  });

  currentY += 14;

  // Faculty Comparison Section (Where data exists)
  if (report.facultyComparisons.length > 0) {
    doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.primary).text('FACULTY FEEDBACK PERFORMANCE MATRIX (ACTUAL DATA ONLY)', margin, currentY);
    currentY += 14;

    const compColWidths = [150, 150, 80, 70, 73];
    const compHeaders = ['Faculty Member', 'Subject', 'Branch', 'Responses', 'Avg Rating'];

    doc.rect(margin, currentY, contentWidth, 16).fill('#334155');
    let fX = margin;
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(COLORS.white);
    compHeaders.forEach((ch, ci) => {
      const align = ci < 3 ? 'left' : 'center';
      doc.text(ch, fX + 4, currentY + 4, { width: compColWidths[ci] - 8, align });
      fX += compColWidths[ci];
    });

    currentY += 16;

    // Show up to top 7 faculties on page 1
    const displayList = report.facultyComparisons.slice(0, 7);
    displayList.forEach((fc, fIdx) => {
      const rowHeight = 18;
      if (fIdx % 2 === 1) doc.rect(margin, currentY, contentWidth, rowHeight).fill('#F8FAFC');
      doc.strokeColor('#E2E8F0').lineWidth(0.5).moveTo(margin, currentY + rowHeight).lineTo(margin + contentWidth, currentY + rowHeight).stroke();

      let cellX = margin;
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(COLORS.secondary).text(fc.facultyName, cellX + 4, currentY + 5, { width: compColWidths[0] - 8 });
      cellX += compColWidths[0];

      doc.font('Helvetica').fontSize(7).fillColor('#475569').text(fc.subjectName, cellX + 4, currentY + 5, { width: compColWidths[1] - 8 });
      cellX += compColWidths[1];

      doc.font('Helvetica').fontSize(7).fillColor('#475569').text(fc.branch, cellX + 4, currentY + 5, { width: compColWidths[2] - 8 });
      cellX += compColWidths[2];

      doc.font('Helvetica').fontSize(7.5).fillColor('#334155').text(String(fc.responseCount), cellX + 2, currentY + 5, { width: compColWidths[3] - 4, align: 'center' });
      cellX += compColWidths[3];

      const fScoreColor = fc.averageScore >= 3.0 ? '#059669' : fc.averageScore >= 2.0 ? '#D97706' : '#DC2626';
      doc.font('Helvetica-Bold').fontSize(8).fillColor(fScoreColor).text(`${fc.averageScore.toFixed(2)}/4.00`, cellX + 2, currentY + 5, { width: compColWidths[4] - 4, align: 'center' });

      currentY += rowHeight;
    });

    currentY += 12;
  }

  // Footer on Page 1
  drawFooter(doc, 1, 1);

  doc.end();
  return bufferPromise;
}
