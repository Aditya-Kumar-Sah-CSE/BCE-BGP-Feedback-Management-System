import { getGoogleServices } from '../src/lib/google/auth';
import { createGoogleFeedbackForm, getGoogleForm } from '../src/lib/google/forms';
import { createFeedbackSpreadsheet } from '../src/lib/google/sheets';
import { linkFormToSpreadsheet } from '../src/lib/google/linking';
import { MultiFacultyGridItem } from '../src/lib/google/template';

async function verifyRealGoogleFormGrid() {
  console.log('================================================================');
  console.log('       VERIFY REAL GOOGLE FORM GRID (1 FACULTY, 8x5 GRID)       ');
  console.log('================================================================\n');

  const testTitle = `Verification Form — Single Faculty Grid — ${Date.now()}`;
  const testDescription = 'Real Google Form API Verification for 5-Point 8-Parameter Multiple Choice Grid.';

  const testItem: MultiFacultyGridItem = {
    facultyId: '00000000-0000-0000-0000-000000000001',
    subjectId: '00000000-0000-0000-0000-000000000002',
    facultyName: 'Dr. Test Faculty',
    subjectName: 'Data Structures',
    subjectCode: 'CS301',
    gridTitle: 'Data Structures (CS301) — Dr. Test Faculty',
  };

  console.log('1. Creating Real Google Form via Google Forms API...');
  const formResult = await createGoogleFeedbackForm({
    title: testTitle,
    description: testDescription,
    items: [testItem],
  });

  console.log('✓ Form Created:');
  console.log('  Form ID:', formResult.formId);
  console.log('  Responder URL:', formResult.responderUri);
  console.log('  Edit URL:', formResult.editUri);

  console.log('\n2. Retrieving Form Structure from Google Forms API...');
  const form = await getGoogleForm(formResult.formId);
  if (!form || !form.items) {
    throw new Error('Failed to retrieve form or form.items is empty');
  }

  console.log(`✓ Retrieved Form with ${form.items.length} items.\n`);

  // Assertion 1: Verified email collection is enabled
  const emailSetting = (form.settings as any)?.emailCollectionType;
  console.log('Checking Email Collection Setting:', emailSetting);
  if (emailSetting !== 'VERIFIED') {
    throw new Error(`Expected emailCollectionType to be VERIFIED, got: ${emailSetting}`);
  }
  console.log('✓ Assertion 8: Verified email collection is enabled.');

  // Assertion 6: Student Name exists
  const studentNameItem = form.items.find(it => it.title === 'Student Name');
  if (!studentNameItem || !studentNameItem.questionItem?.question?.textQuestion) {
    throw new Error('Student Name short answer question not found');
  }
  if (!studentNameItem.questionItem.question.required) {
    throw new Error('Student Name is not marked as required');
  }
  console.log('✓ Assertion 6: Student Name question exists and is required.');

  // Assertion 7: University Registration Number exists
  const regNoItem = form.items.find(it => it.title === 'University Registration Number');
  if (!regNoItem || !regNoItem.questionItem?.question?.textQuestion) {
    throw new Error('University Registration Number short answer question not found');
  }
  if (!regNoItem.questionItem.question.required) {
    throw new Error('University Registration Number is not marked as required');
  }
  console.log('✓ Assertion 7: University Registration Number question exists and is required.');

  // Assertion 1 & 2: questionGroupItem exists and exactly ONE grid exists
  const gridItems = form.items.filter(it => Boolean(it.questionGroupItem?.grid));
  console.log(`Found ${gridItems.length} questionGroupItem grid(s).`);
  if (gridItems.length !== 1) {
    throw new Error(`Expected exactly 1 grid item, found: ${gridItems.length}`);
  }
  console.log('✓ Assertion 1: questionGroupItem exists.');
  console.log('✓ Assertion 2: Exactly ONE grid exists.');

  const targetGridItem = gridItems[0];
  const grid = targetGridItem.questionGroupItem!.grid!;
  const questions = targetGridItem.questionGroupItem!.questions || [];

  // Assertion 3: Grid contains exactly 8 rows
  console.log(`Grid rows (questions) count: ${questions.length}`);
  if (questions.length !== 8) {
    throw new Error(`Expected exactly 8 rows in grid, got: ${questions.length}`);
  }
  console.log('✓ Assertion 3: Grid contains exactly 8 rows:');
  questions.forEach((q, idx) => {
    console.log(`   ${idx + 1}. ${q.rowQuestion?.title}`);
  });

  // Assertion 4 & 5: Grid contains exactly 5 columns in exact canonical order
  const columns = grid.columns?.options || [];
  console.log(`Grid columns count: ${columns.length}`);
  if (columns.length !== 5) {
    throw new Error(`Expected exactly 5 columns in grid, got: ${columns.length}`);
  }
  console.log('✓ Assertion 4: Grid contains exactly 5 columns.');

  const expectedOrder = [
    'Excellent',
    'Very Good',
    'Good',
    'Satisfactory',
    'Unsatisfactory',
  ];

  console.log('Verifying exact column order:');
  columns.forEach((col, idx) => {
    const val = col.value;
    console.log(`   Col ${idx + 1}: ${val} (expected: ${expectedOrder[idx]})`);
    if (val !== expectedOrder[idx]) {
      throw new Error(`Column order mismatch at index ${idx}: expected "${expectedOrder[idx]}", got "${val}"`);
    }
  });
  console.log('✓ Assertion 5: Column order is exactly Excellent, Very Good, Good, Satisfactory, Unsatisfactory.');

  // Assertion 9: General Feedback exists
  const generalFeedbackItem = form.items.find(it => it.title === 'General Feedback');
  if (!generalFeedbackItem || !generalFeedbackItem.questionItem?.question?.textQuestion?.paragraph) {
    throw new Error('General Feedback paragraph question not found');
  }
  console.log('✓ Assertion 9: General Feedback paragraph question exists.');

  // Assertion 10: More Feedback Forms item exists
  const moreInfoItem = form.items.find(it => it.title === 'More Feedback Forms');
  if (!moreInfoItem || !moreInfoItem.textItem) {
    throw new Error('More Feedback Forms informational text item not found');
  }
  console.log('✓ Assertion 10: More Feedback Forms informational text item exists.');

  // Assertion 11: Google Sheet integration remains functional
  console.log('\n3. Testing Google Sheet Creation and Linking...');
  const sheetResult = await createFeedbackSpreadsheet({
    title: testTitle,
    items: [testItem],
  });

  console.log('✓ Connected Sheet Created:');
  console.log('  Spreadsheet ID:', sheetResult.spreadsheetId);
  console.log('  Spreadsheet URL:', sheetResult.spreadsheetUrl);

  const linkingResult = await linkFormToSpreadsheet(formResult.formId, sheetResult.spreadsheetId);
  console.log('✓ Form linked to Spreadsheet:', linkingResult);
  console.log('✓ Assertion 11: Google Sheet integration is fully functional.');

  // Cleanup Google Drive files if possible
  try {
    const { drive } = getGoogleServices();
    await drive.files.delete({ fileId: formResult.formId });
    await drive.files.delete({ fileId: sheetResult.spreadsheetId });
    console.log('\n✓ Successfully cleaned up temporary Google Form and Sheet from Google Drive.');
  } catch (cleanErr: any) {
    console.log('\nNote: Automatic drive cleanup notice:', cleanErr?.message || cleanErr);
    console.log('Retain IDs for audit: Form ID =', formResult.formId, '| Sheet ID =', sheetResult.spreadsheetId);
  }

  console.log('\n================================================================');
  console.log('     ALL 11 REAL GOOGLE FORM API ASSERTIONS PASSED (8x5 GRID)   ');
  console.log('================================================================\n');
}

verifyRealGoogleFormGrid().catch(err => {
  console.error('\nFAILED REAL GOOGLE FORM VERIFICATION:', err);
  process.exit(1);
});
