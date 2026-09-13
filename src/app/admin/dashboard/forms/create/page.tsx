import { createClient } from '@/lib/supabase/server';
import { getAdminSession } from '@/lib/auth/admin-auth';
import { redirect } from 'next/navigation';
import { getGoogleConfigStatus } from '@/lib/google/auth';
import { CreateGoogleFormWizard } from '@/components/admin/forms/CreateGoogleFormWizard';

export const dynamic = 'force-dynamic';

export default async function CreateFeedbackFormPage() {
  const session = await getAdminSession();
  if (!session.isAuthenticated) {
    redirect('/admin/login');
  }

  const supabase = await createClient();
  const googleStatus = getGoogleConfigStatus();

  // Fetch active academic masters
  const [
    { data: years },
    { data: branches },
    { data: semesters },
    { data: faculties },
    { data: subjects },
    { data: assignments },
  ] = await Promise.all([
    supabase.from('academic_years').select('*').order('name', { ascending: false }),
    supabase.from('branches').select('*').order('name'),
    supabase.from('semesters').select('*').order('semester_number'),
    supabase.from('faculties').select('*').order('name'),
    supabase.from('subjects').select('*').order('name'),
    supabase.from('faculty_subject_assignments').select('*').eq('is_active', true),
  ]);

  return (
    <div className="space-y-6">
      <CreateGoogleFormWizard
        academicYears={years || []}
        branches={branches || []}
        semesters={semesters || []}
        faculties={faculties || []}
        subjects={subjects || []}
        assignments={assignments || []}
        googleStatus={googleStatus}
      />
    </div>
  );
}
