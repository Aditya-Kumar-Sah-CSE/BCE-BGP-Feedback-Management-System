'use client';

import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

export interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  loadingText?: string;
  icon?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'navy' | 'amber' | 'danger' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const LoadingButton = forwardRef<HTMLButtonElement, LoadingButtonProps>(
  (
    {
      children,
      isLoading = false,
      loadingText,
      icon,
      disabled,
      variant = 'primary',
      size = 'md',
      className = '',
      type = 'button',
      onClick,
      ...props
    },
    ref
  ) => {
    const variantStyles = {
      primary:
        'bg-bce-cobalt hover:bg-bce-navy text-white shadow-xs hover:shadow-sm border border-transparent',
      navy:
        'bg-bce-navy hover:bg-slate-800 text-white shadow-xs hover:shadow-sm border border-transparent',
      secondary:
        'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200',
      amber:
        'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-xs hover:shadow-amber-500/20',
      danger:
        'bg-rose-600 hover:bg-rose-700 text-white shadow-xs hover:shadow-rose-600/20',
      outline:
        'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 hover:border-slate-400',
      ghost:
        'bg-transparent hover:bg-slate-100 text-slate-600 hover:text-slate-900',
    };

    const sizeStyles = {
      sm: 'py-1.5 px-3 text-xs rounded-xl gap-1.5 min-h-[34px]',
      md: 'py-2 px-3.5 text-xs font-bold rounded-xl gap-2 min-h-[38px]',
      lg: 'py-2.5 px-5 text-sm font-bold rounded-2xl gap-2.5 min-h-[44px]',
    };

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (isLoading || disabled) {
        e.preventDefault();
        return;
      }
      onClick?.(e);
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        aria-busy={isLoading ? 'true' : undefined}
        onClick={handleClick}
        className={`
          relative inline-flex items-center justify-center font-bold select-none transition-all duration-150
          active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100
          ${sizeStyles[size]}
          ${variantStyles[variant]}
          ${className}
        `}
        {...props}
      >
        {isLoading ? (
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

LoadingButton.displayName = 'LoadingButton';
