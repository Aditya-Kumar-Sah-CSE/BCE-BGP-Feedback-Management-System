'use client';

import { useState, useEffect } from 'react';
import {
  X,
  Loader2,
  History,
  Sparkles,
  ShieldAlert,
  UserCheck,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react';
import { getAdminTrialHistoryAction } from '@/app/admin/billing/trial-actions';
import type { Admin, AdminTrialEntitlement } from '@/types/database';

interface TrialHistoryModalProps {
  admin: Admin;
  isOpen: boolean;
  onClose: () => void;
}

export function TrialHistoryModal({
  admin,
  isOpen,
  onClose,
}: TrialHistoryModalProps) {
  const [loading, setLoading] = useState(true);
  const [trials, setTrials] = useState<AdminTrialEntitlement[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    getAdminTrialHistoryAction(admin.id).then((res) => {
      if (res.success && res.trials) {
        setTrials(res.trials);
      }
      setLoading(false);
    });
  }, [isOpen, admin.id]);

  if (!isOpen) return null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" /> Active
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
            <Clock className="w-3 h-3" /> Expired
          </span>
        );
      case 'REVOKED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-100 text-red-700 border border-red-200">
            <XCircle className="w-3 h-3" /> Revoked
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-600">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
      <div
        className="bg-white rounded-2xl p-6 max-w-xl w-full shadow-2xl space-y-5 my-8 border border-slate-200 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 flex items-center justify-center">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Trial Entitlement History</h3>
              <p className="text-xs text-slate-500 font-mono">{admin.email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto flex-1 space-y-3 pr-1">
          {loading ? (
            <div className="p-12 flex items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-xs">Loading trial history...</span>
            </div>
          ) : trials.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-500 text-xs">
              No trial records found for this administrator.
            </div>
          ) : (
            trials.map((trial) => {
              const startDate = new Date(trial.starts_at);
              const expiryDate = new Date(trial.expires_at);

              return (
                <div
                  key={trial.id}
                  className="bg-slate-50/70 rounded-xl p-4 border border-slate-200 space-y-3 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusBadge(trial.status)}
                      <span className="text-slate-400 font-mono text-[10px]">
                        ID: {trial.id.slice(0, 8)}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      Granted: {new Date(trial.created_at).toLocaleDateString('en-IN')}
                    </span>
                  </div>

                  {/* Validity Dates */}
                  <div className="grid grid-cols-2 gap-2 bg-white p-2.5 rounded-lg border border-slate-200/80">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Start Date
                      </span>
                      <span className="font-mono text-slate-700 font-semibold">
                        {startDate.toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Expiry Date
                      </span>
                      <span className="font-mono text-slate-700 font-semibold">
                        {expiryDate.toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Features Granted */}
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 mb-1.5 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      Granted Features
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {trial.features && trial.features.length > 0 ? (
                        trial.features.map((f, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 text-[10px] font-medium"
                          >
                            {f}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">No features recorded</span>
                      )}
                    </div>
                  </div>

                  {/* Granter & Revoker Audit Info */}
                  <div className="pt-2 border-t border-slate-200/60 text-[11px] space-y-1 text-slate-500">
                    {trial.granter && (
                      <div className="flex items-center gap-1">
                        <UserCheck className="w-3 h-3 text-bce-cobalt" />
                        <span>
                          Granted by: <strong>{trial.granter.name || trial.granter.email}</strong>
                        </span>
                      </div>
                    )}

                    {trial.revoked_at && (
                      <div className="flex items-center gap-1 text-red-600">
                        <ShieldAlert className="w-3 h-3" />
                        <span>
                          Revoked on:{' '}
                          <strong>
                            {new Date(trial.revoked_at).toLocaleDateString('en-IN')}
                          </strong>
                          {trial.revoker ? ` by ${trial.revoker.email}` : ''}
                        </span>
                      </div>
                    )}

                    {trial.note && (
                      <div className="p-2 bg-white rounded-md border border-slate-200 text-slate-600 text-[11px] mt-1">
                        <strong>Note:</strong> {trial.note}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-3 border-t border-slate-100 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
