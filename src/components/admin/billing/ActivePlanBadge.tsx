'use client';

import { BadgeCheck, Crown, Zap } from 'lucide-react';
import type { PlanType } from '@/types/database';
import { useHydrated, daysRemainingSafe } from '@/lib/hooks/use-hydrated';

interface ActivePlanBadgeProps {
  planType: PlanType;
  expiresAt?: string | null;
}

export function ActivePlanBadge({ planType, expiresAt }: ActivePlanBadgeProps) {
  const hydrated = useHydrated();

  const badgeConfig: Record<PlanType, { label: string; className: string; Icon: typeof BadgeCheck }> = {
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
