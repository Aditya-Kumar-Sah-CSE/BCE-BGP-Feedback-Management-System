/**
 * Global Navigation Events
 * Clean event dispatcher for navigation start and end across Next.js App Router.
 * Does NOT monkey-patch Next.js router or browser history.
 */

export const NAV_START_EVENT = 'bce:navigation-start';
export const NAV_END_EVENT = 'bce:navigation-end';

export interface NavigationStartDetail {
  url?: string;
  source?: 'link' | 'programmatic' | 'popstate';
}

export function triggerNavigationStart(detail?: NavigationStartDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<NavigationStartDetail>(NAV_START_EVENT, { detail })
  );
}

export function triggerNavigationEnd(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(NAV_END_EVENT));
}
