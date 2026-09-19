import { createGoogleFeedbackForm } from '../src/lib/google/forms';
import { configureGoogleFormConfirmation } from '../src/lib/google/linking';
import { getGoogleServices } from '../src/lib/google/auth';

async function testRealFormConfirmation() {
  console.log('Creating test form...');
  const form = await createGoogleFeedbackForm({
    title: 'Apps Script Confirmation Test Form',
    description: 'Temporary verification form',
  });

  console.log('Form created with ID:', form.formId);
  console.log('Responder URI:', form.responderUri);

  try {
    console.log('Configuring confirmation message via Apps Script connector...');
    const result = await configureGoogleFormConfirmation(form.formId);
    console.log('Confirmation result:', result);

    if (!result.success) {
      throw new Error(`Failed to configure confirmation message: ${result.error || result.message}`);
    }

    console.log('SUCCESS: Form confirmation message was successfully set!');
  } finally {
    console.log('Cleaning up test form...');
    const { drive } = getGoogleServices();
    await drive.files.delete({ fileId: form.formId });
    console.log('Form deleted.');
  }
}

testRealFormConfirmation().catch(console.error);
