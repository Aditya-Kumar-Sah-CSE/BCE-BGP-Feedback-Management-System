import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getAdminSession } from '@/lib/auth/admin-auth';
import { redirect } from 'next/navigation';
import { getGoogleConfigStatus } from '@/lib/google/auth';
import {
  FileSpreadsheet,
  Plus,
  ExternalLink,
  CheckCircle2,
  Clock,
  Archive,
  Ban,
  Eye,
  AlertTriangle,
  FileCode2,
} from 'lucide-react';

import { FeedbackForm, FeedbackFormStatus } from '@/types/database';
import { FormsFilterClient } from '@/components/admin/forms/FormsFilterClient';

export const dynamic = 'force-dynamic';

export default async function FeedbackFormsPage({
  searchParams,
}: {
  searchParams: Promise<{
    year?: string;
    branch?: string;
    semester?: string;
    status?: string;
    search?: string;
  }>;
}) {
  const session = await getAdminSession();
  if (!session.isAuthenticated) {
    redirect('/admin/login');
  }

  const resolvedParams = await searchParams;
  const supabase = await createClient();
  const googleStatus = getGoogleConfigStatus();

  // Fetch academic masters for filters
  const [
    { data: years },
    { data: branches },
    { data: semesters },
  ] = await Promise.all([
    supabase.from('academic_years').select('*').order('name', { ascending: false }),
    supabase.from('branches').select('*').order('name'),
    supabase.from('semesters').select('*').order('semester_number'),
  ]);

  // Query forms with relations
  let query = supabase
    .from('feedback_forms')
    .select(`
      *,
      faculty:faculties(*),
      subject:subjects(*),
      academic_year:academic_years(*),
      branch:branches(*),
      semester:semesters(*)
    `)
    .order('created_at', { ascending: false });

  if (resolvedParams.year && resolvedParams.year !== 'ALL') {
    query = query.eq('academic_year_id', resolvedParams.year);
  }
  if (resolvedParams.branch && resolvedParams.branch !== 'ALL') {
    query = query.eq('branch_id', resolvedParams.branch);
  }
  if (resolvedParams.semester && resolvedParams.semester !== 'ALL') {
    query = query.eq('semester_id', resolvedParams.semester);
  }
  if (resolvedParams.status && resolvedParams.status !== 'ALL') {
    query = query.eq('status', resolvedParams.status);
  }

  const { data: formsData } = await query;
  let forms = (formsData || []) as FeedbackForm[];


  if (resolvedParams.search && resolvedParams.search.trim()) {
    const q = resolvedParams.search.toLowerCase().trim();
    forms = forms.filter(
      f =>
        f.title?.toLowerCase().includes(q) ||
        f.faculty?.name?.toLowerCase().includes(q) ||
        f.subject?.name?.toLowerCase().includes(q) ||
        f.subject?.code?.toLowerCase().includes(q)
    );
  }

  const statusBadge = (status: FeedbackFormStatus) => {
    switch (status) {
      case 'PUBLISHED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5" /> PUBLISHED
          </span>
        );
      case 'DRAFT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <Clock className="w-3.5 h-3.5" /> DRAFT
          </span>
        );
      case 'CLOSED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800 border border-red-300">
            <Ban className="w-3.5 h-3.5" /> CLOSED
          </span>
        );
      case 'ARCHIVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-200 text-slate-700 border border-slate-300">
            <Archive className="w-3.5 h-3.5" /> ARCHIVED
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-6 h-6 text-bce-cobalt" />
              Google Feedback Forms Management
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-blue-100 text-bce-cobalt border border-blue-200">
              Phase 2 Active
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Create standard 8-parameter BCE Google Feedback Forms, manage connected response Google Sheets, and oversee form lifecycles.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/dashboard"
            className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
          >
            ← Admin Console
          </Link>
          <Link
            href="/admin/dashboard/forms/create"
            className="inline-flex items-center gap-2 px-4 py-2 bg-bce-cobalt hover:bg-bce-navy text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Generate Google Form</span>
          </Link>
        </div>
      </div>

      {/* Google Setup Status Banner */}
      {!googleStatus.isConfigured ? (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex items-start gap-3 text-xs text-amber-950">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-amber-900">Google API Setup Notice</p>
            <p className="text-amber-800">
              Google API credentials are not yet configured in <code className="px-1.5 py-0.5 bg-amber-100 rounded text-amber-900 font-mono">.env.local</code>.
              To generate real Google Forms and Google Sheets, configure <code className="font-mono font-bold">GOOGLE_CLIENT_ID</code>, <code className="font-mono font-bold">GOOGLE_CLIENT_SECRET</code>, and <code className="font-mono font-bold">GOOGLE_REFRESH_TOKEN</code> (or Service Account).
            </p>
          </div>
        </div>
      ) : (
        <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs text-emerald-950">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>Google API Connected:</strong> {googleStatus.message}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-emerald-100 rounded text-[11px] font-semibold text-emerald-800">
              {googleStatus.hasAppsScript ? 'Apps Script Web App Configured' : 'Application-Managed Sync Active'}
            </span>
          </div>
        </div>
      )}

      {/* Interactive Filters Bar */}
      <FormsFilterClient
        academicYears={years || []}
        branches={branches || []}
        semesters={semesters || []}
        selectedYear={resolvedParams.year || 'ALL'}
        selectedBranch={resolvedParams.branch || 'ALL'}
        selectedSemester={resolvedParams.semester || 'ALL'}
        selectedStatus={resolvedParams.status || 'ALL'}
        initialSearch={resolvedParams.search || ''}
      />

      {/* Forms Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">
            Feedback Forms Catalog ({forms.length})
          </h3>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>{forms.filter(f => f.status === 'PUBLISHED').length} Published</span>
            <span>•</span>
            <span>{forms.filter(f => f.status === 'DRAFT').length} Drafts</span>
            <span>•</span>
            <span>{forms.filter(f => f.status === 'CLOSED').length} Closed</span>
          </div>
        </div>

        {forms.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-800">No Feedback Forms Found</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {resolvedParams.search || resolvedParams.status || resolvedParams.year
                ? 'Try adjusting your filters or search query.'
                : 'Get started by clicking "Generate Google Form" to create your first feedback form.'}
            </p>
            <Link
              href="/admin/dashboard/forms/create"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-bce-cobalt text-white text-xs font-bold rounded-xl hover:bg-bce-navy transition-colors"
            >
              <Plus className="w-4 h-4" />
              Generate First Form
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-100 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">Form Details</th>
                  <th className="px-5 py-3">Faculty & Subject</th>
                  <th className="px-5 py-3">Branch & Sem</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Response Mode</th>
                  <th className="px-5 py-3">Google Links</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {forms.map(form => {
                  const faculty = form.faculty;
                  const subject = form.subject;
                  const branch = form.branch;
                  const semester = form.semester;
                  const isNative = form.response_destination_type === 'NATIVE_SHEET';

                  return (
                    <tr key={form.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <Link
                          href={`/admin/dashboard/forms/${form.id}`}
                          className="font-bold text-slate-900 hover:text-bce-cobalt transition-colors block"
                        >
                          {form.title}
                        </Link>
                        <span className="text-[10px] text-slate-400 block font-mono mt-0.5">
                          Created: {new Date(form.created_at).toLocaleDateString()}
                        </span>
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-slate-800">
                          {faculty?.name || 'Faculty'}
                        </div>
                        <div className="text-slate-500 text-[11px]">
                          {subject?.name || 'Subject'} {subject?.code ? `(${subject.code})` : ''}
                        </div>
                      </td>

                      <td className="px-5 py-3.5 text-slate-600">
                        <div>{branch?.name || 'Branch'} ({branch?.code})</div>
                        <div className="text-[11px] text-slate-400">
                          {semester?.name || 'Sem'} • {form.academic_year?.name || 'Session'}
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        {statusBadge(form.status)}
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
                        {typeof form.response_count === 'number' && (
                          <span className="block text-[10px] text-slate-500 mt-0.5">
                            {form.response_count} response(s)
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          {form.google_form_url ? (
                            <a
                              href={form.google_form_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-700 hover:text-purple-900 hover:underline"
                              title="Open Google Form Responder View"
                            >
                              <FileCode2 className="w-3.5 h-3.5" />
                              <span>Form</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-slate-400 text-[11px]">—</span>
                          )}

                          {form.google_sheet_url || form.google_sheet_id ? (
                            <a
                              href={
                                form.google_sheet_url ||
                                `https://docs.google.com/spreadsheets/d/${form.google_sheet_id}/edit`
                              }
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 hover:text-emerald-900 hover:underline ml-2"
                              title="Open Google Responses Sheet"
                            >
                              <FileSpreadsheet className="w-3.5 h-3.5" />
                              <span>Sheet</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-slate-400 text-[11px]">—</span>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <Link
                            href={`/admin/dashboard/forms/${form.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-700 hover:text-bce-cobalt bg-slate-100 hover:bg-slate-200 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Manage</span>
                          </Link>
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
