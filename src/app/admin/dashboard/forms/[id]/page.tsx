import { notFound, redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/auth/admin-auth';
import { createClient } from '@/lib/supabase/server';
import { FeedbackForm, AuditLog } from '@/types/database';
import { FormDetailConsole } from '@/components/admin/forms/FormDetailConsole';

export const dynamic = 'force-dynamic';

export default async function FeedbackFormDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getAdminSession();
  if (!session.isAuthenticated) {
    redirect('/admin/login');
  }

  const { id } = await params;
  const supabase = await createClient();

  // Fetch form with all relations
  const { data: form, error } = await supabase
    .from('feedback_forms')
    .select(`
      *,
      faculty:faculties(*),
      subject:subjects(*),
      academic_year:academic_years(*),
      branch:branches(*),
      semester:semesters(*)
    `)
    .eq('id', id)
    .single();

  if (error || !form) {
    notFound();
  }

  // Fetch audit logs for this form
  const { data: auditLogs } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('entity_id', id)
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <FormDetailConsole
        form={form as FeedbackForm}
        auditLogs={(auditLogs || []) as AuditLog[]}
        currentUserEmail={session.admin?.email || session.user?.email || ''}
      />
    </div>
  );

}
