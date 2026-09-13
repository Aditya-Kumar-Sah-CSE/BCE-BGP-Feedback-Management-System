export type AdminRole = 'SUPER_ADMIN' | 'ADMIN';
export type AdminStatus = 'ACTIVE' | 'INACTIVE';
export type AdminRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type FeedbackFormStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'ARCHIVED';

export interface AcademicYear {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface Semester {
  id: string;
  name: string;
  year_number: number;
  semester_number: number;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface Faculty {
  id: string;
  name: string;
  employee_id?: string | null;
  department: string;
  designation: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  semester_id?: string | null;
  branch_id?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  // joined relations
  branch?: Branch;
  semester?: Semester;
}

export interface FacultySubjectAssignment {
  id: string;
  faculty_id: string;
  subject_id: string;
  academic_year_id: string;
  branch_id?: string | null;
  semester_id?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  // joined relations
  faculty?: Faculty;
  subject?: Subject;
  academic_year?: AcademicYear;
  branch?: Branch;
  semester?: Semester;
}

export interface Admin {
  id: string;
  user_id?: string | null;
  email: string;
  name: string;
  role: AdminRole;
  status: AdminStatus;
  created_at: string;
  updated_at?: string;
}

export interface AdminRequest {
  id: string;
  user_id?: string | null;
  email: string;
  name: string;
  status: AdminRequestStatus;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface FeedbackForm {
  id: string;
  title: string;
  description?: string | null;
  academic_year_id: string;
  branch_id: string;
  semester_id: string;
  faculty_id: string;
  subject_id: string;
  form_type: string;
  status: FeedbackFormStatus;
  slug?: string | null;
  google_form_id?: string | null;
  google_sheet_id?: string | null;
  google_form_url?: string | null;
  google_form_edit_url?: string | null;
  google_sheet_url?: string | null;
  response_destination_type?: 'NATIVE_SHEET' | 'APPLICATION_MANAGED' | string | null;
  response_count?: number;
  last_synced_at?: string | null;
  public_url?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at?: string;
  published_at?: string | null;
  closed_at?: string | null;
  archived_at?: string | null;
  // joined relations
  faculty?: Faculty;
  subject?: Subject;
  academic_year?: AcademicYear;
  branch?: Branch;
  semester?: Semester;
}

export interface AuditLog {
  id: string;
  admin_id?: string | null;
  actor_email?: string | null;
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  details?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
}

