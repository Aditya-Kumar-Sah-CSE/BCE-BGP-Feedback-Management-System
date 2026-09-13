/**
 * Standard BCE 8-Parameter Faculty Feedback Evaluation Template
 * Bhagalpur College of Engineering (Govt. of Bihar)
 */

export interface FeedbackParameter {
  id: number;
  title: string;
  description?: string;
  options: string[];
}

export const BCE_RATING_OPTIONS = [
  'Very Good',
  'Good',
  'Satisfactory',
  'Unsatisfactory',
] as const;

export const BCE_FEEDBACK_PARAMETERS: FeedbackParameter[] = [
  {
    id: 1,
    title: 'Syllabus covered',
    description: 'Coverage of prescribed course syllabus within the semester',
    options: [...BCE_RATING_OPTIONS],
  },
  {
    id: 2,
    title: 'Communication skills',
    description: 'Clarity of speech, presentation, and language articulation',
    options: [...BCE_RATING_OPTIONS],
  },
  {
    id: 3,
    title: 'Teaching-learning effectiveness',
    description: 'Pacing of lectures, conceptual depth, and student engagement',
    options: [...BCE_RATING_OPTIONS],
  },
  {
    id: 4,
    title: 'Accessibility of teacher',
    description: 'Availability outside scheduled classroom hours for guidance',
    options: [...BCE_RATING_OPTIONS],
  },
  {
    id: 5,
    title: 'Willingness to offer help',
    description: 'Proactiveness in resolving student doubts and offering academic assistance',
    options: [...BCE_RATING_OPTIONS],
  },
  {
    id: 6,
    title: 'Ability to teach/explain',
    description: 'Use of relevant examples, illustrations, and problem-solving techniques',
    options: [...BCE_RATING_OPTIONS],
  },
  {
    id: 7,
    title: 'Fairness in evaluation',
    description: 'Impartiality and transparency in assessments, assignments, and grading',
    options: [...BCE_RATING_OPTIONS],
  },
  {
    id: 8,
    title: 'Overall Rating',
    description: 'Comprehensive overall performance rating for this faculty member',
    options: [...BCE_RATING_OPTIONS],
  },
];

export interface FormFieldDefinition {
  id: string;
  title: string;
  description?: string;
  type: 'TEXT' | 'PARAGRAPH' | 'RADIO';
  required: boolean;
  options?: string[];
}

export const STUDENT_IDENTIFIER_FIELDS = [
  {
    id: 'student_name',
    title: 'Student Name',
    description: 'Enter your full name as per official college records',
    required: true,
  },
  {
    id: 'reg_no',
    title: 'University Registration Number',
    description: 'Enter your official BCE / University registration number or roll number',
    required: true,
  },
] as const;

export const ADDITIONAL_FEEDBACK_FIELDS = [
  {
    id: 'comments',
    title: 'Comments / Suggestions',
    description: 'Any constructive feedback, suggestions, or specific observations for improvement (Optional)',
    required: false,
    paragraph: true,
  },
] as const;

export interface FormMetadataInputs {
  facultyName: string;
  subjectName: string;
  semesterName: string;
  academicYearName: string;
  branchName: string;
}

/**
 * Generates standardized form title:
 * Faculty Feedback — <Faculty Name> — <Subject> — <Semester> — <Academic Year>
 */
export function generateFeedbackFormTitle(meta: FormMetadataInputs): string {
  return `Faculty Feedback — ${meta.facultyName} — ${meta.subjectName} — ${meta.semesterName} — ${meta.academicYearName}`;
}

export function generateFeedbackFormDescription(meta: FormMetadataInputs): string {
  return `Official Student Feedback Form for ${meta.facultyName} teaching ${meta.subjectName} (${meta.branchName}, ${meta.semesterName}, ${meta.academicYearName}).\n\nDepartment of Science & Technology, Government of Bihar.\nBhagalpur College of Engineering (BCE Bhagalpur).\n\nPlease provide your Student Name, University Registration Number, and rate all 8 parameters objectively. Constructive comments and suggestions are welcome.`;
}

/**
 * Builds the Google Forms API batchUpdate request body:
 * 1. Student Name (Short answer, required)
 * 2. University Registration Number (Short answer, required)
 * 3. 8 Standard BCE Rating Parameters (Radio 1-4, required)
 * 4. Comments / Suggestions (Paragraph text, optional)
 */
export function buildCreateQuestionsBatchUpdateRequest() {
  const requests: any[] = [];
  let currentIndex = 0;

  // 1. Student Name
  requests.push({
    createItem: {
      item: {
        title: 'Student Name',
        description: 'Enter your full name as per official college records',
        questionItem: {
          question: {
            required: true,
            textQuestion: {
              paragraph: false,
            },
          },
        },
      },
      location: {
        index: currentIndex++,
      },
    },
  });

  // 2. University Registration Number
  requests.push({
    createItem: {
      item: {
        title: 'University Registration Number',
        description: 'Enter your official BCE / University registration number or roll number',
        questionItem: {
          question: {
            required: true,
            textQuestion: {
              paragraph: false,
            },
          },
        },
      },
      location: {
        index: currentIndex++,
      },
    },
  });

  // 3. 8 Standard BCE Rating Parameters
  BCE_FEEDBACK_PARAMETERS.forEach(param => {
    requests.push({
      createItem: {
        item: {
          title: `${param.id}. ${param.title}`,
          description: param.description,
          questionItem: {
            question: {
              required: true,
              choiceQuestion: {
                type: 'RADIO' as const,
                options: param.options.map(opt => ({ value: opt })),
                shuffle: false,
              },
            },
          },
        },
        location: {
          index: currentIndex++,
        },
      },
    });
  });

  // 4. Comments / Suggestions (Optional)
  requests.push({
    createItem: {
      item: {
        title: 'Comments / Suggestions',
        description: 'Any constructive feedback, suggestions, or specific observations for improvement (Optional)',
        questionItem: {
          question: {
            required: false,
            textQuestion: {
              paragraph: true,
            },
          },
        },
      },
      location: {
        index: currentIndex++,
      },
    },
  });

  return requests;
}
