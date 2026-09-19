'use client';

import React, { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { NAV_START_EVENT, NAV_END_EVENT } from '@/lib/navigation/navigation-events';

function NavigationProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [progress, setProgress] = useState<number>(0);
  const [isVisible, setIsVisible] = useState<boolean>(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const safetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isNavigatingRef = useRef<boolean>(false);
  const currentRouteRef = useRef<string>('');

  // Clear running timers safely
  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (safetyTimeoutRef.current) {
      clearTimeout(safetyTimeoutRef.current);
      safetyTimeoutRef.current = null;
    }
  }, []);

  // Complete progress bar smoothly
  const completeProgress = useCallback(() => {
    clearTimers();
    if (!isNavigatingRef.current && progress === 0) return;

    isNavigatingRef.current = false;
    setProgress(100);

    // Fade out after completion
    setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => {
        setProgress(0);
      }, 300);
    }, 200);
  }, [clearTimers, progress]);

  // Start progress indicator
  const startProgress = useCallback(() => {
    clearTimers();
    isNavigatingRef.current = true;
    setIsVisible(true);
    setProgress(18);

    // Trickle progress up to 85%
    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 85) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 85;
        }
        // Adaptive step: larger initially, smaller as it approaches 85%
        const diff = 85 - prev;
        const step = Math.max(1, Math.floor(diff * 0.15));
        return Math.min(85, prev + step);
      });
    }, 180);

    // 10-second safety timeout so the bar never gets stuck if navigation aborts
    safetyTimeoutRef.current = setTimeout(() => {
      completeProgress();
    }, 10000);
  }, [clearTimers, completeProgress]);

  // Track route changes to finalize progress
  useEffect(() => {
    const routeKey = `${pathname}?${searchParams?.toString() || ''}`;

    // On initial mount, store current route
    if (!currentRouteRef.current) {
      currentRouteRef.current = routeKey;
      return;
    }

    // When route key changes, complete navigation
    if (currentRouteRef.current !== routeKey) {
      currentRouteRef.current = routeKey;
      if (isNavigatingRef.current) {
        completeProgress();
      }
    }
  }, [pathname, searchParams, completeProgress]);

  // Setup click interceptor & custom event listeners
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Passive click handler on links
    const handleDocumentClick = (e: MouseEvent) => {
      // Only handle left clicks
      if (e.button !== 0) return;

      // Ignore modifier keys (Cmd, Ctrl, Shift, Alt) so browser opens tab/window normally
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      // Ignore if event was already cancelled
      if (e.defaultPrevented) return;

      const anchor = (e.target as Element)?.closest('a');
      if (!anchor) return;

      // Ignore links with target="_blank", target="_parent", etc.
      const target = anchor.getAttribute('target');
      if (target && target !== '_self') return;

      // Ignore download links
      if (anchor.hasAttribute('download')) return;

      // Ignore external rel
      const rel = anchor.getAttribute('rel');
      if (rel && rel.includes('external')) return;

      // Ignore disabled or aria-disabled anchors
      if (
        anchor.getAttribute('aria-disabled') === 'true' ||
        anchor.classList.contains('pointer-events-none') ||
        anchor.classList.contains('disabled')
      ) {
        return;
      }

      const href = anchor.getAttribute('href');
      if (!href) return;

      // Ignore non-navigation protocols and pure anchor hashes
      if (
        href.startsWith('javascript:') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        href.startsWith('#')
      ) {
        return;
      }

      try {
        const dest = new URL(anchor.href, window.location.href);

        // Ignore external domains
        if (dest.origin !== window.location.origin) return;

        // Ignore same page clicks (same pathname, search, and hash)
        if (
          dest.pathname === window.location.pathname &&
          dest.search === window.location.search &&
          (!dest.hash || dest.hash === window.location.hash)
        ) {
          return;
        }

        // Trigger internal navigation start immediately
        startProgress();
      } catch {
        // Invalid URL format, ignore
      }
    };

    // 2. Browser back/forward (popstate)
    const handlePopState = () => {
      startProgress();
    };

    // 3. Custom events for programmatic navigation
    const handleNavStart = () => {
      startProgress();
    };

    const handleNavEnd = () => {
      completeProgress();
    };

    document.addEventListener('click', handleDocumentClick, { capture: true });
    window.addEventListener('popstate', handlePopState);
    window.addEventListener(NAV_START_EVENT, handleNavStart);
    window.addEventListener(NAV_END_EVENT, handleNavEnd);

    return () => {
      document.removeEventListener('click', handleDocumentClick, { capture: true });
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener(NAV_START_EVENT, handleNavStart);
      window.removeEventListener(NAV_END_EVENT, handleNavEnd);
      clearTimers();
    };
  }, [startProgress, completeProgress, clearTimers]);

  if (!isVisible && progress === 0) return null;

  return (
    <div
      role="progressbar"
      aria-label="Page navigation progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progress}
      className="fixed top-0 left-0 right-0 z-[99999] pointer-events-none"
      style={{
        opacity: isVisible ? 1 : 0,
        transition: 'opacity 250ms ease-out',
      }}
    >
      <div
        className="h-[2.5px] bg-gradient-to-r from-amber-400 via-bce-cobalt to-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5),0_0_5px_rgba(30,62,98,0.5)]"
        style={{
          width: `${progress}%`,
          transition: progress === 100 ? 'width 150ms ease-out' : 'width 250ms cubic-bezier(0.1, 0.8, 0.3, 1)',
        }}
      />
    </div>
  );
}

export function GlobalNavigationProgress() {
  return (
    <Suspense fallback={null}>
      <NavigationProgressBar />
    </Suspense>
  );
}
