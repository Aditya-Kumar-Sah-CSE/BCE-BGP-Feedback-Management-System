'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  Download,
  ArrowLeft,
  X,
  AlertCircle,
  Loader2,
  User,
  GraduationCap,
} from 'lucide-react';
import {
  AdminResponsesResult,
  StudentResponseDetail,
  getFormResponsesAction,
  getResponseDetailAction,
} from '@/app/admin/results/responses/actions';

interface Props {
  formId: string;
  initialData: AdminResponsesResult;
}

export function FormResponsesConsole({ formId, initialData }: Props) {
  const [data, setData] = useState<AdminResponsesResult>(initialData);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [pageSize, setPageSize] = useState<number>(initialData.pageSize || 20);
  const [currentPage, setCurrentPage] = useState<number>(initialData.page || 1);

  const [isPending, startTransition] = useTransition();
  const [selectedDetail, setSelectedDetail] = useState<StudentResponseDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);

  // Fetch responses on search or pagination changes
  const loadResponses = (page: number, currentSearch = search, currentStart = startDate, currentEnd = endDate, currentSize = pageSize) => {
    startTransition(async () => {
      const res = await getFormResponsesAction({
        formId,
        page,
        pageSize: currentSize,
        search: currentSearch,
        startDate: currentStart,
        endDate: currentEnd,
      });
      if (res.success) {
        setData(res);
        setCurrentPage(page);
      }
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadResponses(1, search, startDate, endDate, pageSize);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > data.totalPages) return;
    loadResponses(newPage);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    loadResponses(1, search, startDate, endDate, newSize);
  };

  const handleViewDetail = async (responseId: string) => {
    setLoadingDetail(responseId);
    try {
      const res = await getResponseDetailAction({ formId, responseId });
      if (res.success && res.detail) {
        setSelectedDetail(res.detail);
      } else {
        alert(res.error || 'Failed to load response detail.');
      }
    } catch (err) {
      console.error(err);
      alert('Error fetching response detail.');
    } finally {
      setLoadingDetail(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href={`/admin/dashboard/results/${formId}`}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
              title="Back to Form Results Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900">Student Responses</h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {data.formType === 'SEMESTER_FEEDBACK' ? 'Multi-Faculty Semester' : 'Faculty Feedback'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {data.formTitle} • {data.totalCount} Total Submissions Recorded
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/admin/dashboard/results/${formId}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-300"
            >
              <span>Back to Analytics</span>
            </Link>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2">
          <div className="sm:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by student name, reg no, or email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs text-slate-900 placeholder-slate-400 outline-none transition-all"
            />
          </div>

          <div className="sm:col-span-3 flex items-center gap-2">
            <div className="relative w-full">
              <input
                type="date"
                title="Start Date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 text-xs text-slate-700 outline-none"
              />
            </div>
            <span className="text-slate-400 text-xs">to</span>
            <div className="relative w-full">
              <input
                type="date"
                title="End Date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 text-xs text-slate-700 outline-none"
              />
            </div>
          </div>

          <div className="sm:col-span-4 flex items-center justify-end gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50"
            >
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              <span>Filter</span>
            </button>

            {(search || startDate || endDate) && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setStartDate('');
                  setEndDate('');
                  loadResponses(1, '', '', '', pageSize);
                }}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Reset
              </button>
            )}

            <div className="flex items-center gap-1.5 text-xs text-slate-500 ml-auto">
              <span>Show:</span>
              <select
                value={pageSize}
                onChange={e => handlePageSizeChange(Number(e.target.value))}
                className="px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700 outline-none"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
        </form>
      </div>

      {/* Responses Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Student Name</th>
                <th className="py-3 px-4">University Reg No</th>
                <th className="py-3 px-4">Verified Email</th>
                <th className="py-3 px-4">Submission Date</th>
                <th className="py-3 px-4">Response ID</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isPending ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                    <span>Loading responses...</span>
                  </td>
                </tr>
              ) : data.responses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-700 text-sm">No Student Responses Found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {search || startDate || endDate
                        ? 'No responses match your search or date filter criteria.'
                        : 'Submissions will appear automatically once students submit Google Forms.'}
                    </p>
                  </td>
                </tr>
              ) : (
                data.responses.map(row => (
                  <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {row.studentName || 'Confidential Student'}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-700">
                      {row.registrationNumber || 'N/A'}
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {row.studentEmail}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {row.submittedAt
                        ? new Date(row.submittedAt).toLocaleString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Google Form Recorded'}
                    </td>
                    <td className="py-3 px-4 font-mono text-[10px] text-slate-400" title={row.googleResponseId}>
                      {row.googleResponseId.length > 14
                        ? `${row.googleResponseId.slice(0, 12)}…`
                        : row.googleResponseId}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          row.emailStatus === 'SENT'
                            ? 'bg-emerald-100 text-emerald-800'
                            : row.emailStatus === 'EMAIL_NOT_CONFIGURED'
                            ? 'bg-slate-100 text-slate-600'
                            : row.emailStatus === 'FAILED'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {row.emailStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleViewDetail(row.googleResponseId)}
                          disabled={loadingDetail === row.googleResponseId}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs transition-colors disabled:opacity-50"
                        >
                          {loadingDetail === row.googleResponseId ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                          <span>View</span>
                        </button>

                        <a
                          href={`/api/feedback/response/download?formId=${formId}&responseId=${encodeURIComponent(row.googleResponseId)}`}
                          target="_blank"
                          rel="noreferrer"
                          download
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
                          title="Download Student Response PDF"
                        >
                          <Download className="w-3.5 h-3.5 text-slate-500" />
                          <span>PDF</span>
                        </a>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {data.totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-600">
            <div>
              Showing <span className="font-bold text-slate-900">{(currentPage - 1) * pageSize + 1}</span> to{' '}
              <span className="font-bold text-slate-900">
                {Math.min(currentPage * pageSize, data.totalCount)}
              </span>{' '}
              of <span className="font-bold text-slate-900">{data.totalCount}</span> submissions
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1 || isPending}
                className="p-1.5 rounded-lg border border-slate-300 hover:bg-white text-slate-600 disabled:opacity-30 transition-colors"
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-3 py-1 font-semibold text-slate-700">
                Page {currentPage} of {data.totalPages}
              </span>

              <button
                type="button"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= data.totalPages || isPending}
                className="p-1.5 rounded-lg border border-slate-300 hover:bg-white text-slate-600 disabled:opacity-30 transition-colors"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Response Detail Modal */}
      {selectedDetail && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Student Feedback Detail</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    ID: {selectedDetail.responseId}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDetail(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
              {/* Student Metadata Card */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[11px]">Student Name</span>
                  <span className="font-bold text-slate-900">
                    {selectedDetail.studentName || 'Confidential Student'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">University Reg No</span>
                  <span className="font-mono font-bold text-slate-800">
                    {selectedDetail.registrationNumber || 'N/A'}
                  </span>
                </div>
                <div className="col-span-2 sm:col-span-2">
                  <span className="text-slate-400 block text-[11px]">Verified Email</span>
                  <span className="font-semibold text-indigo-600 truncate block">
                    {selectedDetail.studentEmail}
                  </span>
                </div>
              </div>

              {/* Faculty Evaluation Grids */}
              <div className="space-y-4">
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4 text-indigo-600" />
                  <span>Evaluation Parameter Breakdown</span>
                </h4>

                {selectedDetail.facultyEvaluations.map((evalItem, eIdx) => (
                  <div key={eIdx} className="rounded-xl border border-slate-200 overflow-hidden">
                    <div className="bg-slate-800 text-white px-4 py-2.5 font-bold text-xs flex items-center justify-between">
                      <span>{evalItem.facultyName}</span>
                      <span className="text-slate-300 font-normal">{evalItem.subjectName}</span>
                    </div>

                    <div className="divide-y divide-slate-100 bg-white">
                      {evalItem.ratings.map(r => {
                        const rLower = (r.rating || '').toLowerCase();
                        const badgeColor = rLower.includes('excellent')
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                          : rLower.includes('very good')
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : rLower.includes('good')
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : rLower.includes('satisfactory')
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : rLower.includes('unsatisfactory')
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-slate-50 text-slate-600 border-slate-200';

                        return (
                          <div key={r.parameterId} className="flex items-center justify-between p-3 text-xs">
                            <span className="text-slate-700 max-w-[70%] font-medium">
                              {r.parameterId}. {r.parameterTitle}
                            </span>
                            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${badgeColor}`}>
                              {r.rating || 'Not Rated'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* General Feedback */}
              {selectedDetail.generalFeedback && (
                <div className="space-y-1.5">
                  <h4 className="font-bold text-slate-900 text-xs">General Feedback / Suggestions</h4>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs leading-relaxed italic">
                    &ldquo;{selectedDetail.generalFeedback}&rdquo;
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <a
                href={`/api/feedback/response/download?formId=${formId}&responseId=${encodeURIComponent(selectedDetail.responseId)}`}
                target="_blank"
                rel="noreferrer"
                download
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Response PDF</span>
              </a>

              <button
                type="button"
                onClick={() => setSelectedDetail(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
