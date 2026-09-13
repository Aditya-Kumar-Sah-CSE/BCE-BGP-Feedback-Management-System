'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  toggleFeedbackFormStatusAction
} from '@/app/admin/actions';
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
} from 'lucide-react';
import type {
  FeedbackForm,
  AcademicYear,
  Branch,
  Semester,
  Faculty,
  Subject
} from '@/types/database';

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
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleToggleStatus = (form: FeedbackForm) => {
    const nextStatus = form.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    startTransition(async () => {
      const res = await toggleFeedbackFormStatusAction(form.id, nextStatus);
      if (res.success) {
        setMessage({ type: 'success', text: `Form status updated to ${nextStatus}.` });
      } else {
        setMessage({ type: 'error', text: res.error || 'Failed to update status.' });
      }
    });
  };

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
            className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            <span>Forms Catalog</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <Link
            href="/admin/dashboard/forms/create"
            className="inline-flex items-center gap-2 px-4 py-2 bg-bce-cobalt hover:bg-bce-navy text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Generate Google Form</span>
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

      {/* Forms List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-900">Configured Feedback Forms ({feedbackForms.length})</h4>
          <span className="text-xs text-slate-400">
            {feedbackForms.filter(f => f.status === 'PUBLISHED').length} Published
          </span>
        </div>

        {feedbackForms.length === 0 ? (
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
        ) : (
          <div className="overflow-x-auto">
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
                {feedbackForms.map((form) => {
                  const faculty = faculties.find(f => f.id === form.faculty_id) || form.faculty;
                  const subject = subjects.find(s => s.id === form.subject_id) || form.subject;
                  const branch = branches.find(b => b.id === form.branch_id) || form.branch;
                  const semester = semesters.find(s => s.id === form.semester_id) || form.semester;
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
                        <div className="font-medium text-slate-800">{faculty?.name || 'Faculty'}</div>
                        <div className="text-slate-500 text-[11px]">
                          {subject?.name || 'Subject'} {subject?.code ? `(${subject.code})` : ''}
                        </div>
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
                            <a
                              href={form.google_form_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-purple-700 hover:text-purple-900 inline-flex items-center gap-0.5 text-[11px] font-semibold"
                              title="Open Google Form Responder View"
                            >
                              <FileCode2 className="w-3.5 h-3.5" />
                              <span>Form</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                          {form.google_sheet_url || form.google_sheet_id ? (
                            <a
                              href={
                                form.google_sheet_url ||
                                `https://docs.google.com/spreadsheets/d/${form.google_sheet_id}/edit`
                              }
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-700 hover:text-emerald-900 inline-flex items-center gap-0.5 text-[11px] font-semibold ml-1.5"
                              title="Open Google Sheet"
                            >
                              <FileSpreadsheet className="w-3.5 h-3.5" />
                              <span>Sheet</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="inline-flex items-center gap-2">
                          <Link
                            href={`/admin/dashboard/forms/${form.id}`}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-700 hover:text-bce-cobalt bg-slate-100 hover:bg-slate-200 transition-colors inline-flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Manage</span>
                          </Link>
                          <button
                            onClick={() => handleToggleStatus(form)}
                            disabled={isPending}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                              isPublished
                                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            }`}
                          >
                            {isPublished ? 'Unpublish' : 'Publish'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
