import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAdminSession } from '@/lib/auth/admin-auth';
import { AdminDashboardTabs } from '@/components/admin/AdminDashboardTabs';
import type {
  AcademicYear,
  Branch,
  Semester,
  Faculty,
  Subject,
  FacultySubjectAssignment,
  Admin,
  AdminRequest,
  FeedbackForm,
  AuditLog
} from '@/types/database';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminDashboardPage() {
  const session = await getAdminSession();

  if (!session.isAuthenticated) {
    redirect('/admin/login');
  }

  if (session.isPending) {
    redirect('/admin/pending');
  }

  const supabase = await createClient();

  // Parallel lean data fetching for the admin portal with exact counts & range limits
  const [
    { data: academicYears },
    { data: branches },
    { data: semesters },
    { data: faculties, count: totalFacultiesCount },
    { data: subjects, count: totalSubjectsCount },
    { data: assignments, count: totalAssignmentsCount },
    { data: adminRequests },
    { data: adminsList },
    { data: feedbackForms, count: totalFormsCount },
    { data: auditLogs },
    { count: activeFacultiesCount },
    { count: activeSubjectsCount },
    { count: publishedFormsCount },
  ] = await Promise.all([
    supabase.from('academic_years').select('id, name, is_active, created_at').order('name', { ascending: false }),
    supabase.from('branches').select('id, name, code, is_active, created_at').order('name', { ascending: true }),
    supabase.from('semesters').select('id, name, year_number, semester_number, is_active, created_at').order('semester_number', { ascending: true }),
    supabase.from('faculties').select('id, name, employee_id, department, designation, is_active, created_at', { count: 'exact' }).order('name', { ascending: true }).range(0, 19),
    supabase.from('subjects').select('id, name, code, semester_id, branch_id, is_active, created_at', { count: 'exact' }).order('code', { ascending: true }).range(0, 19),
    supabase.from('faculty_subject_assignments').select('id, faculty_id, subject_id, academic_year_id, branch_id, semester_id, created_at', { count: 'exact' }).order('created_at', { ascending: false }).range(0, 19),
    supabase.from('admin_requests').select('*').order('created_at', { ascending: false }),
    supabase.from('admins').select('*').order('created_at', { ascending: false }),
    supabase.from('feedback_forms').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(0, 49),
    supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(20),
    supabase.from('faculties').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('subjects').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('feedback_forms').select('id', { count: 'exact', head: true }).eq('status', 'PUBLISHED'),
  ]);

  const counts = {
    totalFaculties: totalFacultiesCount ?? (faculties?.length || 0),
    activeFaculties: activeFacultiesCount ?? 0,
    totalSubjects: totalSubjectsCount ?? (subjects?.length || 0),
    activeSubjects: activeSubjectsCount ?? 0,
    totalAssignments: totalAssignmentsCount ?? (assignments?.length || 0),
    totalForms: totalFormsCount ?? (feedbackForms?.length || 0),
    publishedForms: publishedFormsCount ?? 0,
  };

  return (
    <div className="space-y-6">
      <AdminDashboardTabs
        academicYears={(academicYears as AcademicYear[]) || []}
        branches={(branches as Branch[]) || []}
        semesters={(semesters as Semester[]) || []}
        faculties={(faculties as Faculty[]) || []}
        subjects={(subjects as Subject[]) || []}
        assignments={(assignments as FacultySubjectAssignment[]) || []}
        adminRequests={(adminRequests as AdminRequest[]) || []}
        adminsList={(adminsList as Admin[]) || []}
        feedbackForms={(feedbackForms as FeedbackForm[]) || []}
        auditLogs={(auditLogs as AuditLog[]) || []}
        isSuperAdmin={session.isSuperAdmin}
        currentUserEmail={session.admin?.email || session.user?.email || ''}
        counts={counts}
      />
    </div>
  );
}
