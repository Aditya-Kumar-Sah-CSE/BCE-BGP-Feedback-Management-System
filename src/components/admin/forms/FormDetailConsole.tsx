'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FeedbackForm,
  FeedbackFormStatus,
  AuditLog,
} from '@/types/database';
import {
  updateFormStatusAction,
  syncFormResponsesAction,
} from '@/app/admin/forms/actions';
import { BCE_FEEDBACK_PARAMETERS } from '@/lib/google/template';
import {
  ArrowLeft,
  FileSpreadsheet,
  FileCode2,
  ExternalLink,
  CheckCircle2,
  Clock,
  Ban,
  Archive,
  RefreshCw,
  Copy,
  Check,
  AlertCircle,
  Calendar,
  GraduationCap,
  Activity,
  BarChart3,
} from 'lucide-react';

interface Props {
  form: FeedbackForm;
  auditLogs: AuditLog[];
  currentUserEmail: string;
}


export function FormDetailConsole({ form, auditLogs, currentUserEmail }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isNative = form.response_destination_type === 'NATIVE_SHEET';

  const handleCopyLink = () => {
    if (form.google_form_url) {
      navigator.clipboard.writeText(form.google_form_url);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  const handleStatusChange = (newStatus: FeedbackFormStatus) => {
    setMessage(null);
    startTransition(async () => {
      const res = await updateFormStatusAction(form.id, newStatus);
      if (res.success) {
        setMessage({ type: 'success', text: res.message || `Form status changed to ${newStatus}.` });
        router.refresh();
      } else {
        setMessage({ type: 'error', text: res.error || 'Failed to update status.' });
      }
    });
  };

  const handleSyncResponses = () => {
    setMessage(null);
    startTransition(async () => {
      const res = await syncFormResponsesAction(form.id);
      if (res.success) {
        setMessage({
          type: 'success',
          text: res.message || `Synced ${res.syncedCount} response(s). Total: ${res.totalResponses}.`,
        });
        router.refresh();
      } else {
        setMessage({ type: 'error', text: res.error || 'Failed to sync responses.' });
      }
    });
  };

  const statusBadge = (status: FeedbackFormStatus) => {
    switch (status) {
      case 'PUBLISHED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-xs">
            <CheckCircle2 className="w-4 h-4" /> PUBLISHED (Accepting Feedback)
          </span>
        );
      case 'DRAFT':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 shadow-xs">
            <Clock className="w-4 h-4" /> DRAFT (Not Published)
          </span>
        );
      case 'CLOSED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300 shadow-xs">
            <Ban className="w-4 h-4" /> CLOSED (Feedback Concluded)
          </span>
        );
      case 'ARCHIVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-200 text-slate-700 border border-slate-300 shadow-xs">
            <Archive className="w-4 h-4" /> ARCHIVED (Historical Record)
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Link
                href="/admin/dashboard/forms"
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <h2 className="text-xl font-bold text-slate-900">{form.title}</h2>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500 ml-8">
              <span>Form ID: <code className="font-mono text-[11px] text-slate-700">{form.id}</code></span>
              <span>•</span>
              <span>Created {new Date(form.created_at).toLocaleDateString()}</span>
              {currentUserEmail && (
                <>
                  <span>•</span>
                  <span>Console: <strong className="text-slate-700 font-mono text-[11px]">{currentUserEmail}</strong></span>
                </>
              )}
            </div>

          </div>

          <div className="flex items-center gap-2.5">
            {statusBadge(form.status)}
          </div>
        </div>

        {/* Message Banner */}
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

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
          {/* External Google Links */}
          <div className="flex flex-wrap items-center gap-2">
            {form.google_form_url && (
              <>
                <a
                  href={form.google_form_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded-xl text-xs font-bold transition-colors shadow-2xs"
                >
                  <FileCode2 className="w-4 h-4 text-purple-700" />
                  <span>Open Student Form</span>
                  <ExternalLink className="w-3 h-3" />
                </a>

                <button
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium transition-colors"
                >
                  {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedUrl ? 'Copied' : 'Copy Form URL'}</span>
                </button>
              </>
            )}

            {form.google_form_edit_url ? (
              <a
                href={form.google_form_edit_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-medium transition-colors"
              >
                <span>Edit in Google Forms</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>
            ) : form.google_form_id ? (
              <a
                href={`https://docs.google.com/forms/d/${form.google_form_id}/edit`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-medium transition-colors"
              >
                <span>Edit in Google Forms</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>
            ) : null}

            {form.google_sheet_url || form.google_sheet_id ? (
              <a
                href={
                  form.google_sheet_url ||
                  `https://docs.google.com/spreadsheets/d/${form.google_sheet_id}/edit`
                }
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-colors shadow-2xs"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                <span>Open Response Sheet</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            ) : null}

            <Link
              href={`/admin/dashboard/results/${form.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-bce-navy hover:bg-slate-800 text-amber-300 border border-slate-700 rounded-xl text-xs font-bold transition-colors shadow-2xs"
            >
              <BarChart3 className="w-4 h-4 text-amber-400" />
              <span>Results & Analytics</span>
            </Link>
          </div>

          {/* Lifecycle State Changer */}
          <div className="flex items-center gap-2">
            {form.status === 'DRAFT' && (
              <button
                onClick={() => handleStatusChange('PUBLISHED')}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50 shadow-xs"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Publish Form</span>
              </button>
            )}

            {form.status === 'PUBLISHED' && (
              <button
                onClick={() => handleStatusChange('CLOSED')}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50 shadow-xs"
              >
                <Ban className="w-4 h-4" />
                <span>Close Submissions</span>
              </button>
            )}

            {form.status === 'CLOSED' && (
              <>
                <button
                  onClick={() => handleStatusChange('PUBLISHED')}
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Reopen Form</span>
                </button>
                <button
                  onClick={() => handleStatusChange('ARCHIVED')}
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
                >
                  <Archive className="w-4 h-4" />
                  <span>Archive Form</span>
                </button>
              </>
            )}

            {form.status === 'ARCHIVED' && (
              <button
                onClick={() => handleStatusChange('DRAFT')}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
              >
                <span>Restore to Draft</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Grid: Response Synchronization + Academic Metadata */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Response Synchronization & Evaluation Parameters */}
        <div className="lg:col-span-2 space-y-6">
          {/* Response Destination & Sync Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <RefreshCw className={`w-4 h-4 text-bce-cobalt ${isPending ? 'animate-spin' : ''}`} />
                  Google Form Response Destination & Sync
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Real responses collected in the Google Form and synced to the connected Google Sheet.
                </p>
              </div>

              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                  isNative
                    ? 'bg-purple-100 text-purple-800 border border-purple-200'
                    : 'bg-blue-100 text-blue-800 border border-blue-200'
                }`}
              >
                {isNative ? '⚡ Native Destination (Apps Script)' : '🔄 Application-Managed Sync'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Responses Recorded
                </span>
                <span className="text-2xl font-bold text-slate-900 mt-1 block">
                  {form.response_count || 0}
                </span>
                <span className="text-[10px] text-slate-500">In Google Sheet</span>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Last Synced
                </span>
                <span className="text-xs font-semibold text-slate-800 mt-2 block">
                  {form.last_synced_at
                    ? new Date(form.last_synced_at).toLocaleTimeString() + ' (' + new Date(form.last_synced_at).toLocaleDateString() + ')'
                    : 'Never synced'}
                </span>
                <span className="text-[10px] text-slate-500">Forms → Sheet</span>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-center items-center">
                <button
                  onClick={handleSyncResponses}
                  disabled={isPending || !form.google_form_id || !form.google_sheet_id}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-bce-cobalt hover:bg-bce-navy text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50 shadow-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin' : ''}`} />
                  <span>{isPending ? 'Syncing...' : 'Sync Responses Now'}</span>
                </button>
                <span className="text-[10px] text-slate-400 mt-1">Appends new responses</span>
              </div>
            </div>

            <div className="p-3 bg-blue-50/60 border border-blue-200/70 rounded-xl text-xs text-blue-900 space-y-1">
              <p className="font-semibold">
                {isNative
                  ? 'Native Response Flow Active:'
                  : 'Application Response Synchronization Flow:'}
              </p>
              <p className="text-[11px] text-blue-800/90 leading-relaxed">
                {isNative
                  ? 'When students submit the Google Form, responses automatically stream directly into the connected Google Sheet via native Google Forms destination.'
                  : 'Click "Sync Responses Now" to fetch submitted responses from the official Google Forms API and append them into the formatted Google Sheet. Duplicate submissions are automatically detected and skipped.'}
              </p>
            </div>
          </div>

          {/* Standard 8 BCE Evaluation Parameters */}
          {/* Form Questions & Structure */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Form Structure & Questionnaire (11 Fields)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Student identification, 8-parameter rating scale, and optional suggestion box.
                </p>
              </div>
              <span className="px-2 py-0.5 bg-blue-50 text-bce-cobalt text-[10px] font-bold rounded border border-blue-200">
                11 Fields Active
              </span>
            </div>

            {/* Identification Fields */}
            <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-100 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-950">Student Identification</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] bg-blue-100 text-blue-800 font-semibold">Required *</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="p-2 bg-white rounded-lg border border-blue-100/80">
                  <span className="font-bold text-slate-800">Student Name</span>
                  <p className="text-[10px] text-slate-500 mt-0.5">Short text (Official college records)</p>
                </div>
                <div className="p-2 bg-white rounded-lg border border-blue-100/80">
                  <span className="font-bold text-slate-800">University Registration Number</span>
                  <p className="text-[10px] text-slate-500 mt-0.5">Short text (University / Roll number)</p>
                </div>
              </div>
            </div>

            {/* 8 Rating Parameters */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-0.5">
                <span className="text-xs font-bold text-slate-800">8 Faculty Evaluation Parameters</span>
                <span className="text-[10px] text-slate-500 font-medium">4-Point Rating Scale (Required)</span>
              </div>
              {BCE_FEEDBACK_PARAMETERS.map(param => (
                <div
                  key={param.id}
                  className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div>
                    <div className="font-bold text-xs text-slate-800">
                      {param.id}. {param.title}
                    </div>
                    {param.description && (
                      <div className="text-[11px] text-slate-500 mt-0.5">{param.description}</div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 shrink-0">
                    {param.options.map(opt => (
                      <span
                        key={opt}
                        className="px-2 py-0.5 rounded text-[10px] font-medium bg-white border border-slate-200 text-slate-700"
                      >
                        {opt}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Optional Suggestions */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-slate-800">Comments / Suggestions</span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] bg-slate-200 text-slate-600 font-medium">Optional</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Long-form paragraph for student suggestions, observations, and constructive remarks.
                </p>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-white border border-slate-200 text-slate-600 shrink-0">
                Paragraph Text
              </span>
            </div>
          </div>
        </div>

        {/* Right Col: Academic Metadata & Audit Trail */}
        <div className="space-y-6">
          {/* Academic Details Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 border-b border-slate-100 pb-2 flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4 text-bce-cobalt" />
              Academic Assignment Details
            </h4>

            <div className="space-y-2 text-xs text-slate-700">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400">Faculty:</span>
                <span className="font-bold text-slate-900">{form.faculty?.name || '—'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400">Designation:</span>
                <span>{form.faculty?.designation || '—'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400">Department:</span>
                <span>{form.faculty?.department || '—'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400">Subject:</span>
                <span className="font-semibold text-slate-900">{form.subject?.name || '—'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400">Subject Code:</span>
                <span className="font-mono text-slate-800">{form.subject?.code || '—'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400">Branch:</span>
                <span>{form.branch?.name || '—'} ({form.branch?.code})</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400">Semester:</span>
                <span>{form.semester?.name || '—'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400">Academic Session:</span>
                <span className="font-semibold">{form.academic_year?.name || '—'}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Form Type:</span>
                <span className="font-mono text-[11px] font-semibold">{form.form_type}</span>
              </div>
            </div>
          </div>

          {/* Form Timestamps Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 border-b border-slate-100 pb-2 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-bce-cobalt" />
              Lifecycle Timestamps
            </h4>

            <div className="space-y-1.5 text-xs text-slate-600">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400">Created:</span>
                <span>{new Date(form.created_at).toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400">Published:</span>
                <span>{form.published_at ? new Date(form.published_at).toLocaleString() : 'Not published'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400">Closed:</span>
                <span>{form.closed_at ? new Date(form.closed_at).toLocaleString() : 'Not closed'}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Archived:</span>
                <span>{form.archived_at ? new Date(form.archived_at).toLocaleString() : 'Not archived'}</span>
              </div>
            </div>
          </div>

          {/* Form Audit Trail */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 border-b border-slate-100 pb-2 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-bce-cobalt" />
              Form Audit Trail ({auditLogs.length})
            </h4>

            {auditLogs.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">No audit logs recorded for this form.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {auditLogs.map(log => (
                  <div key={log.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-[11px] space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 font-mono text-[10px]">{log.action}</span>
                      <span className="text-[9px] text-slate-400">
                        {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {log.details && <p className="text-slate-600">{log.details}</p>}
                    <span className="text-[9px] text-slate-400 font-mono block">By: {log.actor_email || 'System'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
