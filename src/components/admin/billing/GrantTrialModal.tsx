'use client';

import { useState, useEffect, useId } from 'react';
import {
  X,
  Loader2,
  Calendar,
  Clock,
  Sparkles,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { grantTrialAction, getTrialConfigAction } from '@/app/admin/billing/trial-actions';
import type { Admin } from '@/types/database';

interface GrantTrialModalProps {
  admin: Admin;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onOpenReplaceModal?: () => void;
}

export function GrantTrialModal({
  admin,
  isOpen,
  onClose,
  onSuccess,
  onOpenReplaceModal,
}: GrantTrialModalProps) {
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [availableFeatures, setAvailableFeatures] = useState<string[]>([]);
  const [durationPresets, setDurationPresets] = useState<number[]>([7, 14, 30, 60, 90]);

  // Form state
  const [selectedDuration, setSelectedDuration] = useState<number>(30);
  const [isCustomDuration, setIsCustomDuration] = useState(false);
  const [customDays, setCustomDays] = useState<string>('45');
  const [startType, setStartType] = useState<'IMMEDIATELY' | 'CUSTOM'>('IMMEDIATELY');
  const [customStartDate, setCustomStartDate] = useState<string>(
    new Date().toISOString().slice(0, 16)
  );
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([
    'Google Form generation',
    'Google Sheet integration',
    'Full analytics access',
  ]);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadyActiveError, setAlreadyActiveError] = useState(false);

  const startTypeImmediatelyId = useId();
  const startTypeCustomId = useId();

  // Load dynamic feature vocabulary & duration presets from database
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

  // Compute effective days
  const effectiveDays = isCustomDuration ? parseInt(customDays, 10) || 1 : selectedDuration;

  // Compute effective start and expiry date preview
  const startDate = startType === 'IMMEDIATELY' ? new Date() : new Date(customStartDate);
  const expiryDate = new Date(startDate.getTime() + effectiveDays * 24 * 60 * 60 * 1000);

  const toggleFeature = (feature: string) => {
    setSelectedFeatures((prev) =>
      prev.includes(feature) ? prev.filter((f) => f !== feature) : [...prev, feature]
    );
  };

  const handleGrant = async () => {
    if (selectedFeatures.length === 0) {
      setError('Please select at least one feature to grant in this trial.');
      return;
    }

    if (effectiveDays < 1 || effectiveDays > 365) {
      setError('Trial duration must be between 1 and 365 days.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setAlreadyActiveError(false);

    try {
      const res = await grantTrialAction({
        adminId: admin.id,
        durationDays: effectiveDays,
        startsAt: startType === 'CUSTOM' ? new Date(customStartDate).toISOString() : undefined,
        features: selectedFeatures,
        note: note.trim() || undefined,
      });

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setError(res.error || 'Failed to grant trial.');
        if ((res as any).alreadyActive) {
          setAlreadyActiveError(true);
        }
      }
    } catch {
      setError('An unexpected error occurred while granting trial.');
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
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Grant Free Trial</h3>
              <p className="text-xs text-slate-500">Super Admin Manual Entitlement</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Target Admin Card */}
        <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-800">{admin.name}</p>
            <p className="text-[11px] font-mono text-slate-500">{admin.email}</p>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-blue-100 text-blue-800">
            {admin.role}
          </span>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p>{error}</p>
              {alreadyActiveError && onOpenReplaceModal && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenReplaceModal();
                  }}
                  className="text-xs font-bold text-red-800 underline hover:text-red-950"
                >
                  Click here to Replace existing active trial →
                </button>
              )}
            </div>
          </div>
        )}

        {loadingConfig ? (
          <div className="p-8 flex items-center justify-center text-slate-400 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-xs">Loading database configuration...</span>
          </div>
        ) : (
          <div className="space-y-4 text-xs">
            {/* 1. Duration Selection */}
            <div>
              <label className="block font-semibold text-slate-800 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-bce-cobalt" />
                Trial Duration *
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
                    placeholder="Enter days (e.g. 45)"
                    className="w-32 px-3 py-1.5 rounded-lg border border-slate-300 font-mono text-sm focus:ring-2 focus:ring-bce-cobalt/20"
                  />
                  <span className="text-slate-500 font-medium">days</span>
                </div>
              )}
            </div>

            {/* 2. Start Date Options */}
            <div>
              <label className="block font-semibold text-slate-800 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-bce-cobalt" />
                Start Date
              </label>
              <div className="flex items-center gap-4 mb-2">
                <label htmlFor={startTypeImmediatelyId} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    id={startTypeImmediatelyId}
                    type="radio"
                    name="startType"
                    checked={startType === 'IMMEDIATELY'}
                    onChange={() => setStartType('IMMEDIATELY')}
                    className="text-bce-cobalt focus:ring-bce-cobalt"
                  />
                  <span className="font-medium text-slate-700">Immediately (Now)</span>
                </label>
                <label htmlFor={startTypeCustomId} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    id={startTypeCustomId}
                    type="radio"
                    name="startType"
                    checked={startType === 'CUSTOM'}
                    onChange={() => setStartType('CUSTOM')}
                    className="text-bce-cobalt focus:ring-bce-cobalt"
                  />
                  <span className="font-medium text-slate-700">Custom start date</span>
                </label>
              </div>
              {startType === 'CUSTOM' && (
                <input
                  type="datetime-local"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-bce-cobalt/20"
                />
              )}
            </div>

            {/* 3. Features Multi-Select */}
            <div>
              <label className="block font-semibold text-slate-800 mb-1.5 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Select Trial Features to Grant *
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
                          onChange={() => {}} // Handled by label onClick
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

            {/* 4. Live Expiry Preview */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-1 text-blue-900">
              <div className="flex items-center justify-between font-bold text-xs">
                <span>Calculated Validity:</span>
                <span className="font-mono text-blue-800">{effectiveDays} days</span>
              </div>
              <p className="text-[11px] text-blue-700">
                Expires on:{' '}
                <strong>
                  {expiryDate.toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}{' '}
                  at {expiryDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </strong>
              </p>
            </div>

            {/* 5. Optional Internal Note */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Internal Note (Optional)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Granted for departmental evaluation or special workshop..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs h-16 resize-none focus:ring-2 focus:ring-bce-cobalt/20"
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
            className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleGrant}
            disabled={submitting || loadingConfig}
            aria-busy={submitting}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-bce-cobalt text-white hover:bg-bce-navy transition disabled:opacity-50 shadow-sm"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 text-amber-300" />
            )}
            <span>{submitting ? 'Granting Trial...' : 'Grant Trial'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
