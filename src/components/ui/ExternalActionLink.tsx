'use client';

import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';

export interface ExternalActionLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  openingText?: string;
  icon?: React.ReactNode;
}

export function ExternalActionLink({
  href,
  children,
  openingText = 'Opening...',
  icon,
  className = '',
  onClick,
  target = '_blank',
  rel = 'noopener noreferrer',
  ...props
}: ExternalActionLinkProps) {
  const [isOpening, setIsOpening] = useState(false);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // If modifier keys or non-left-click, let native browser behavior proceed without local text mutation
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      onClick?.(e);
      return;
    }

    setIsOpening(true);
    setTimeout(() => {
      setIsOpening(false);
    }, 1800);

    onClick?.(e);
  };

  return (
    <a
      href={href}
      target={target}
      rel={rel}
      onClick={handleClick}
      aria-busy={isOpening ? 'true' : undefined}
      className={`inline-flex items-center gap-1.5 transition-colors ${className}`}
      {...props}
    >
      {isOpening ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-current" />
          <span>{openingText}</span>
        </>
      ) : (
        <>
          {icon && <span className="shrink-0">{icon}</span>}
          {children}
        </>
      )}
    </a>
  );
}
