'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  CreditCard,
  Sparkles,
  Calendar,
  CheckCircle2,
  Lock,
  Clock,
  Zap,
  RefreshCw,
} from 'lucide-react';
import { getMyBillingStatusAction } from '@/app/admin/billing/actions';
import { PaymentRequestForm } from '@/components/admin/billing/PaymentRequestForm';
import type { BillingStatus } from '@/lib/billing/constants';
import type { PaymentRequest } from '@/types/database';

export function AdminMyBillingTab() {
  const [loading, setLoading] = useState(true);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [latestRequest, setLatestRequest] = useState<PaymentRequest | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const res = await getMyBillingStatusAction();
    if (res.success && res.billing) {
      setBilling(res.billing as BillingStatus);
      setLatestRequest(res.latestPaymentRequest || null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4 animate-pulse">
        <div className="h-6 w-48 bg-slate-200 rounded-md" />
        <div className="h-40 bg-slate-50 rounded-xl" />
      </div>
    );
  }

  const hasActiveTrial = billing?.hasActiveTrial && billing.activeTrial;
  const isTrialExpired = !hasActiveTrial && billing?.trialStatus === 'EXPIRED';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-bce-cobalt" />
            My Billing & Subscription
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            View your current entitlement, trial status, and available subscription plans.
          </p>
        </div>
        <button
          onClick={loadData}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* 1. ACTIVE TRIAL HERO BANNER */}
      {hasActiveTrial && (
        <div className="relative overflow-hidden rounded-2xl border border-emerald-300 bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 p-6 shadow-sm">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-600 text-white shadow-xs">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  Trial Active
                </span>
                <span className="text-xs font-extrabold text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-full">
                  {billing.trialDaysRemaining ?? 0} days remaining
                </span>
              </div>
              <h3 className="text-base font-extrabold text-emerald-950">
                Super Admin Granted Free Trial Access
              </h3>
              <p className="text-xs text-emerald-800/90 leading-relaxed max-w-xl">
                You have temporary full access to granted features. When this trial expires, your account will smoothly fall back to the permanent FREE base plan.
              </p>
              <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-emerald-900 pt-1">
                <Calendar className="w-4 h-4 text-emerald-700" />
                <span>
                  Valid Until:{' '}
                  {billing.trialExpiresAt
                    ? new Date(billing.trialExpiresAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : 'Active'}
                </span>
              </div>
            </div>

            {/* Trial Features Checklist */}
            <div className="bg-white/80 backdrop-blur-xs rounded-xl p-4 border border-emerald-200 space-y-2 shrink-0 md:min-w-[260px]">
              <span className="text-[10px] uppercase tracking-wider font-extrabold text-emerald-900 block">
                Trial Unlocked Features
              </span>
              <ul className="space-y-1.5 text-xs text-slate-800">
                {billing.activeTrial?.features?.map((f, idx) => (
                  <li key={idx} className="flex items-center gap-2 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* 2. TRIAL EXPIRED CALLOUT */}
      {isTrialExpired && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 space-y-2 text-amber-900">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-600" />
            <h3 className="text-sm font-bold">Trial Expired</h3>
          </div>
          <p className="text-xs text-amber-800 leading-relaxed">
            Your free trial has ended. Your account has automatically reverted to the permanent <strong>FREE base plan</strong> (Basic Analytics). To unlock Google Form generation and Full Analytics access again, please select a subscription plan below.
          </p>
        </div>
      )}

      {/* 3. CURRENT PLAN SUMMARY CARD */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Current Base Plan
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <h3 className="text-lg font-bold text-slate-900">{billing?.planType} Plan</h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                {billing?.accessStatus}
              </span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Validity
            </span>
            <p className="text-xs font-semibold text-slate-800 mt-0.5">
              {billing?.expiresAt
                ? new Date(billing.expiresAt).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })
                : 'Permanent Base Access'}
            </p>
          </div>
        </div>

        {/* Effective Features List */}
        <div>
          <span className="text-xs font-bold text-slate-700 block mb-2">
            Your Effective Entitlements:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center gap-2 text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Basic Analytics (View authorized sheets)</span>
            </div>
            <div className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs ${
              billing?.features?.includes('Google Form generation')
                ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900 font-semibold'
                : 'border-slate-200 bg-slate-50 text-slate-400'
            }`}>
              {billing?.features?.includes('Google Form generation') ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <Lock className="w-4 h-4 text-slate-400 shrink-0" />
              )}
              <span>Google Form generation</span>
            </div>
            <div className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs ${
              billing?.hasFullAnalytics
                ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900 font-semibold'
                : 'border-slate-200 bg-slate-50 text-slate-400'
            }`}>
              {billing?.hasFullAnalytics ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <Lock className="w-4 h-4 text-slate-400 shrink-0" />
              )}
              <span>Full Analytics Access</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. UPGRADE / PAID PLAN REQUEST SECTION */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Zap className="w-5 h-5 text-bce-cobalt" />
            Upgrade Subscription Plan
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Choose a paid plan to unlock Google Form generation and Full Analytics Access.
          </p>
        </div>

        <PaymentRequestForm
          latestRequest={latestRequest}
          onSuccess={loadData}
        />
      </div>
    </div>
  );
}
