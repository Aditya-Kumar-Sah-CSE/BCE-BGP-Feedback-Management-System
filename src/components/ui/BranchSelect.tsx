'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Branch } from '@/types/database';
import { getActiveBranchesAction } from '@/app/feedback/actions';

export interface BranchSelectProps {
  /** The currently selected value */
  value: string;
  /** Callback fired when the selection changes */
  onChange: (value: string, branch?: Branch) => void;
  /** Optional pre-loaded branches. If omitted, will be fetched dynamically via getActiveBranchesAction */
  branches?: Branch[];
  /** Whether to automatically fetch active branches if none are passed (default: true) */
  autoFetch?: boolean;
  /** Key to use for option value (default: 'id') */
  valueKey?: 'id' | 'name' | 'code';
  /** Placeholder text when nothing is selected (default: "Select Branch / Discipline") */
  placeholder?: string;
  /** Include an "All Branches" option for filter dropdowns */
  includeAllOption?: boolean;
  /** Label for the "All Branches" option (default: "All Branches") */
  allOptionLabel?: string;
  /** Value for the "All Branches" option (default: "ALL") */
  allOptionValue?: string;
  /** Additional CSS class names */
  className?: string;
  /** HTML disabled attribute */
  disabled?: boolean;
  /** HTML required attribute */
  required?: boolean;
  /** HTML id attribute */
  id?: string;
  /** HTML name attribute */
  name?: string;
  /** Accessible label */
  'aria-label'?: string;
}

/**
 * Reusable, dynamic Branch / Discipline dropdown component.
 * - Enforces dynamic database loading
 * - Shows ONLY active branches (is_active === true)
 * - Sorts consistently in alphabetical order
 * - Handles loading, empty, and error states
 * - Zero hardcoding of branch records
 */
export function BranchSelect({
  value,
  onChange,
  branches: preloadedBranches,
  autoFetch = true,
  valueKey = 'id',
  placeholder = 'Select Branch / Discipline',
  includeAllOption = false,
  allOptionLabel = 'All Branches',
  allOptionValue = 'ALL',
  className = '',
  disabled = false,
  required = false,
  id,
  name,
  'aria-label': ariaLabel = 'Branch / Discipline',
}: BranchSelectProps) {
  const [fetchedBranches, setFetchedBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(!preloadedBranches && autoFetch);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Lazy dynamic fetch if branches were not provided as props
  useEffect(() => {
    if (!preloadedBranches && autoFetch) {
      let isMounted = true;
      setIsLoading(true);
      setFetchError(null);

      getActiveBranchesAction()
        .then((res) => {
          if (!isMounted) return;
          if (res.success && res.branches) {
            setFetchedBranches(res.branches);
          } else {
            setFetchError(res.error || 'Failed to load branches.');
          }
        })
        .catch((err) => {
          if (!isMounted) return;
          setFetchError(err?.message || 'Error fetching branches.');
        })
        .finally(() => {
          if (isMounted) setIsLoading(false);
        });

      return () => {
        isMounted = false;
      };
    }
  }, [preloadedBranches, autoFetch]);

  // Combine either preloaded or dynamically fetched branches
  const rawBranches = preloadedBranches || fetchedBranches;

  // Filter ONLY active branches and sort alphabetically by name
  const activeBranches = useMemo(() => {
    return (rawBranches || [])
      .filter((b) => b.is_active)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rawBranches]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedVal = e.target.value;
    const branch = activeBranches.find((b) => b[valueKey] === selectedVal);
    onChange(selectedVal, branch);
  };

  const defaultClasses =
    'w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-base sm:text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20 min-h-[42px] sm:min-h-[36px] transition-all disabled:opacity-60 disabled:cursor-not-allowed';

  return (
    <select
      id={id}
      name={name}
      value={value}
      onChange={handleChange}
      disabled={disabled || isLoading}
      required={required}
      aria-label={ariaLabel}
      className={`${defaultClasses} ${className}`}
    >
      {/* 1. All Branches option (for filters) */}
      {includeAllOption && (
        <option value={allOptionValue}>{allOptionLabel}</option>
      )}

      {/* 2. Placeholder option (when not a filter, or when no selection is made) */}
      {!includeAllOption && (
        <option value="" disabled={required}>
          {placeholder}
        </option>
      )}

      {/* 3. Loading State */}
      {isLoading && (
        <option value="" disabled>
          Loading branches...
        </option>
      )}

      {/* 4. Error State */}
      {!isLoading && fetchError && (
        <option value="" disabled>
          Failed to load branches
        </option>
      )}

      {/* 5. Empty State */}
      {!isLoading && !fetchError && activeBranches.length === 0 && (
        <option value="" disabled>
          No active branches available
        </option>
      )}

      {/* 6. Active Branches */}
      {!isLoading &&
        activeBranches.map((b) => (
          <option key={b.id} value={b[valueKey]}>
            {b.name} ({b.code})
          </option>
        ))}
    </select>
  );
}
