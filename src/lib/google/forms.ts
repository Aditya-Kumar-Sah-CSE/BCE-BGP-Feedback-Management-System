import { getGoogleServices } from './auth';
import { buildCreateQuestionsBatchUpdateRequest } from './template';

export interface CreateFormResult {
  formId: string;
  responderUri: string;
  editUri: string;
}

/**
 * Creates a Google Form and populates it with the standard 8 BCE evaluation questions.
 */
export async function createGoogleFeedbackForm(params: {
  title: string;
  description: string;
}): Promise<CreateFormResult> {
  const { forms } = getGoogleServices();

  // 1. Create the Form container
  const createRes = await forms.forms.create({
    requestBody: {
      info: {
        title: params.title,
        documentTitle: params.title,
      },
    },
  });

  const formId = createRes.data.formId;
  const responderUri = createRes.data.responderUri;

  if (!formId || !responderUri) {
    throw new Error('Google Forms API did not return valid formId or responderUri');
  }

  // 2. Batch update: Add Form Description and all 8 BCE Questions
  const questionRequests = buildCreateQuestionsBatchUpdateRequest();

  const updateInfoRequest = {
    updateFormInfo: {
      info: {
        description: params.description,
      },
      updateMask: 'description',
    },
  };

  await forms.forms.batchUpdate({
    formId,
    requestBody: {
      requests: [
        updateInfoRequest,
        ...questionRequests,
      ],
    },
  });

  return {
    formId,
    responderUri,
    editUri: `https://docs.google.com/forms/d/${formId}/edit`,
  };
}

/**
 * Retrieves Google Form details and questions
 */
export async function getGoogleForm(formId: string) {
  const { forms } = getGoogleServices();
  const res = await forms.forms.get({ formId });
  return res.data;
}

/**
 * Retrieves all submitted responses from Google Forms API
 */
export async function getGoogleFormResponses(formId: string) {
  const { forms } = getGoogleServices();
  const res = await forms.forms.responses.list({ formId });
  return res.data.responses || [];
}
