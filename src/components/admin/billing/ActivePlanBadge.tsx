'use client';

import { BadgeCheck, Crown, Zap, Sparkles } from 'lucide-react';
import type { PlanType } from '@/types/database';
import { useHydrated, daysRemainingSafe } from '@/lib/hooks/use-hydrated';

interface ActivePlanBadgeProps {
  planType: PlanType;
  expiresAt?: string | null;
  hasActiveTrial?: boolean;
  trialExpiresAt?: string | null;
  trialDaysRemaining?: number | null;
}

export function ActivePlanBadge({
  planType,
  expiresAt,
  hasActiveTrial,
  trialExpiresAt,
  trialDaysRemaining,
}: ActivePlanBadgeProps) {
  const hydrated = useHydrated();

  // If user has an active trial, display the Trial Active badge
  if (hasActiveTrial) {
    const daysLeft = trialDaysRemaining !== undefined && trialDaysRemaining !== null
      ? trialDaysRemaining
      : daysRemainingSafe(trialExpiresAt, hydrated);

    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border bg-teal-50 text-teal-900 border-teal-300 shadow-2xs">
        <Sparkles className="w-3.5 h-3.5 text-teal-600" />
        <span>Trial Active</span>
        {daysLeft !== null && (
          <span className="text-[10px] font-extrabold text-teal-700 bg-teal-100 px-1.5 py-0.2 rounded-full">
            {daysLeft}d left
          </span>
        )}
      </div>
    );
  }

  const badgeConfig: Record<string, { label: string; className: string; Icon: typeof BadgeCheck }> = {
    FREE: {
      label: 'Free Plan',
      className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      Icon: BadgeCheck,
    },
    MONTHLY: {
      label: 'Monthly Plan',
      className: 'bg-blue-50 text-blue-700 border-blue-200',
      Icon: Zap,
    },
    HALF_YEARLY: {
      label: 'Half-Yearly Plan',
      className: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      Icon: Crown,
    },
    YEARLY: {
      label: 'Yearly Plan',
      className: 'bg-amber-50 text-amber-700 border-amber-200',
      Icon: Crown,
    },
  };

  const config = badgeConfig[planType] || badgeConfig.FREE;
  const { label, className, Icon } = config;

  const daysRemaining = daysRemainingSafe(expiresAt, hydrated);

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${className}`}>
      <Icon className="w-3 h-3" />
      <span>{label}</span>
      {daysRemaining !== null && planType !== 'FREE' && (
        <span className="text-[10px] opacity-75">({daysRemaining}d left)</span>
      )}
    </div>
  );
}
