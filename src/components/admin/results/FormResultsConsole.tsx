'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ParameterScoreBarChart,
  ParameterDistributionStackedChart,
  OverallDonutChart,
} from './AnalyticsCharts';
import { FormAnalyticsReport } from '@/lib/analytics/types';
import { syncSingleFormResponsesAction, getFormAnalyticsAction } from '@/app/admin/results/actions';
import {
  ArrowLeft,
  FileDown,
  RefreshCw,
  ExternalLink,
  Users,
  Award,
  CheckCircle2,
  FileSpreadsheet,
  AlertCircle,
  FileCode2,
  Info,
} from 'lucide-react';

interface Props {
  initialReport: FormAnalyticsReport;
}

export function FormResultsConsole({ initialReport }: Props) {
  const router = useRouter();
  const [report, setReport] = useState<FormAnalyticsReport>(initialReport);
  const [isSyncing, startSync] = useTransition();
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSync = () => {
    setSyncMessage(null);
    startSync(async () => {
      const res = await syncSingleFormResponsesAction(report.formId);
      if (res.success) {
        setSyncMessage({
          type: 'success',
          text: res.message || `Synced ${res.syncedCount} new response(s). Total: ${res.totalResponses}.`,
        });
        const updated = await getFormAnalyticsAction(report.formId);
        if (updated.success && updated.report) {
          setReport(updated.report);
        }
        router.refresh();
      } else {
        setSyncMessage({
          type: 'error',
          text: res.error || 'Failed to synchronize responses.',
        });
      }
    });
  };

  const gradeInfo = (() => {
    if (!report.hasData) return { label: 'NO DATA', color: 'text-slate-400', bg: 'bg-slate-100', border: 'border-slate-300' };
    const s = report.averageOverallScore;
    if (s >= 3.5) return { label: 'VERY GOOD (EXCELLENT)', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-300' };
    if (s >= 2.75) return { label: 'GOOD (COMMENDABLE)', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-300' };
    if (s >= 2.0) return { label: 'SATISFACTORY', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-300' };
    return { label: 'NEEDS ATTENTION', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-300' };
  })();

  return (
    <div className="space-y-6">
      {/* Top Header & Action Console */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Link
                href="/admin/dashboard/results"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                title="Back to All Results"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-slate-900">
                  {report.facultyName}
                </h1>
                <p className="text-xs text-slate-600 font-medium">
                  {report.subjectName} ({report.subjectCode}) • {report.branch} • {report.semester} • {report.academicYear}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-bce-cobalt hover:bg-bce-navy text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Responses'}</span>
            </button>

            <a
              href={`/api/admin/results/${report.formId}/pdf`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-bce-navy hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
            >
              <FileDown className="w-3.5 h-3.5 text-amber-400" />
              <span>Download Faculty Report (PDF)</span>
            </a>
          </div>
        </div>

        {/* Sync / Notification Alert */}
        {syncMessage && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
              syncMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-red-50 border-red-200 text-red-900'
            }`}
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{syncMessage.text}</span>
          </div>
        )}

        {/* Form Metadata & Quick Google Links */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
              Status: {report.status}
            </span>
            <span className="text-slate-400">•</span>
            <span className="text-slate-500 text-[11px]">
              Last synced: {report.lastSyncedAt ? new Date(report.lastSyncedAt).toLocaleString() : 'Not yet synced'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {report.googleSheetUrl && (
              <a
                href={report.googleSheetUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-semibold"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Google Sheet Responses</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
            {report.googleFormUrl && (
              <a
                href={report.googleFormUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-purple-700 hover:text-purple-800 font-semibold"
              >
                <FileCode2 className="w-3.5 h-3.5" />
                <span>Public Form</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* KPI Metric Summary Blocks */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Responses */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Submissions</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">
            {report.totalResponses}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Recorded in Google Sheet</p>
        </div>

        {/* Valid Responses */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Valid Responses</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">
            {report.validResponses}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {report.unansweredResponses} incomplete/unanswered
          </p>
        </div>

        {/* Overall Average Score */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Overall Rating</span>
            <Award className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">
            {report.hasData ? (
              <>
                {report.averageOverallScore.toFixed(2)}{' '}
                <span className="text-xs font-medium text-slate-400">/ 4.00</span>
              </>
            ) : (
              <span className="text-lg text-slate-400 font-semibold">No Data</span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {report.hasData
              ? `Composite Avg: ${report.compositeAverageScore.toFixed(2)}/4.00`
              : 'Requires student responses'}
          </p>
        </div>

        {/* Performance Grade */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Performance Grade</span>
            <Info className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2">
            <span
              className={`inline-block px-2.5 py-1 rounded-lg text-xs font-extrabold border ${gradeInfo.bg} ${gradeInfo.color} ${gradeInfo.border}`}
            >
              {gradeInfo.label}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Institutional 4-point rating scale</p>
        </div>
      </div>

      {/* Visual Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Parameter-wise Average */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900">
              Evaluation Parameter Scores (1.00 — 4.00)
            </h3>
            <p className="text-xs text-slate-500">
              Weighted average rating calculated across all valid student submissions.
            </p>
          </div>
          <ParameterScoreBarChart parameters={report.parameters} hasData={report.hasData} />
        </div>

        {/* Parameter Distribution Stacked Bar */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900">
              Parameter Rating Distribution (%)
            </h3>
            <p className="text-xs text-slate-500">
              Detailed percentage breakdown of Very Good, Good, Satisfactory, and Unsatisfactory.
            </p>
          </div>
          <ParameterDistributionStackedChart
            parameters={report.parameters}
            hasData={report.hasData}
          />
        </div>

        {/* Overall Distribution Donut */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3 lg:col-span-2">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900">Overall Rating Tier Breakdown</h3>
            <p className="text-xs text-slate-500">
              Institutional breakdown of all valid submitted evaluation items.
            </p>
          </div>
          <OverallDonutChart distribution={report.distribution} hasData={report.hasData} />
        </div>
      </div>

      {/* Parameter-by-Parameter Breakdown (8 Cards) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Standard BCE 8-Parameter Detailed Performance Breakdown
            </h3>
            <p className="text-xs text-slate-500">
              Itemized metrics, score calculations, and data-driven interpretations.
            </p>
          </div>
          <span className="text-xs text-slate-400 font-medium">8 Parameters Configured</span>
        </div>

        {!report.hasData ? (
          <div className="py-10 text-center text-slate-400 space-y-2">
            <p className="text-sm font-semibold">No feedback responses are available yet.</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Once responses are recorded in the Google Sheet, this section will automatically display itemized scores, response percentages, and objective observations.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {report.parameters.map(p => {
              const scoreColor =
                p.averageScore >= 3.0
                  ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                  : p.averageScore >= 2.0
                  ? 'text-amber-700 bg-amber-50 border-amber-200'
                  : 'text-red-700 bg-red-50 border-red-200';

              return (
                <div
                  key={p.parameterId}
                  className="p-4 bg-slate-50/70 rounded-xl border border-slate-200 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-xs text-slate-900">
                        {p.parameterId}. {p.title}
                      </h4>
                      {p.description && (
                        <p className="text-[11px] text-slate-500 mt-0.5">{p.description}</p>
                      )}
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border shrink-0 ${scoreColor}`}
                    >
                      {p.validCount > 0 ? `${p.averageScore.toFixed(2)} / 4.00` : 'N/A'}
                    </span>
                  </div>

                  {/* Progress Bar Visual */}
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-bce-cobalt h-2 rounded-full transition-all"
                      style={{
                        width: `${p.validCount > 0 ? (p.averageScore / 4) * 100 : 0}%`,
                      }}
                    />
                  </div>

                  {/* Tiers Breakdown Grid */}
                  <div className="grid grid-cols-4 gap-1.5 text-center pt-1 border-t border-slate-200/60 text-[10px]">
                    <div className="p-1.5 bg-white rounded-lg border border-slate-100">
                      <span className="text-emerald-700 font-bold block">V. Good</span>
                      <span className="text-slate-800 font-semibold">{p.veryGoodCount}</span>
                      <span className="text-slate-400 block text-[9px]">({p.veryGoodPct}%)</span>
                    </div>
                    <div className="p-1.5 bg-white rounded-lg border border-slate-100">
                      <span className="text-blue-700 font-bold block">Good</span>
                      <span className="text-slate-800 font-semibold">{p.goodCount}</span>
                      <span className="text-slate-400 block text-[9px]">({p.goodPct}%)</span>
                    </div>
                    <div className="p-1.5 bg-white rounded-lg border border-slate-100">
                      <span className="text-amber-700 font-bold block">Satisfactory</span>
                      <span className="text-slate-800 font-semibold">{p.satisfactoryCount}</span>
                      <span className="text-slate-400 block text-[9px]">({p.satisfactoryPct}%)</span>
                    </div>
                    <div className="p-1.5 bg-white rounded-lg border border-slate-100">
                      <span className="text-red-700 font-bold block">Unsat.</span>
                      <span className="text-slate-800 font-semibold">{p.unsatisfactoryCount}</span>
                      <span className="text-slate-400 block text-[9px]">({p.unsatisfactoryPct}%)</span>
                    </div>
                  </div>

                  {/* Factual Interpretation */}
                  <p className="text-[11px] text-slate-600 italic bg-white p-2 rounded-lg border border-slate-100">
                    &ldquo;{p.interpretation}&rdquo;
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
