import { notFound, redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/auth/admin-auth';
import { getFormResponsesAction } from '@/app/admin/results/responses/actions';
import { FormResponsesConsole } from '@/components/admin/results/FormResponsesConsole';

export const dynamic = 'force-dynamic';

export default async function FormResponsesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getAdminSession();
  if (!session.isAuthenticated) {
    redirect('/admin/login');
  }

  const { id } = await params;
  if (!id) {
    notFound();
  }

  const res = await getFormResponsesAction({ formId: id, page: 1, pageSize: 20 });

  if (!res.success) {
    notFound();
  }

  return <FormResponsesConsole formId={id} initialData={res} />;
}
