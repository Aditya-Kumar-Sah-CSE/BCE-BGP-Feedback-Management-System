'use server';

import { createClient } from '@/lib/supabase/server';
import { Faculty, Subject } from '@/types/database';
import { isValidUUID } from '@/lib/validation';


export interface PublicFormSummary {
  id: string;
  title: string;
  description?: string | null;
  form_type: string;
  status: string;
  google_form_url?: string | null;
  published_at?: string | null;
  closed_at?: string | null;
  faculty?: {
    id: string;
    name: string;
    department: string;
    designation: string;
  };
  subject?: {
    id: string;
    name: string;
    code: string;
  };
  academic_year?: {
    id: string;
    name: string;
  };
  branch?: {
    id: string;
    name: string;
    code: string;
  };
  semester?: {
    id: string;
    name: string;
    semester_number: number;
  };
}

/**
 * Fetch faculties assigned to teach in a specific Year + Branch + Semester.
 * Only returns active faculties who have an active assignment.
 */
export async function getPublicFacultiesForSelectionAction(
  yearId: string,
  branchId: string,
  semesterId: string
): Promise<{ success: boolean; faculties: Faculty[]; error?: string }> {
  try {
    if (!isValidUUID(yearId) || !isValidUUID(branchId) || !isValidUUID(semesterId)) {
      return { success: false, faculties: [], error: 'Invalid academic parameters.' };
    }

    const supabase = await createClient();

    const { data: assignments, error } = await supabase
      .from('faculty_subject_assignments')
      .select(`
        faculty_id,
        branch_id,
        semester_id,
        is_active,
        faculty:faculties(id, name, department, designation, is_active)
      `)
      .eq('academic_year_id', yearId)
      .eq('is_active', true);

    if (error) {
      return { success: false, faculties: [], error: 'Unable to load faculty list.' };
    }

    // Filter by branch and semester
    const filtered = (assignments || []).filter((a: any) => {
      const matchBranch = !a.branch_id || a.branch_id === branchId;
      const matchSem = !a.semester_id || a.semester_id === semesterId;
      const facultyActive = a.faculty && a.faculty.is_active !== false;
      return matchBranch && matchSem && facultyActive;
    });

    // Extract unique faculties
    const facultyMap = new Map<string, Faculty>();
    filtered.forEach((a: any) => {
      if (a.faculty && !facultyMap.has(a.faculty.id)) {
        facultyMap.set(a.faculty.id, a.faculty as Faculty);
      }
    });

    const faculties = Array.from(facultyMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    return { success: true, faculties };
  } catch (err) {
    console.error('getPublicFacultiesForSelectionAction error:', err);
    return { success: false, faculties: [], error: 'Failed to load faculties.' };
  }
}

/**
 * Fetch subjects assigned to a specific faculty in a specific Year + Branch + Semester.
 */
export async function getPublicSubjectsForFacultyAction(
  yearId: string,
  branchId: string,
  semesterId: string,
  facultyId: string
): Promise<{ success: boolean; subjects: Subject[]; error?: string }> {
  try {
    if (
      !isValidUUID(yearId) ||
      !isValidUUID(branchId) ||
      !isValidUUID(semesterId) ||
      !isValidUUID(facultyId)
    ) {
      return { success: false, subjects: [], error: 'Invalid academic parameters.' };
    }

    const supabase = await createClient();

    const { data: assignments, error } = await supabase
      .from('faculty_subject_assignments')
      .select(`
        subject_id,
        branch_id,
        semester_id,
        is_active,
        subject:subjects(id, name, code, is_active)
      `)
      .eq('academic_year_id', yearId)
      .eq('faculty_id', facultyId)
      .eq('is_active', true);

    if (error) {
      return { success: false, subjects: [], error: 'Unable to load subject list.' };
    }

    // Filter by branch and semester
    const filtered = (assignments || []).filter((a: any) => {
      const matchBranch = !a.branch_id || a.branch_id === branchId;
      const matchSem = !a.semester_id || a.semester_id === semesterId;
      const subjectActive = a.subject && a.subject.is_active !== false;
      return matchBranch && matchSem && subjectActive;
    });

    // Extract unique subjects
    const subjectMap = new Map<string, Subject>();
    filtered.forEach((a: any) => {
      if (a.subject && !subjectMap.has(a.subject.id)) {
        subjectMap.set(a.subject.id, a.subject as Subject);
      }
    });

    const subjects = Array.from(subjectMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    return { success: true, subjects };
  } catch (err) {
    console.error('getPublicSubjectsForFacultyAction error:', err);
    return { success: false, subjects: [], error: 'Failed to load subjects.' };
  }
}

/**
 * Fetch public feedback form for an exact combination (Year, Branch, Sem, Faculty, Subject).
 * Strictly queries only PUBLISHED or CLOSED forms.
 * Never returns edit URLs or private sheet credentials.
 */
export async function getPublicFeedbackFormAction(
  yearId: string,
  branchId: string,
  semesterId: string,
  facultyId: string,
  subjectId: string
): Promise<{
  success: boolean;
  form: PublicFormSummary | null;
  status: 'PUBLISHED' | 'CLOSED' | 'NONE';
  message: string;
}> {
  try {
    if (
      !isValidUUID(yearId) ||
      !isValidUUID(branchId) ||
      !isValidUUID(semesterId) ||
      !isValidUUID(facultyId) ||
      !isValidUUID(subjectId)
    ) {
      return {
        success: false,
        form: null,
        status: 'NONE',
        message: 'Invalid academic parameters.',
      };
    }

    const supabase = await createClient();

    const { data: form, error } = await supabase
      .from('feedback_forms')
      .select(`
        id,
        title,
        description,
        form_type,
        status,
        google_form_url,
        published_at,
        closed_at,
        faculty:faculties(id, name, department, designation),
        subject:subjects(id, name, code),
        academic_year:academic_years(id, name),
        branch:branches(id, name, code),
        semester:semesters(id, name, semester_number)
      `)
      .eq('academic_year_id', yearId)
      .eq('branch_id', branchId)
      .eq('semester_id', semesterId)
      .eq('faculty_id', facultyId)
      .eq('subject_id', subjectId)
      .in('status', ['PUBLISHED', 'CLOSED'])
      .maybeSingle();

    if (error) {
      console.error('getPublicFeedbackFormAction query error:', error);
      return {
        success: false,
        form: null,
        status: 'NONE',
        message: 'Unable to check feedback form availability. Please try again.',
      };
    }

    if (!form) {
      return {
        success: true,
        form: null,
        status: 'NONE',
        message: 'No feedback form is currently available for this selection.',
      };
    }

    if (form.status === 'CLOSED') {
      return {
        success: true,
        form: form as unknown as PublicFormSummary,
        status: 'CLOSED',
        message: 'This feedback form is closed and is no longer accepting submissions.',
      };
    }

    return {
      success: true,
      form: form as unknown as PublicFormSummary,
      status: 'PUBLISHED',
      message: 'Feedback form is active and accepting student evaluations.',
    };
  } catch (err) {
    console.error('getPublicFeedbackFormAction error:', err);
    return {
      success: false,
      form: null,
      status: 'NONE',
      message: 'Unable to check feedback form availability.',
    };
  }
}

/**
 * Fetch a single feedback form by ID for direct links (/feedback/[id]).
 * Returns only public safe fields and enforces that DRAFT/ARCHIVED forms are not exposed.
 */
export async function getPublicFeedbackFormByIdAction(formId: string): Promise<{
  success: boolean;
  form: PublicFormSummary | null;
  status: 'PUBLISHED' | 'CLOSED' | 'UNAVAILABLE';
  message: string;
}> {
  try {
    if (!formId || !isValidUUID(formId)) {
      return {
        success: false,
        form: null,
        status: 'UNAVAILABLE',
        message: 'This feedback form link is invalid.',
      };
    }

    const supabase = await createClient();

    const { data: form, error } = await supabase
      .from('feedback_forms')
      .select(`
        id,
        title,
        description,
        form_type,
        status,
        google_form_url,
        published_at,
        closed_at,
        faculty:faculties(id, name, department, designation),
        subject:subjects(id, name, code),
        academic_year:academic_years(id, name),
        branch:branches(id, name, code),
        semester:semesters(id, name, semester_number)
      `)
      .eq('id', formId)
      .maybeSingle();

    if (error || !form) {
      return {
        success: false,
        form: null,
        status: 'UNAVAILABLE',
        message: 'This feedback form is no longer available or the link is invalid.',
      };
    }

    if (form.status === 'DRAFT' || form.status === 'ARCHIVED') {
      return {
        success: false,
        form: null,
        status: 'UNAVAILABLE',
        message: 'This feedback form is not currently available for public evaluations.',
      };
    }

    if (form.status === 'CLOSED') {
      return {
        success: true,
        form: form as unknown as PublicFormSummary,
        status: 'CLOSED',
        message: 'This feedback form is closed and is no longer accepting submissions.',
      };
    }

    return {
      success: true,
      form: form as unknown as PublicFormSummary,
      status: 'PUBLISHED',
      message: 'Feedback form is currently active.',
    };
  } catch (err) {
    console.error('getPublicFeedbackFormByIdAction error:', err);
    return {
      success: false,
      form: null,
      status: 'UNAVAILABLE',
      message: 'Unable to load feedback form.',
    };
  }
}
