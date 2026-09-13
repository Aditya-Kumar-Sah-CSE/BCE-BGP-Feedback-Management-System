import { notFound, redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/auth/admin-auth';
import { getFormAnalyticsAction } from '@/app/admin/results/actions';
import { FormResultsConsole } from '@/components/admin/results/FormResultsConsole';

export const dynamic = 'force-dynamic';

export default async function FormResultsDetailPage({
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

  const res = await getFormAnalyticsAction(id);

  if (!res.success || !res.report) {
    notFound();
  }

  return <FormResultsConsole initialReport={res.report} />;
}
