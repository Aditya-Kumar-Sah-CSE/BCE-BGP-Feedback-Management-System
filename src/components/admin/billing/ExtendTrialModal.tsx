'use client';

import { useState } from 'react';
import {
  X,
  Loader2,
  Clock,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';
import { extendTrialAction } from '@/app/admin/billing/trial-actions';
import type { Admin, AdminTrialEntitlement } from '@/types/database';

interface ExtendTrialModalProps {
  admin: Admin;
  trial: AdminTrialEntitlement;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ExtendTrialModal({
  admin,
  trial,
  isOpen,
  onClose,
  onSuccess,
}: ExtendTrialModalProps) {
  const [extensionType, setExtensionType] = useState<'PRESET' | 'CUSTOM_DAYS' | 'CUSTOM_DATE'>('PRESET');
  const [selectedDays, setSelectedDays] = useState<number>(14);
  const [customDays, setCustomDays] = useState<string>('30');
  const [customDate, setCustomDate] = useState<string>(
    new Date(new Date(trial.expires_at).getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
  );
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentExpiry = new Date(trial.expires_at);
  const now = new Date();
  const baseDate = currentExpiry < now ? now : currentExpiry;

  let computedNewExpiry: Date;
  if (extensionType === 'CUSTOM_DATE') {
    computedNewExpiry = new Date(customDate);
  } else if (extensionType === 'CUSTOM_DAYS') {
    const days = parseInt(customDays, 10) || 1;
    computedNewExpiry = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);
  } else {
    computedNewExpiry = new Date(baseDate.getTime() + selectedDays * 24 * 60 * 60 * 1000);
  }

  const handleExtend = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const payload: any = { trialId: trial.id, note: note.trim() || undefined };
      if (extensionType === 'CUSTOM_DATE') {
        payload.newExpiresAt = new Date(customDate).toISOString();
      } else if (extensionType === 'CUSTOM_DAYS') {
        payload.additionalDays = parseInt(customDays, 10) || 1;
      } else {
        payload.additionalDays = selectedDays;
      }

      const res = await extendTrialAction(payload);
      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setError(res.error || 'Failed to extend trial.');
      }
    } catch {
      setError('An unexpected error occurred.');
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
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Extend Free Trial</h3>
              <p className="text-xs text-slate-500">Super Admin Manual Extension</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Admin Card */}
        <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-bold text-slate-800">{admin.name}</p>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full uppercase">
              {trial.status}
            </span>
          </div>
          <p className="text-[11px] font-mono text-slate-500">{admin.email}</p>
          <div className="mt-2 pt-2 border-t border-slate-200 text-[11px] text-slate-600 flex items-center justify-between">
            <span>Current Expiry:</span>
            <strong className="font-mono text-slate-800">
              {currentExpiry.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </strong>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {/* Extension Controls */}
        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-800 mb-1.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-bce-cobalt" />
              Extend By
            </label>
            <div className="grid grid-cols-4 gap-1.5 mb-2">
              {[7, 14, 30, 60].map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => {
                    setSelectedDays(days);
                    setExtensionType('PRESET');
                  }}
                  className={`px-3 py-2 rounded-lg font-semibold text-xs transition border ${
                    extensionType === 'PRESET' && selectedDays === days
                      ? 'bg-bce-cobalt text-white border-bce-cobalt shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  +{days}d
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setExtensionType('CUSTOM_DAYS')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  extensionType === 'CUSTOM_DAYS'
                    ? 'bg-bce-cobalt text-white border-bce-cobalt'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Custom Days
              </button>
              <button
                type="button"
                onClick={() => setExtensionType('CUSTOM_DATE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  extensionType === 'CUSTOM_DATE'
                    ? 'bg-bce-cobalt text-white border-bce-cobalt'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Exact Date
              </button>
            </div>

            {extensionType === 'CUSTOM_DAYS' && (
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={customDays}
                  onChange={(e) => setCustomDays(e.target.value)}
                  placeholder="Enter days"
                  className="w-32 px-3 py-1.5 rounded-lg border border-slate-300 font-mono text-sm"
                />
                <span className="text-slate-500 font-medium">additional days</span>
              </div>
            )}

            {extensionType === 'CUSTOM_DATE' && (
              <div className="mt-2">
                <input
                  type="datetime-local"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-mono"
                />
              </div>
            )}
          </div>

          {/* Calculated New Expiry Preview */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-1 text-blue-900">
            <div className="flex items-center justify-between font-bold text-xs">
              <span>New Expiry Date:</span>
            </div>
            <p className="text-xs font-bold text-blue-950 font-mono">
              {computedNewExpiry.toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}{' '}
              at {computedNewExpiry.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

          {/* Reason / Note */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Extension Reason (Optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Extended by 14 days upon request from HOD"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
            />
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExtend}
            disabled={submitting}
            aria-busy={submitting}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-bce-cobalt text-white hover:bg-bce-navy disabled:opacity-50 shadow-sm"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{submitting ? 'Extending Trial...' : 'Confirm Extension'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
