'use client';

import { useState, useTransition, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { toggleFeedbackFormStatusAction, deleteFeedbackFormAction } from '@/app/admin/actions';
import {
  FileSpreadsheet,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Eye,
  FileCode2,
  ArrowRight,
  Sparkles,
  Search,
  Trash2,
  Loader2,
} from 'lucide-react';
import type {
  FeedbackForm,
  AcademicYear,
  Branch,
  Semester,
  Faculty,
  Subject,
} from '@/types/database';
import { PaginationControl } from '@/components/ui/PaginationControl';
import { ExternalActionLink } from '@/components/ui/ExternalActionLink';

interface Props {
  feedbackForms: FeedbackForm[];
  academicYears: AcademicYear[];
  branches: Branch[];
  semesters: Semester[];
  faculties: Faculty[];
  subjects: Subject[];
}

export function FeedbackFormsTab({
  feedbackForms,
  branches,
  semesters,
  faculties,
  subjects,
}: Props) {
  const [formsList, setFormsList] = useState<FeedbackForm[]>(feedbackForms);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [navigatingFormId, setNavigatingFormId] = useState<string | null>(null);
  const [isNavigatingCreate, setIsNavigatingCreate] = useState(false);
  const [isNavigatingCatalog, setIsNavigatingCatalog] = useState(false);

  // Search, filter, and pagination states
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PUBLISHED' | 'DRAFT' | 'CLOSED'>('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Sync if parent prop updates
  useEffect(() => {
    setFormsList(feedbackForms);
  }, [feedbackForms]);

  // 300ms debounce on search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fast in-place optimistic status toggle
  const handleToggleStatus = (form: FeedbackForm) => {
    const nextStatus = form.status === 'PUBLISHED' ? 'CLOSED' : 'PUBLISHED';
    setMessage(null);
    setTogglingId(form.id);

    // Optimistic UI update
    setFormsList((prev) =>
      prev.map((f) => (f.id === form.id ? { ...f, status: nextStatus } : f))
    );

    startTransition(async () => {
      try {
        const res = await toggleFeedbackFormStatusAction(form.id, nextStatus);
        if (res.success) {
          setMessage({ type: 'success', text: `Form status updated to ${nextStatus}.` });
        } else {
          // Rollback
          setFormsList((prev) =>
            prev.map((f) => (f.id === form.id ? { ...f, status: form.status } : f))
          );
          setMessage({ type: 'error', text: res.error || 'Failed to update status.' });
        }
      } finally {
        setTogglingId(null);
      }
    });
  };

  // Safe delete feedback form
  const handleDeleteForm = (form: FeedbackForm) => {
    const isConfirmed = window.confirm(
      `Are you sure you want to delete this feedback form?\n\n"${form.title}"\n\nThis will remove it permanently from the system. (Google Drive files will remain intact).`
    );
    if (!isConfirmed) return;

    setMessage(null);
    setDeletingId(form.id);

    const previousForms = [...formsList];
    // Optimistic UI update
    setFormsList((prev) => prev.filter((f) => f.id !== form.id));

    startTransition(async () => {
      try {
        const res = await deleteFeedbackFormAction(form.id);
        if (res.success) {
          setMessage({ type: 'success', text: `Form "${form.title}" deleted successfully.` });
        } else {
          // Rollback on failure
          setFormsList(previousForms);
          setMessage({ type: 'error', text: res.error || 'Failed to delete feedback form.' });
        }
      } finally {
        setDeletingId(null);
      }
    });
  };

  // Filtered forms list
  const filteredForms = useMemo(() => {
    return formsList.filter((f) => {
      const matchStatus = statusFilter === 'ALL' || f.status === statusFilter;
      if (!matchStatus) return false;

      if (!debouncedSearch.trim()) return true;
      const q = debouncedSearch.toLowerCase().trim();
      return (
        f.title?.toLowerCase().includes(q) ||
        f.faculty?.name?.toLowerCase().includes(q) ||
        f.subject?.name?.toLowerCase().includes(q) ||
        f.subject?.code?.toLowerCase().includes(q)
      );
    });
  }, [formsList, statusFilter, debouncedSearch]);

  const totalItems = filteredForms.length;
  const totalPages = Math.ceil(totalItems / pageSize);

  const paginatedForms = useMemo(() => {
    const from = (page - 1) * pageSize;
    return filteredForms.slice(from, from + pageSize);
  }, [filteredForms, page, pageSize]);

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-bce-cobalt" />
              Google Feedback Forms Management
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-bce-cobalt uppercase">
              Phase 2
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Create standard 8-parameter BCE Google Feedback Forms, manage connected response Sheets, and control publishing.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/dashboard/forms"
            onClick={() => setIsNavigatingCatalog(true)}
            className="group inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200/80 hover:border-slate-300 transition-all duration-200 hover:-translate-y-0.5 active:scale-95 active:translate-y-0 shadow-2xs hover:shadow-xs cursor-pointer select-none"
          >
            {isNavigatingCatalog && <Loader2 className="w-3.5 h-3.5 text-slate-600 animate-spin shrink-0" />}
            <span>{isNavigatingCatalog ? 'Opening Catalog...' : 'Forms Catalog'}</span>
            {!isNavigatingCatalog && <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:translate-x-0.5 transition-transform" />}
          </Link>
          <Link
            href="/admin/dashboard/forms/create"
            onClick={() => setIsNavigatingCreate(true)}
            className="group relative inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-bce-cobalt to-bce-navy hover:from-bce-navy hover:to-slate-900 text-white text-xs font-bold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg hover:-translate-y-0.5 active:scale-95 active:translate-y-0 cursor-pointer select-none overflow-hidden"
          >
            <span className="absolute inset-0 w-full h-full bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            {isNavigatingCreate ? (
              <Loader2 className="w-4 h-4 text-amber-300 animate-spin shrink-0" />
            ) : (
              <Sparkles className="w-4 h-4 text-amber-300 group-hover:rotate-12 transition-transform duration-300 shrink-0" />
            )}
            <span>{isNavigatingCreate ? 'Opening Form Wizard...' : 'Generate Google Form'}</span>
          </Link>
        </div>
      </div>

      {message && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{message.text}</span>
        </div>
      )}

      {/* Forms List Table with Filter Header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/40">
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              Configured Feedback Forms ({totalItems})
            </h4>
            <span className="text-xs text-slate-400">
              {formsList.filter((f) => f.status === 'PUBLISHED').length} Published Total
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-60">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search forms..."
                className="w-full pl-8 pr-3 py-2 sm:py-1.5 min-h-[40px] bg-white border border-slate-200 rounded-lg text-base sm:text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-bce-cobalt"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any);
                setPage(1);
              }}
              className="px-3 py-2 sm:py-1.5 min-h-[40px] bg-white border border-slate-200 rounded-lg text-base sm:text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-bce-cobalt"
            >
              <option value="ALL">All Status</option>
              <option value="PUBLISHED">Published</option>
              <option value="DRAFT">Draft</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>
        </div>

        {formsList.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-800">No Feedback Forms Created Yet</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Click &quot;Generate Google Form&quot; above to launch the 6-step creation wizard for an assigned faculty and subject.
            </p>
            <Link
              href="/admin/dashboard/forms/create"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-bce-cobalt text-white text-xs font-bold rounded-xl hover:bg-bce-navy transition-colors"
            >
              <Plus className="w-4 h-4" />
              Generate First Google Form
            </Link>
          </div>
        ) : paginatedForms.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No feedback forms match your search or filter criteria.
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-100 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3">Form Title</th>
                    <th className="px-5 py-3">Faculty & Subject</th>
                    <th className="px-5 py-3">Branch & Sem</th>
                    <th className="px-5 py-3">Response Mode</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Google Links</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedForms.map((form) => {
                    const faculty = faculties.find((f) => f.id === form.faculty_id) || form.faculty;
                    const subject = subjects.find((s) => s.id === form.subject_id) || form.subject;
                    const branch = branches.find((b) => b.id === form.branch_id) || form.branch;
                    const semester = semesters.find((s) => s.id === form.semester_id) || form.semester;
                    const isPublished = form.status === 'PUBLISHED';
                    const isNative = form.response_destination_type === 'NATIVE_SHEET';

                    return (
                      <tr key={form.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3.5 font-bold text-slate-800">
                          <Link
                            href={`/admin/dashboard/forms/${form.id}`}
                            className="hover:text-bce-cobalt transition-colors"
                          >
                            {form.title}
                          </Link>
                          {form.slug && (
                            <span className="block font-mono text-[10px] text-slate-400 font-normal">
                              /{form.slug}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          {form.form_type === 'SEMESTER_FEEDBACK' ? (
                            <div>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                Multi-Faculty Grid
                              </span>
                              <div className="text-slate-500 text-[11px] mt-0.5">
                                All Semester Assigned Courses
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="font-medium text-slate-800">{faculty?.name || 'Faculty'}</div>
                              <div className="text-slate-500 text-[11px]">
                                {subject?.name || 'Subject'} {subject?.code ? `(${subject.code})` : ''}
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-slate-500">
                          {branch?.code || 'Branch'} • {semester?.name || 'Sem'}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                              isNative
                                ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                : 'bg-blue-100 text-blue-800 border border-blue-200'
                            }`}
                          >
                            {isNative ? '⚡ Native Destination' : '🔄 App Managed Sync'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                              isPublished
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {isPublished ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                            {form.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            {form.google_form_url && (
                              <ExternalActionLink
                                href={form.google_form_url}
                                openingText="Opening Form..."
                                className="text-purple-700 hover:text-purple-900 inline-flex items-center gap-0.5 text-[11px] font-semibold"
                                title="Open Google Form Responder View"
                                icon={<FileCode2 className="w-3.5 h-3.5" />}
                              >
                                <span>Form</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </ExternalActionLink>
                            )}
                            {form.google_sheet_url || form.google_sheet_id ? (
                              <ExternalActionLink
                                href={
                                  form.google_sheet_url ||
                                  `https://docs.google.com/spreadsheets/d/${form.google_sheet_id}/edit`
                                }
                                openingText="Opening Sheet..."
                                className="text-emerald-700 hover:text-emerald-900 inline-flex items-center gap-0.5 text-[11px] font-semibold ml-1.5"
                                title="Open Google Sheet"
                                icon={<FileSpreadsheet className="w-3.5 h-3.5" />}
                              >
                                <span>Sheet</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </ExternalActionLink>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <Link
                              href={`/admin/dashboard/forms/${form.id}`}
                              onClick={() => setNavigatingFormId(form.id)}
                              aria-busy={navigatingFormId === form.id ? 'true' : undefined}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-700 hover:text-bce-cobalt bg-slate-100 hover:bg-slate-200 transition-colors inline-flex items-center gap-1 cursor-pointer"
                            >
                              {navigatingFormId === form.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Eye className="w-3 h-3" />
                              )}
                              <span>{navigatingFormId === form.id ? 'Opening...' : 'Manage'}</span>
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(form)}
                              disabled={isPending || deletingId === form.id || togglingId === form.id}
                              aria-busy={togglingId === form.id ? 'true' : undefined}
                              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1 ${
                                isPublished
                                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              }`}
                            >
                              {togglingId === form.id && <Loader2 className="w-3 h-3 animate-spin" />}
                              <span>
                                {togglingId === form.id
                                  ? isPublished
                                    ? 'Unpublishing...'
                                    : 'Publishing...'
                                  : isPublished
                                  ? 'Unpublish'
                                  : 'Publish'}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteForm(form)}
                              disabled={isPending || deletingId === form.id || togglingId === form.id}
                              aria-busy={deletingId === form.id ? 'true' : undefined}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 hover:border-rose-600 transition-all inline-flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                              title="Delete Form"
                            >
                              {deletingId === form.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Trash2 className="w-3 h-3" />
                              )}
                              <span>{deletingId === form.id ? 'Deleting...' : 'Delete'}</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="md:hidden divide-y divide-slate-100">
              {paginatedForms.map((form) => {
                const faculty = faculties.find((f) => f.id === form.faculty_id) || form.faculty;
                const subject = subjects.find((s) => s.id === form.subject_id) || form.subject;
                const branch = branches.find((b) => b.id === form.branch_id) || form.branch;
                const semester = semesters.find((s) => s.id === form.semester_id) || form.semester;
                const isPublished = form.status === 'PUBLISHED';
                const isNative = form.response_destination_type === 'NATIVE_SHEET';

                return (
                  <div key={form.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          href={`/admin/dashboard/forms/${form.id}`}
                          className="font-bold text-slate-900 text-sm hover:text-bce-cobalt transition-colors truncate block"
                        >
                          {form.title}
                        </Link>
                        {form.slug && (
                          <span className="block font-mono text-[10px] text-slate-400 font-normal truncate">
                            /{form.slug}
                          </span>
                        )}
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold shrink-0 ${
                          isPublished
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {isPublished ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                        {form.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-medium">Evaluation Target</span>
                        {form.form_type === 'SEMESTER_FEEDBACK' ? (
                          <span className="text-purple-700 font-bold text-[11px]">Multi-Faculty Grid</span>
                        ) : (
                          <>
                            <div className="font-semibold text-slate-800 text-[11px] truncate">{faculty?.name || 'Faculty'}</div>
                            <div className="text-[10px] text-slate-500 truncate">{subject?.name}</div>
                          </>
                        )}
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-medium">Cohort & Mode</span>
                        <div className="font-semibold text-slate-700 text-[11px]">{branch?.code} • {semester?.name}</div>
                        <div className="text-[10px] text-slate-500">{isNative ? '⚡ Native Sheet' : '🔄 Managed Sync'}</div>
                      </div>
                    </div>

                    {/* Links & Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-2">
                        {form.google_form_url && (
                          <ExternalActionLink
                            href={form.google_form_url}
                            openingText="Opening..."
                            className="text-purple-700 hover:text-purple-900 inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg bg-purple-50"
                            icon={<FileCode2 className="w-3.5 h-3.5" />}
                          >
                            <span>Form</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </ExternalActionLink>
                        )}
                        {(form.google_sheet_url || form.google_sheet_id) && (
                          <ExternalActionLink
                            href={
                              form.google_sheet_url ||
                              `https://docs.google.com/spreadsheets/d/${form.google_sheet_id}/edit`
                            }
                            openingText="Opening..."
                            className="text-emerald-700 hover:text-emerald-900 inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg bg-emerald-50"
                            icon={<FileSpreadsheet className="w-3.5 h-3.5" />}
                          >
                            <span>Sheet</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </ExternalActionLink>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 ml-auto">
                        <Link
                          href={`/admin/dashboard/forms/${form.id}`}
                          onClick={() => setNavigatingFormId(form.id)}
                          aria-busy={navigatingFormId === form.id ? 'true' : undefined}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-bce-cobalt bg-slate-100 hover:bg-slate-200 transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          {navigatingFormId === form.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Eye className="w-3 h-3" />
                          )}
                          <span>{navigatingFormId === form.id ? 'Opening...' : 'Manage'}</span>
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(form)}
                          disabled={isPending || deletingId === form.id || togglingId === form.id}
                          aria-busy={togglingId === form.id ? 'true' : undefined}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1 ${
                            isPublished
                              ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          }`}
                        >
                          {togglingId === form.id && <Loader2 className="w-3 h-3 animate-spin" />}
                          <span>
                            {togglingId === form.id
                              ? isPublished
                                ? 'Unpublishing...'
                                : 'Publishing...'
                              : isPublished
                              ? 'Unpublish'
                              : 'Publish'}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteForm(form)}
                          disabled={isPending || deletingId === form.id || togglingId === form.id}
                          aria-busy={deletingId === form.id ? 'true' : undefined}
                          className="p-1.5 rounded-lg text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 hover:border-rose-600 transition-all inline-flex items-center disabled:opacity-50 cursor-pointer"
                          title="Delete Form"
                        >
                          {deletingId === form.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Pagination Controls */}
        <PaginationControl
          currentPage={page}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(sz) => {
            setPageSize(sz);
            setPage(1);
          }}
          pageSizeOptions={[10, 20, 50]}
        />
      </div>
    </div>
  );
}
