/**
 * Types and Interfaces for BCE Faculty Feedback Analytics & Reporting
 * Bhagalpur College of Engineering (Govt. of Bihar)
 */

export type RatingOption = 'Very Good' | 'Good' | 'Satisfactory' | 'Unsatisfactory';

export const RATING_WEIGHTS: Record<RatingOption, number> = {
  'Very Good': 4,
  'Good': 3,
  'Satisfactory': 2,
  'Unsatisfactory': 1,
};

export interface CanonicalResponseRow {
  timestamp: string;
  responseId: string;
  ratings: Record<number, RatingOption | null>; // 1..8
  isValid: boolean;
}

export interface ParameterMetrics {
  parameterId: number;
  title: string;
  description: string;
  veryGoodCount: number;
  goodCount: number;
  satisfactoryCount: number;
  unsatisfactoryCount: number;
  validCount: number;
  unansweredCount: number;
  veryGoodPct: number;
  goodPct: number;
  satisfactoryPct: number;
  unsatisfactoryPct: number;
  averageScore: number; // 1.00 to 4.00 (or 0 if 0 valid responses)
  interpretation: string;
}

export interface OverallDistribution {
  veryGoodCount: number;
  goodCount: number;
  satisfactoryCount: number;
  unsatisfactoryCount: number;
  totalValidRatings: number;
  veryGoodPct: number;
  goodPct: number;
  satisfactoryPct: number;
  unsatisfactoryPct: number;
}

export interface FormAnalyticsReport {
  formId: string;
  title: string;
  academicYear: string;
  branch: string;
  semester: string;
  facultyName: string;
  subjectName: string;
  subjectCode: string;
  formType: string;
  status: string;
  lastSyncedAt: string | null;
  googleSheetUrl?: string;
  googleFormUrl?: string;
  totalResponses: number;
  validResponses: number;
  unansweredResponses: number;
  averageOverallScore: number; // 0.00 to 4.00
  compositeAverageScore: number; // Mean across all 8 parameters
  parameters: ParameterMetrics[];
  distribution: OverallDistribution;
  hasData: boolean;
  generatedAt: string;
}

export interface FacultyComparisonItem {
  formId: string;
  facultyName: string;
  subjectName: string;
  subjectCode: string;
  branch: string;
  semester: string;
  responseCount: number;
  averageScore: number;
}

export interface AggregatedAnalyticsReport {
  scopeTitle: string;
  filters: {
    academicYearId?: string;
    academicYearName?: string;
    branchId?: string;
    branchName?: string;
    semesterId?: string;
    semesterName?: string;
    facultyId?: string;
    facultyName?: string;
    subjectId?: string;
    subjectName?: string;
  };
  totalForms: number;
  formsWithResponses: number;
  totalResponses: number;
  validResponses: number;
  averageOverallScore: number;
  compositeAverageScore: number;
  parameters: ParameterMetrics[];
  distribution: OverallDistribution;
  facultyComparisons: FacultyComparisonItem[];
  hasData: boolean;
  generatedAt: string;
}
