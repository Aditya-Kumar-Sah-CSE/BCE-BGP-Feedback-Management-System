'use client';

import React, { useState, forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

export interface InteractiveButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
  variant?: 'primary' | 'secondary' | 'amber' | 'danger' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
}

export const InteractiveButton = forwardRef<HTMLButtonElement, InteractiveButtonProps>(
  (
    {
      children,
      onClick,
      loading = false,
      loadingText,
      disabled,
      variant = 'primary',
      size = 'md',
      icon,
      className = '',
      type = 'button',
      ...props
    },
    ref
  ) => {
    const [clickWave, setClickWave] = useState(false);

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      setClickWave(true);
      setTimeout(() => setClickWave(false), 500);
      if (onClick) onClick(e);
    };

    const variantStyles = {
      primary:
        'bg-bce-cobalt hover:bg-bce-navy text-white shadow-sm hover:shadow-md border border-transparent',
      secondary:
        'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200',
      amber:
        'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-sm hover:shadow-amber-500/25',
      danger:
        'bg-rose-600 hover:bg-rose-700 text-white shadow-sm hover:shadow-rose-600/25',
      outline:
        'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 hover:border-slate-400',
      ghost:
        'bg-transparent hover:bg-slate-100 text-slate-600 hover:text-slate-900',
    };

    const sizeStyles = {
      sm: 'py-1.5 px-3 text-xs rounded-lg gap-1.5',
      md: 'py-2.5 px-4 text-xs font-bold rounded-xl gap-2',
      lg: 'py-3 px-5 text-sm font-bold rounded-2xl gap-2.5',
    };

    const isBusy = loading;

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isBusy}
        onClick={handleClick}
        className={`
          relative inline-flex items-center justify-center font-bold transition-all duration-200 select-none
          active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none disabled:active:scale-100
          ${sizeStyles[size]}
          ${variantStyles[variant]}
          ${isBusy ? 'btn-request-active' : ''}
          ${clickWave ? 'btn-press-wave' : ''}
          ${className}
        `}
        {...props}
      >
        {/* Animated aura ring on request */}
        {isBusy && (
          <span
            className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-bce-cobalt/30 via-amber-500/30 to-bce-cobalt/30 animate-pulse blur-xs -z-10 pointer-events-none"
            aria-hidden="true"
          />
        )}

        {isBusy ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
            <span>{loadingText || children}</span>
          </>
        ) : (
          <>
            {icon && <span className="shrink-0">{icon}</span>}
            <span>{children}</span>
          </>
        )}
      </button>
    );
  }
);

InteractiveButton.displayName = 'InteractiveButton';
