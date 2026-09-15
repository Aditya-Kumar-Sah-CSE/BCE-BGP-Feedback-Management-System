'use client';

import { useState, useEffect } from 'react';

/**
 * Returns `true` only after hydration is complete.
 *
 * During SSR and the initial client render (hydration) it returns `false`,
 * ensuring date/locale-dependent text is NOT rendered in JSX that React
 * needs to match between server and client.
 *
 * Usage:
 *   const mounted = useHydrated();
 *   <span>{mounted ? new Date(ts).toLocaleString('en-IN', opts) : ts.slice(0, 10)}</span>
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { setHydrated(true); }, []);
  return hydrated;
}

// ────────────────────────────────────────────────────────────────
// Safe formatting helpers — return deterministic strings on server
// and locale-aware strings on client.
// ────────────────────────────────────────────────────────────────

type DateInput = string | number | Date;

/**
 * Format a date safely for SSR + hydration.
 *
 * @param value      - ISO string, timestamp, or Date
 * @param hydrated   - from useHydrated()
 * @param options    - Intl.DateTimeFormat options (only used client-side)
 * @param locale     - locale string (default: 'en-IN')
 * @returns a deterministic string during SSR, and a locale-formatted string after hydration
 */
export function formatDateSafe(
  value: DateInput | null | undefined,
  hydrated: boolean,
  options?: Intl.DateTimeFormatOptions,
  locale: string = 'en-IN',
): string {
  if (!value) return '—';

  if (!hydrated) {
    // Return an ISO-style substring that is identical on server and client
    const iso = typeof value === 'string' ? value : new Date(value).toISOString();
    // Default: "2026-09-15"  (first 10 chars of ISO)
    return iso.slice(0, 10);
  }

  return new Date(value).toLocaleString(locale, options);
}

/**
 * Format a date as a short date string (e.g. "15 Sep 2026").
 */
export function formatDateShort(value: DateInput | null | undefined, hydrated: boolean): string {
  return formatDateSafe(value, hydrated, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format a date as time only (e.g. "11:30 PM").
 */
export function formatTime(value: DateInput | null | undefined, hydrated: boolean): string {
  return formatDateSafe(value, hydrated, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format a date as short date + time (e.g. "15 Sep 2026, 11:30 PM").
 */
export function formatDateTimeFull(value: DateInput | null | undefined, hydrated: boolean): string {
  return formatDateSafe(value, hydrated, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Calculate days remaining from now to expiresAt.
 * Returns null during SSR to avoid hydration mismatch.
 */
export function daysRemainingSafe(expiresAt: string | null | undefined, hydrated: boolean): number | null {
  if (!expiresAt || !hydrated) return null;
  const exp = new Date(expiresAt).getTime();
  return Math.max(0, Math.ceil((exp - Date.now()) / (1000 * 60 * 60 * 24)));
}
