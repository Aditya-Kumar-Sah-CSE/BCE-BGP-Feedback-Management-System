import { notFound, redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/auth/admin-auth';
import { getFormResponsesAction } from '@/app/admin/results/responses/actions';
import { FormResponsesConsole } from '@/components/admin/results/FormResponsesConsole';
import { isValidUUID } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export default async function FormResponsesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // 1. Mandatory Active Admin Authentication Check
  const session = await getAdminSession();
  if (!session.isAuthenticated) {
    redirect('/admin/login');
  }

  if (!session.isActive) {
    redirect('/admin/dashboard?error=account_inactive');
  }

  // 2. Validate UUID format
  const { id } = await params;
  if (!id || !isValidUUID(id)) {
    notFound();
  }

  // 3. Fetch Real Student Responses (with admin session & IDOR verification)
  const res = await getFormResponsesAction({ formId: id, page: 1, pageSize: 20 });

  if (!res.success) {
    if (res.error === 'Form not found.') {
      notFound();
    }
  }

  return <FormResponsesConsole formId={id} initialData={res} />;
}
