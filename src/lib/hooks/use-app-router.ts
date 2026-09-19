'use client';

import { useRouter as useNextRouter } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { triggerNavigationStart } from '@/lib/navigation/navigation-events';

/**
 * useAppRouter
 * Next.js App Router wrapper that dispatches navigation start feedback
 * for programmatic routing without monkey-patching any Next.js internals.
 */
export function useAppRouter() {
  const router = useNextRouter();

  const push = useCallback(
    (href: string, options?: Parameters<typeof router.push>[1]) => {
      triggerNavigationStart({ url: href, source: 'programmatic' });
      return router.push(href, options);
    },
    [router]
  );

  const replace = useCallback(
    (href: string, options?: Parameters<typeof router.replace>[1]) => {
      triggerNavigationStart({ url: href, source: 'programmatic' });
      return router.replace(href, options);
    },
    [router]
  );

  return useMemo(
    () => ({
      ...router,
      push,
      replace,
    }),
    [router, push, replace]
  );
}
