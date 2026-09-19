import { createGoogleFeedbackForm } from '../src/lib/google/forms';
import { createFeedbackSpreadsheet } from '../src/lib/google/sheets';
import { linkFormToSpreadsheet } from '../src/lib/google/linking';
import { FORM_CONFIRMATION_MESSAGE } from '../src/lib/google/template';

async function createBrowserVerificationForm() {
  console.log('Creating verification form...');
  const form = await createGoogleFeedbackForm({
    title: 'BCE Verification — Faculty Feedback Form',
    description: 'BCE Feedback Form Response Experience Live Verification.',
  });

  console.log('Form created:');
  console.log('ID:', form.formId);
  console.log('Responder URI:', form.responderUri);

  const sheet = await createFeedbackSpreadsheet({
    title: 'BCE Verification — Faculty Feedback Form',
  });
  console.log('Sheet ID:', sheet.spreadsheetId);

  const linkResult = await linkFormToSpreadsheet(
    form.formId,
    sheet.spreadsheetId,
    FORM_CONFIRMATION_MESSAGE
  );

  console.log('Linking Result:', linkResult);
}

createBrowserVerificationForm().catch(console.error);
