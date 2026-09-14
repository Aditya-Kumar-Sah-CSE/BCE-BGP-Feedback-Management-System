'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Search, RotateCcw } from 'lucide-react';
import { AcademicYear, Branch, Semester } from '@/types/database';
import { useState, useTransition, useEffect, useCallback } from 'react';

interface Props {
  academicYears: AcademicYear[];
  branches: Branch[];
  semesters: Semester[];
  selectedYear: string;
  selectedBranch: string;
  selectedSemester: string;
  selectedStatus: string;
  initialSearch: string;
}

export function FormsFilterClient({
  academicYears,
  branches,
  semesters,
  selectedYear,
  selectedBranch,
  selectedSemester,
  selectedStatus,
  initialSearch,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(initialSearch);
  const [year, setYear] = useState(selectedYear);
  const [branch, setBranch] = useState(selectedBranch);
  const [semester, setSemester] = useState(selectedSemester);
  const [status, setStatus] = useState(selectedStatus);

  const applyFilters = useCallback(
    (newParams: {
      year?: string;
      branch?: string;
      semester?: string;
      status?: string;
      search?: string;
    }) => {
      const params = new URLSearchParams(searchParams.toString());

      const finalYear = newParams.year !== undefined ? newParams.year : year;
      const finalBranch = newParams.branch !== undefined ? newParams.branch : branch;
      const finalSem = newParams.semester !== undefined ? newParams.semester : semester;
      const finalStatus = newParams.status !== undefined ? newParams.status : status;
      const finalSearch = newParams.search !== undefined ? newParams.search : search;

      if (finalYear && finalYear !== 'ALL') params.set('year', finalYear);
      else params.delete('year');

      if (finalBranch && finalBranch !== 'ALL') params.set('branch', finalBranch);
      else params.delete('branch');

      if (finalSem && finalSem !== 'ALL') params.set('semester', finalSem);
      else params.delete('semester');

      if (finalStatus && finalStatus !== 'ALL') params.set('status', finalStatus);
      else params.delete('status');

      if (finalSearch && finalSearch.trim()) params.set('search', finalSearch.trim());
      else params.delete('search');

      // Reset to page 1 on filter change
      params.delete('page');

      startTransition(() => {
        router.push(`/admin/dashboard/forms?${params.toString()}`);
      });
    },
    [searchParams, year, branch, semester, status, search, router]
  );

  // 300ms debounce for search to prevent database requests on every keystroke
  useEffect(() => {
    if (search === initialSearch) return;
    const timer = setTimeout(() => {
      applyFilters({ search });
    }, 300);
    return () => clearTimeout(timer);
  }, [search, initialSearch, applyFilters]);

  const handleReset = () => {
    setSearch('');
    setYear('ALL');
    setBranch('ALL');
    setSemester('ALL');
    setStatus('ALL');
    startTransition(() => {
      router.push('/admin/dashboard/forms');
    });
  };

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3.5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Search */}
        <div className="relative">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Search
          </label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Faculty, subject, code..."
              className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20"
            />
          </div>
        </div>

        {/* Academic Year */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Session
          </label>
          <select
            value={year}
            onChange={e => {
              setYear(e.target.value);
              applyFilters({ year: e.target.value });
            }}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20"
          >
            <option value="ALL">All Academic Years</option>
            {academicYears.map(y => (
              <option key={y.id} value={y.id}>
                {y.name} {y.is_active ? '(Active)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Branch */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Branch
          </label>
          <select
            value={branch}
            onChange={e => {
              setBranch(e.target.value);
              applyFilters({ branch: e.target.value });
            }}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20"
          >
            <option value="ALL">All Branches</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.code})
              </option>
            ))}
          </select>
        </div>

        {/* Semester */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Semester
          </label>
          <select
            value={semester}
            onChange={e => {
              setSemester(e.target.value);
              applyFilters({ semester: e.target.value });
            }}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20"
          >
            <option value="ALL">All Semesters</option>
            {semesters.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} (Sem {s.semester_number})
              </option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Status
          </label>
          <select
            value={status}
            onChange={e => {
              setStatus(e.target.value);
              applyFilters({ status: e.target.value });
            }}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20"
          >
            <option value="ALL">All Statuses</option>
            <option value="DRAFT">DRAFT</option>
            <option value="PUBLISHED">PUBLISHED</option>
            <option value="CLOSED">CLOSED</option>
            <option value="ARCHIVED">ARCHIVED</option>
          </select>
        </div>
      </div>

      {/* Reset Bar */}
      <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
        <span className="text-slate-400">
          {isPending ? 'Applying filters...' : 'Filter forms by session, branch, semester or lifecycle'}
        </span>
        <button
          onClick={handleReset}
          className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 font-semibold"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Filters</span>
        </button>
      </div>
    </div>
  );
}
