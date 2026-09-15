'use client';

import { Check, Crown, Zap, Gift } from 'lucide-react';

export interface PlanCardProps {
  plan: 'FREE' | 'MONTHLY' | 'YEARLY';
  isSelected?: boolean;
  isDisabled?: boolean;
  onSelect?: () => void;
  isCurrent?: boolean;
}

const PLAN_CONFIG = {
  FREE: {
    name: 'Free',
    price: '₹0',
    period: '',
    description: 'Assigned by Super Admin only.',
    features: ['Google Form generation', 'Google Sheet integration', 'Basic analytics'],
    Icon: Gift,
    borderClass: 'border-slate-200 hover:border-slate-300',
    bgClass: 'bg-white',
    accentClass: 'text-slate-500',
  },
  MONTHLY: {
    name: 'Monthly',
    price: '₹2,999',
    period: '/month',
    description: 'Pay monthly, cancel anytime.',
    features: ['Google Form generation', 'Google Sheet integration', 'Full analytics access', 'Priority support'],
    Icon: Zap,
    borderClass: 'border-blue-200 hover:border-blue-400',
    bgClass: 'bg-white',
    accentClass: 'text-blue-600',
  },
  YEARLY: {
    name: 'Yearly',
    price: '₹29,999',
    period: '/year',
    description: 'Best value — save over ₹5,900/year.',
    features: ['Google Form generation', 'Google Sheet integration', 'Full analytics access', 'Priority support', '2 months free'],
    Icon: Crown,
    borderClass: 'border-amber-300 hover:border-amber-500',
    bgClass: 'bg-amber-50/30',
    accentClass: 'text-amber-600',
  },
} as const;

export function PlanCard({ plan, isSelected, isDisabled, onSelect, isCurrent }: PlanCardProps) {
  const config = PLAN_CONFIG[plan];
  const { Icon } = config;

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={isDisabled}
      className={`
        relative w-full text-left p-5 rounded-xl border-2 transition-all duration-200
        ${config.bgClass}
        ${isSelected
          ? 'border-bce-cobalt ring-2 ring-bce-cobalt/20 shadow-md scale-[1.02]'
          : config.borderClass
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
      {plan === 'YEARLY' && !isDisabled && (
        <span className="absolute -top-2.5 right-4 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500 text-white shadow-sm">
          Best Value
        </span>
      )}

      {isCurrent && (
        <span className="absolute -top-2.5 left-4 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500 text-white shadow-sm">
          Current Plan
        </span>
      )}

      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-lg ${isSelected ? 'bg-bce-cobalt text-white' : 'bg-slate-100 ' + config.accentClass} flex items-center justify-center shrink-0`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-slate-900">{config.price}</span>
            {config.period && (
              <span className="text-xs text-slate-500">{config.period}</span>
            )}
          </div>
          <p className="text-sm font-semibold text-slate-700 mt-0.5">{config.name}</p>
          <p className="text-xs text-slate-500 mt-1">{config.description}</p>
          <ul className="mt-3 space-y-1">
            {config.features.map(feature => (
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
