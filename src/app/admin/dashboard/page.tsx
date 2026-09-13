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

  // Parallel data fetching for the admin portal
  const [
    { data: academicYears },
    { data: branches },
    { data: semesters },
    { data: faculties },
    { data: subjects },
    { data: assignments },
    { data: adminRequests },
    { data: adminsList },
    { data: feedbackForms },
    { data: auditLogs },
  ] = await Promise.all([
    supabase.from('academic_years').select('*').order('name', { ascending: false }),
    supabase.from('branches').select('*').order('name', { ascending: true }),
    supabase.from('semesters').select('*').order('semester_number', { ascending: true }),
    supabase.from('faculties').select('*').order('name', { ascending: true }),
    supabase.from('subjects').select('*').order('code', { ascending: true }),
    supabase.from('faculty_subject_assignments').select('*').order('created_at', { ascending: false }),
    supabase.from('admin_requests').select('*').order('created_at', { ascending: false }),
    supabase.from('admins').select('*').order('created_at', { ascending: false }),
    supabase.from('feedback_forms').select('*').order('created_at', { ascending: false }),
    supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50),
  ]);

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
      />
    </div>
  );
}
