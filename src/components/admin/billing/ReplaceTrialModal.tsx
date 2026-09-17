'use client';

import { useState, useEffect } from 'react';
import {
  X,
  Loader2,
  Clock,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { replaceTrialAction, getTrialConfigAction } from '@/app/admin/billing/trial-actions';
import type { Admin, AdminTrialEntitlement } from '@/types/database';

interface ReplaceTrialModalProps {
  admin: Admin;
  currentTrial?: AdminTrialEntitlement | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ReplaceTrialModal({
  admin,
  currentTrial,
  isOpen,
  onClose,
  onSuccess,
}: ReplaceTrialModalProps) {
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [availableFeatures, setAvailableFeatures] = useState<string[]>([]);
  const [durationPresets, setDurationPresets] = useState<number[]>([7, 14, 30, 60, 90]);

  // Form state
  const [selectedDuration, setSelectedDuration] = useState<number>(30);
  const [isCustomDuration, setIsCustomDuration] = useState(false);
  const [customDays, setCustomDays] = useState<string>('30');
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([
    'Google Form generation',
    'Google Sheet integration',
    'Full analytics access',
  ]);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoadingConfig(true);
    getTrialConfigAction().then((res) => {
      if (res.success) {
        if (res.availableFeatures && res.availableFeatures.length > 0) {
          setAvailableFeatures(res.availableFeatures);
        }
        if (res.durationOptions && res.durationOptions.length > 0) {
          setDurationPresets(res.durationOptions);
        }
      }
      setLoadingConfig(false);
    });
  }, [isOpen]);

  if (!isOpen) return null;

  const effectiveDays = isCustomDuration ? parseInt(customDays, 10) || 1 : selectedDuration;
  const startDate = new Date();
  const expiryDate = new Date(startDate.getTime() + effectiveDays * 24 * 60 * 60 * 1000);

  const toggleFeature = (feature: string) => {
    setSelectedFeatures((prev) =>
      prev.includes(feature) ? prev.filter((f) => f !== feature) : [...prev, feature]
    );
  };

  const handleReplace = async () => {
    if (selectedFeatures.length === 0) {
      setError('Please select at least one feature.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await replaceTrialAction({
        adminId: admin.id,
        durationDays: effectiveDays,
        features: selectedFeatures,
        note: note.trim() || undefined,
      });

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setError(res.error || 'Failed to replace trial.');
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
        className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-5 my-8 border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Replace Active Trial</h3>
              <p className="text-xs text-slate-500">Revoke Existing & Grant New Entitlement</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warning Callout */}
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1 text-xs text-amber-800">
          <div className="flex items-center gap-1.5 font-bold text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Active Trial Replacement Notice</span>
          </div>
          <p className="leading-relaxed">
            {admin.name} ({admin.email}) already has an active trial
            {currentTrial ? ` until ${new Date(currentTrial.expires_at).toLocaleDateString('en-IN')}` : ''}.
            Replacing it will safely revoke the existing trial and activate this new trial immediately.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
            {error}
          </div>
        )}

        {loadingConfig ? (
          <div className="p-8 flex items-center justify-center text-slate-400 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-xs">Loading options...</span>
          </div>
        ) : (
          <div className="space-y-4 text-xs">
            {/* Duration */}
            <div>
              <label className="block font-semibold text-slate-800 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-bce-cobalt" />
                New Duration *
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 mb-2">
                {durationPresets.map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => {
                      setSelectedDuration(days);
                      setIsCustomDuration(false);
                    }}
                    className={`px-2.5 py-2 rounded-lg font-semibold text-xs transition border ${
                      !isCustomDuration && selectedDuration === days
                        ? 'bg-bce-cobalt text-white border-bce-cobalt shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {days}d
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setIsCustomDuration(true)}
                  className={`px-2.5 py-2 rounded-lg font-semibold text-xs transition border ${
                    isCustomDuration
                      ? 'bg-bce-cobalt text-white border-bce-cobalt shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Custom
                </button>
              </div>

              {isCustomDuration && (
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
                  <span className="text-slate-500 font-medium">days</span>
                </div>
              )}
            </div>

            {/* Features */}
            <div>
              <label className="block font-semibold text-slate-800 mb-1.5 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Select New Features *
              </label>
              <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
                {availableFeatures.map((feat) => {
                  const isChecked = selectedFeatures.includes(feat);
                  return (
                    <label
                      key={feat}
                      onClick={() => toggleFeature(feat)}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition ${
                        isChecked
                          ? 'bg-emerald-50/80 border border-emerald-300/80 text-emerald-900 font-semibold'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="rounded text-emerald-600 focus:ring-emerald-500 pointer-events-none"
                        />
                        <span className="text-xs">{feat}</span>
                      </div>
                      {isChecked && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Preview */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-1 text-blue-900">
              <span className="font-bold text-xs block">New Calculated Expiry:</span>
              <p className="text-xs font-bold text-blue-950 font-mono">
                {expiryDate.toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}{' '}
                at {expiryDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} ({effectiveDays} days from now)
              </p>
            </div>

            {/* Reason */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Reason for Replacement (Optional)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Upgraded trial features or revised duration..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs h-16 resize-none"
              />
            </div>
          </div>
        )}

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
            onClick={handleReplace}
            disabled={submitting || loadingConfig}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50 shadow-sm"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Confirm Replacement
          </button>
        </div>
      </div>
    </div>
  );
}
