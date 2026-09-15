'use client';

import { useState, useRef, useEffect } from 'react';
import { PlanCard } from './PlanCard';
import {
  CreditCard,
  Building2,
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Phone,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import {
  submitPaymentRequestAction,
  uploadPaymentProofAction,
  getPaymentSettingsAction,
} from '@/app/admin/billing/actions';
import { getActiveBillingPlansAction } from '@/app/admin/billing/plan-actions';
import type { PaymentSettings, PaymentRequest, BillingPlan } from '@/types/database';

interface PaymentRequestFormProps {
  latestRequest?: PaymentRequest | null;
  onSuccess?: () => void;
}

export function PaymentRequestForm({ latestRequest, onSuccess }: PaymentRequestFormProps) {
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [loadingPlans, setLoadingPlans] = useState(true);

  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'BANK_TRANSFER'>('UPI');
  const [paymentReference, setPaymentReference] = useState('');
  const [proofPath, setProofPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getPaymentSettingsAction().then(res => {
      if (res.success && res.settings) setSettings(res.settings);
      setLoadingSettings(false);
    });

    getActiveBillingPlansAction().then(res => {
      if (res.success && res.plans && res.plans.length > 0) {
        setPlans(res.plans);
        // Find default recommended or first non-free plan
        const nonFree = res.plans.filter(p => p.price > 0);
        const defaultPlan = nonFree.find(p => p.is_recommended) || nonFree[0] || res.plans[0];
        if (defaultPlan) {
          setSelectedPlanId(defaultPlan.id);
        }
      }
      setLoadingPlans(false);
    });
  }, []);

  const selectedPlan = plans.find(p => p.id === selectedPlanId);

  // If there's already a PENDING request, show status instead
  if (latestRequest && latestRequest.status === 'PENDING') {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2 text-amber-700">
          <Clock className="w-5 h-5" />
          <h3 className="font-semibold text-sm">Payment Request Pending</h3>
        </div>
        <p className="text-xs text-amber-600 leading-relaxed">
          Your payment request for the <strong>{latestRequest.plan_type}</strong> plan (₹{latestRequest.amount?.toLocaleString('en-IN')}) is being reviewed.
          Payment verification is handled manually by the Super Admin.
        </p>
        <p className="text-xs text-amber-600">
          UTR / Reference: <strong className="font-mono">{latestRequest.payment_reference}</strong>
        </p>
        <div className="flex items-center gap-4 pt-1 text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            Access is normally unlocked within 24 hours after verification.
          </span>
        </div>
        <p className="text-[11px] text-slate-500 flex items-center gap-1">
          <Phone className="w-3 h-3" />
          For payment issues, contact <strong>9470870830</strong>.
        </p>
      </div>
    );
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await uploadPaymentProofAction(formData);
      if (res.success && res.url) {
        setProofPath(res.url);
      } else {
        setResult({ success: false, message: res.error || 'Upload failed.' });
      }
    } catch {
      setResult({ success: false, message: 'Upload failed. Please try again.' });
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit() {
    if (!selectedPlanId) {
      setResult({ success: false, message: 'Please select a plan to continue.' });
      return;
    }

    if (!paymentReference.trim() || paymentReference.trim().length < 4) {
      setResult({ success: false, message: 'Please enter a valid UTR / transaction reference (at least 4 characters).' });
      return;
    }

    setSubmitting(true);
    setResult(null);

    try {
      const res = await submitPaymentRequestAction({
        billingPlanId: selectedPlanId,
        paymentMethod,
        paymentReference: paymentReference.trim(),
        paymentProofUrl: proofPath,
      });

      setResult({
        success: res.success,
        message: res.success ? res.message || 'Payment request submitted.' : res.error || 'Submission failed.',
      });

      if (res.success) {
        setPaymentReference('');
        setProofPath(null);
        onSuccess?.();
      }
    } catch {
      setResult({ success: false, message: 'An unexpected error occurred.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Rejection notice */}
      {latestRequest && latestRequest.status === 'REJECTED' && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-700 space-y-1">
          <p className="font-semibold flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            Your previous payment request was rejected.
          </p>
          {latestRequest.rejection_reason && (
            <p>Reason: <em>{latestRequest.rejection_reason}</em></p>
          )}
          <p>Please re-submit with the correct details below.</p>
        </div>
      )}

      {/* Dynamic Plan Selection */}
      <div>
        <h3 className="text-sm font-semibold text-slate-800 mb-3">Choose a Plan</h3>
        {loadingPlans ? (
          <div className="h-40 bg-slate-50 rounded-xl animate-pulse flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
          </div>
        ) : plans.length === 0 ? (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500">
            No active billing plans available. Please contact Super Admin.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {plans.map(p => {
              const isFree = p.price === 0 || p.name.toUpperCase().includes('FREE');
              return (
                <PlanCard
                  key={p.id}
                  billingPlan={p}
                  isDisabled={isFree}
                  isSelected={selectedPlanId === p.id}
                  onSelect={() => !isFree && setSelectedPlanId(p.id)}
                />
              );
            })}
          </div>
        )}
        <p className="text-[11px] text-slate-400 mt-2 ml-1">
          FREE plan is assigned by the Super Admin only and cannot be self-selected.
        </p>
      </div>

      {/* Payment Method */}
      <div>
        <h3 className="text-sm font-semibold text-slate-800 mb-3">Payment Method</h3>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setPaymentMethod('UPI')}
            className={`flex-1 flex items-center gap-2 px-4 py-3 rounded-xl border-2 transition-all text-sm font-medium ${
              paymentMethod === 'UPI'
                ? 'border-bce-cobalt bg-bce-cobalt/5 text-bce-cobalt'
                : 'border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            UPI
          </button>
          <button
            type="button"
            onClick={() => setPaymentMethod('BANK_TRANSFER')}
            className={`flex-1 flex items-center gap-2 px-4 py-3 rounded-xl border-2 transition-all text-sm font-medium ${
              paymentMethod === 'BANK_TRANSFER'
                ? 'border-bce-cobalt bg-bce-cobalt/5 text-bce-cobalt'
                : 'border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Bank Transfer
          </button>
        </div>
      </div>

      {/* Payment Details from Settings */}
      {!loadingSettings && settings && (
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs text-slate-700 space-y-2">
          <h4 className="font-semibold text-slate-800 text-sm">Payment Details</h4>
          {paymentMethod === 'UPI' && settings.upi_id && (
            <div>
              <span className="text-slate-500">UPI ID:</span>{' '}
              <strong className="font-mono text-slate-900">{settings.upi_id}</strong>
            </div>
          )}
          {paymentMethod === 'BANK_TRANSFER' && (
            <>
              {settings.account_name && (
                <div><span className="text-slate-500">Account Name:</span> <strong>{settings.account_name}</strong></div>
              )}
              {settings.bank_name && (
                <div><span className="text-slate-500">Bank:</span> <strong>{settings.bank_name}</strong></div>
              )}
              {settings.account_number && (
                <div><span className="text-slate-500">Account Number:</span> <strong className="font-mono">{settings.account_number}</strong></div>
              )}
              {settings.ifsc_code && (
                <div><span className="text-slate-500">IFSC:</span> <strong className="font-mono">{settings.ifsc_code}</strong></div>
              )}
            </>
          )}
          {settings.payment_instructions && (
            <p className="text-slate-500 mt-1 whitespace-pre-wrap">{settings.payment_instructions}</p>
          )}
        </div>
      )}

      {/* UTR / Reference */}
      <div>
        <label htmlFor="payment-reference" className="block text-sm font-semibold text-slate-800 mb-1.5">
          UTR / Transaction Reference <span className="text-red-500">*</span>
        </label>
        <input
          id="payment-reference"
          type="text"
          value={paymentReference}
          onChange={e => setPaymentReference(e.target.value)}
          placeholder="Enter your UTR or transaction reference number"
          className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-bce-cobalt/30 focus:border-bce-cobalt transition"
          maxLength={255}
        />
      </div>

      {/* Proof Upload */}
      <div>
        <label className="block text-sm font-semibold text-slate-800 mb-1.5">
          Payment Screenshot <span className="text-slate-400">(optional)</span>
        </label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 text-sm text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? 'Uploading...' : proofPath ? 'Change File' : 'Upload Screenshot'}
          </button>
          {proofPath && (
            <span className="text-xs text-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Uploaded
            </span>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />
        <p className="text-[11px] text-slate-400 mt-1">Max 5MB. Images only (PNG, JPG, WEBP).</p>
      </div>

      {/* Result Message */}
      {result && (
        <div className={`rounded-lg p-3 text-xs ${result.success ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          <div className="flex items-center gap-1.5">
            {result.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {result.message}
          </div>
        </div>
      )}

      {/* Dynamic Submit Button */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting || !paymentReference.trim() || !selectedPlan}
        className="w-full py-3 rounded-xl bg-bce-cobalt text-white font-semibold text-sm hover:bg-bce-navy transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {submitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Submitting...
          </>
        ) : (
          <>
            <CreditCard className="w-4 h-4" />
            Submit Payment Request — {selectedPlan ? `₹${selectedPlan.price.toLocaleString('en-IN')}` : 'Select Plan'}
          </>
        )}
      </button>

      {/* Info Notices */}
      <div className="space-y-2 text-[11px] text-slate-500">
        <p className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
          Payment verification is handled manually by the Super Admin.
        </p>
        <p className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          Access is normally unlocked within 24 hours after verification.
        </p>
        <p className="flex items-center gap-1.5">
          <Phone className="w-3.5 h-3.5 text-slate-400" />
          For payment issues, contact <strong>9470870830</strong>.
        </p>
      </div>
    </div>
  );
}
