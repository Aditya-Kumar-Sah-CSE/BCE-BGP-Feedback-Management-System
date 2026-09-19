'use client';

import { useTransition } from 'react';
import { useAppRouter as useRouter } from '@/lib/hooks/use-app-router';
import { Trash2, Loader2 } from 'lucide-react';
import { deleteFeedbackFormAction } from '@/app/admin/forms/actions';

interface DeleteFormButtonProps {
  formId: string;
  formTitle: string;
  className?: string;
  variant?: 'table' | 'button';
  redirectOnDelete?: boolean;
}

export function DeleteFormButton({
  formId,
  formTitle,
  className = '',
  variant = 'table',
  redirectOnDelete = false,
}: DeleteFormButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    const confirmed = window.confirm(
      `Are you sure you want to delete this feedback form?\n\n"${formTitle}"\n\nThis will remove it permanently from the system.`
    );
    if (!confirmed) return;

    startTransition(async () => {
      const res = await deleteFeedbackFormAction(formId);
      if (res.success) {
        if (redirectOnDelete) {
          router.push('/admin/dashboard/forms');
        } else {
          router.refresh();
        }
      } else {
        alert(res.error || 'Failed to delete form');
      }
    });
  };

  if (variant === 'button') {
    return (
      <button
        type="button"
        onClick={handleDelete}
        disabled={isPending}
        className={`inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 hover:border-rose-600 rounded-xl text-xs font-bold transition-all disabled:opacity-50 ${className}`}
        title="Delete this feedback form"
      >
        {isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Trash2 className="w-4 h-4" />
        )}
        <span>{isPending ? 'Deleting...' : 'Delete Form'}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={isPending}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 hover:border-rose-600 transition-all disabled:opacity-50 ${className}`}
      title="Delete feedback form"
    >
      {isPending ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Trash2 className="w-3.5 h-3.5" />
      )}
      <span>Delete</span>
    </button>
  );
}
