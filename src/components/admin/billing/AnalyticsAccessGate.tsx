'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Lock, ArrowLeft, BarChart3 } from 'lucide-react';
import { getMyBillingStatusAction } from '@/app/admin/billing/actions';
import { PaymentRequestForm } from './PaymentRequestForm';
import { ActivePlanBadge } from './ActivePlanBadge';
import type { BillingStatus } from '@/lib/billing/constants';
import type { PaymentRequest } from '@/types/database';

interface AnalyticsAccessGateProps {
  children?: React.ReactNode;
  isSuperAdmin?: boolean;
  formId?: string;
  returnUrl?: string;
}

export function AnalyticsAccessGate({
  children,
  isSuperAdmin,
  formId,
  returnUrl,
}: AnalyticsAccessGateProps) {
  const [loading, setLoading] = useState(true);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [latestRequest, setLatestRequest] = useState<PaymentRequest | null>(null);
  const [hasFullAnalytics, setHasFullAnalytics] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    getMyBillingStatusAction().then((res) => {
      if (res.success) {
        setBilling(res.billing || null);
        setLatestRequest(res.latestPaymentRequest || null);
        const allowed = !!res.isSuperAdmin || !!res.hasFullAnalytics;
        setHasFullAnalytics(allowed);
      }
      setLoading(false);
    });
  }, [refreshKey]);

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs animate-pulse space-y-4">
        <div className="h-5 w-48 bg-slate-200 rounded-md" />
        <div className="h-4 w-72 bg-slate-100 rounded-md" />
        <div className="h-48 bg-slate-50 rounded-xl" />
      </div>
    );
  }

  // Super Admin or admin with Full Analytics Access: show children if provided
  if (isSuperAdmin || hasFullAnalytics) {
    if (children) {
      return (
        <div>
          {!isSuperAdmin && billing && (
            <div className="mb-4">
              <ActivePlanBadge
                planType={billing.planType}
                expiresAt={billing.expiresAt}
                hasActiveTrial={billing.hasActiveTrial}
                trialExpiresAt={billing.trialExpiresAt}
                trialDaysRemaining={billing.trialDaysRemaining}
              />
            </div>
          )}
          {children}
        </div>
      );
    }
    return null;
  }

  // Back link URL resolution
  const resolvedBackUrl = returnUrl || (formId ? `/admin/dashboard/forms/${formId}` : '/admin/dashboard/forms');
  const backLabel = formId ? 'Back to Form Console' : 'Back to Forms Catalog';

  // Basic Analytics / Locked: Show database-driven Upgrade Your Plan experience
  return (
    <div className="space-y-4">
      {/* Back Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href={resolvedBackUrl}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 transition-colors shadow-2xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{backLabel}</span>
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-bce-navy via-slate-900 to-bce-cobalt p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center shrink-0">
                <Lock className="w-6 h-6 text-amber-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white">Results & Analytics Locked</h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/30">
                    Full Analytics Access Required
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  Full Analytics Access is required to view results, charts, and download reports. Choose a plan to unlock full analytics access.
                </p>
              </div>
            </div>

            {billing && (
              <div className="self-start sm:self-auto shrink-0">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 border border-white/15 text-white text-xs">
                  <BarChart3 className="w-3.5 h-3.5 text-amber-300" />
                  <span>Current: <strong>{billing.planType} Plan (Basic Analytics)</strong></span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Payment & Upgrade Form */}
        <div className="p-6">
          <PaymentRequestForm
            latestRequest={latestRequest}
            onSuccess={() => setRefreshKey((k) => k + 1)}
          />
        </div>
      </div>
    </div>
  );
}
