'use client';

import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { getMyBillingStatusAction } from '@/app/admin/billing/actions';
import { PaymentRequestForm } from './PaymentRequestForm';
import { ActivePlanBadge } from './ActivePlanBadge';
import { planHasFeature, FEATURE_GOOGLE_FORM_GENERATION, type BillingStatus } from '@/lib/billing/constants';
import type { PaymentRequest } from '@/types/database';

interface FormAccessGateProps {
  children: React.ReactNode;
  isSuperAdmin?: boolean;
}

export function FormAccessGate({ children, isSuperAdmin }: FormAccessGateProps) {
  const [loading, setLoading] = useState(true);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [latestRequest, setLatestRequest] = useState<PaymentRequest | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    getMyBillingStatusAction().then(res => {
      if (res.success) {
        setBilling(res.billing || null);
        setLatestRequest(res.latestPaymentRequest || null);

        // Super Admin always sees children
        if (res.isSuperAdmin) {
          setBilling({ ...res.billing!, isUnlocked: true } as BillingStatus);
        }
      }
      setLoading(false);
    });
  }, [refreshKey]);

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs animate-pulse space-y-4">
        <div className="h-5 w-40 bg-slate-200 rounded-md" />
        <div className="h-4 w-64 bg-slate-100 rounded-md" />
        <div className="h-48 bg-slate-50 rounded-xl" />
      </div>
    );
  }

  // Super Admin or admin whose effective features include Google Form generation (via trial or paid plan)
  const hasFormGen = isSuperAdmin || (billing?.features && planHasFeature(billing.features, FEATURE_GOOGLE_FORM_GENERATION));

  if (isSuperAdmin || hasFormGen) {
    return (
      <div>
        {/* Small plan badge for unlocked admins */}
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

  // Admin without Google Form generation entitlement: show upgrade / payment form
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-bce-navy to-bce-cobalt p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
            <Lock className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Form Generation Locked</h2>
            <p className="text-xs text-slate-300">
              Google Form generation is not included in the FREE base plan. Request a Free Trial from the Super Admin or upgrade to a subscription plan below.
            </p>
          </div>
        </div>
      </div>

      {/* Payment Form */}
      <div className="p-6">
        <PaymentRequestForm
          latestRequest={latestRequest}
          onSuccess={() => setRefreshKey(k => k + 1)}
        />
      </div>
    </div>
  );
}
