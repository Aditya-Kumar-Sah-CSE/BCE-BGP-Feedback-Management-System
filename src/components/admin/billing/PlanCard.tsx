'use client';

import { Check, Crown, Zap, Gift } from 'lucide-react';
import type { BillingPlan } from '@/types/database';

export interface PlanCardProps {
  billingPlan: BillingPlan;
  isSelected?: boolean;
  isDisabled?: boolean;
  onSelect?: () => void;
  isCurrent?: boolean;
}

export function PlanCard({ billingPlan, isSelected, isDisabled, onSelect, isCurrent }: PlanCardProps) {
  // Derive card UI dynamically from DB-driven billingPlan
  const name = billingPlan.name;
  const priceStr = `₹${billingPlan.price.toLocaleString('en-IN')}`;
  const duration = billingPlan.duration_days ?? 0;
  const period = duration > 0 ? `/ ${duration} days` : '';
  const description = billingPlan.description || '';
  const features = billingPlan.features || [];
  const isRecommended = !!billingPlan.is_recommended;

  let Icon = Zap;
  let borderClass = 'border-slate-200 hover:border-slate-300';
  let bgClass = 'bg-white';
  let accentClass = 'text-slate-600';

  if (billingPlan.name.toUpperCase().includes('FREE') || billingPlan.price === 0) {
    Icon = Gift;
    accentClass = 'text-slate-500';
  } else if (billingPlan.billing_interval === 'YEARLY' || duration >= 365) {
    Icon = Crown;
    borderClass = 'border-amber-300 hover:border-amber-500';
    bgClass = 'bg-amber-50/30';
    accentClass = 'text-amber-600';
  } else {
    Icon = Zap;
    borderClass = 'border-blue-200 hover:border-blue-400';
    accentClass = 'text-blue-600';
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={isDisabled}
      className={`
        relative w-full text-left p-5 rounded-xl border-2 transition-all duration-200
        ${bgClass}
        ${isSelected
          ? 'border-bce-cobalt ring-2 ring-bce-cobalt/20 shadow-md scale-[1.02]'
          : borderClass
        }
        ${isDisabled
          ? 'opacity-50 cursor-not-allowed grayscale'
          : 'cursor-pointer hover:shadow-sm'
        }
        ${isCurrent
          ? 'ring-2 ring-emerald-400/40'
          : ''
        }
      `}
    >
      {isRecommended && !isDisabled && (
        <span className="absolute -top-2.5 right-4 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500 text-white shadow-sm">
          Recommended
        </span>
      )}

      {isCurrent && (
        <span className="absolute -top-2.5 left-4 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500 text-white shadow-sm">
          Current Plan
        </span>
      )}

      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-lg ${isSelected ? 'bg-bce-cobalt text-white' : 'bg-slate-100 ' + accentClass} flex items-center justify-center shrink-0`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-slate-900">{priceStr}</span>
            {period && (
              <span className="text-xs text-slate-500">{period}</span>
            )}
          </div>
          <p className="text-sm font-semibold text-slate-700 mt-0.5">{name}</p>
          {description && <p className="text-xs text-slate-500 mt-1">{description}</p>}
          <ul className="mt-3 space-y-1">
            {features.map(feature => (
              <li key={feature} className="flex items-center gap-1.5 text-xs text-slate-600">
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </button>
  );
}
