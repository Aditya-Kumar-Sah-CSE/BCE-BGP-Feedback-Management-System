'use client';

import { useState } from 'react';
import {
  X,
  Loader2,
  AlertTriangle,
  ShieldX,
} from 'lucide-react';
import { revokeTrialAction } from '@/app/admin/billing/trial-actions';
import type { Admin, AdminTrialEntitlement } from '@/types/database';

interface RevokeTrialModalProps {
  admin: Admin;
  trial: AdminTrialEntitlement;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function RevokeTrialModal({
  admin,
  trial,
  isOpen,
  onClose,
  onSuccess,
}: RevokeTrialModalProps) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRevoke = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const res = await revokeTrialAction({
        trialId: trial.id,
        reason: reason.trim() || undefined,
      });

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setError(res.error || 'Failed to revoke trial.');
      }
    } catch {
      setError('An unexpected error occurred while revoking trial.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
      <div
        className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5 my-8 border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-center justify-center">
              <ShieldX className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Revoke Free Trial</h3>
              <p className="text-xs text-slate-500">Immediate Access Revocation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warning Banner */}
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl space-y-1.5 text-xs text-red-800">
          <div className="flex items-center gap-1.5 font-bold text-red-900">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>Warning: Immediate Loss of Privileges</span>
          </div>
          <p className="leading-relaxed">
            Revoking this trial will immediately terminate all trial-granted features (such as Google Form generation and Full Analytics) for <strong>{admin.email}</strong>. The admin will immediately fall back to the base FREE plan.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
            {error}
          </div>
        )}

        {/* Revocation Reason */}
        <div className="space-y-1.5 text-xs">
          <label className="block font-semibold text-slate-700">
            Reason for Revocation (Optional)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Trial period completed early, account policy change, or user request..."
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs h-20 resize-none focus:ring-2 focus:ring-red-500/20"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleRevoke}
            disabled={submitting}
            aria-busy={submitting}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-red-600 text-white hover:bg-red-700 transition disabled:opacity-50 shadow-sm"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{submitting ? 'Revoking Trial...' : 'Confirm Revocation'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
