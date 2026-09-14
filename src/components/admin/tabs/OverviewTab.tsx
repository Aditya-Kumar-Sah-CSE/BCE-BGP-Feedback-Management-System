'use client';

import {
  Calendar,
  Layers,
  BookOpen,
  Users,
  GraduationCap,
  FileSpreadsheet,
  Clock,
  ShieldCheck,
  Activity
} from 'lucide-react';
import type {
  AcademicYear,
  Branch,
  Semester,
  Faculty,
  Subject,
  FacultySubjectAssignment,
  AdminRequest,
  FeedbackForm,
  AuditLog
} from '@/types/database';

export interface DashboardCounts {
  totalFaculties?: number;
  activeFaculties?: number;
  totalSubjects?: number;
  activeSubjects?: number;
  totalAssignments?: number;
  totalForms?: number;
  publishedForms?: number;
}

interface Props {
  academicYears: AcademicYear[];
  branches: Branch[];
  semesters: Semester[];
  faculties: Faculty[];
  subjects: Subject[];
  assignments: FacultySubjectAssignment[];
  adminRequests: AdminRequest[];
  feedbackForms: FeedbackForm[];
  auditLogs: AuditLog[];
  isSuperAdmin: boolean;
  onNavigateTab: (tab: string) => void;
  counts?: DashboardCounts;
}

export function OverviewTab({
  academicYears,
  branches,
  semesters,
  faculties,
  subjects,
  assignments,
  adminRequests,
  feedbackForms,
  auditLogs,
  isSuperAdmin,
  onNavigateTab,
  counts,
}: Props) {
  const pendingRequestsCount = adminRequests.filter((r) => r.status === 'PENDING').length;
  const activeYearsCount = academicYears.filter((y) => y.is_active).length;
  const activeBranchesCount = branches.filter((b) => b.is_active).length;
  const activeSemestersCount = semesters.filter((s) => s.is_active).length;

  const totalFaculties = counts?.totalFaculties ?? faculties.length;
  const activeFacultiesCount = counts?.activeFaculties ?? faculties.filter((f) => f.is_active).length;

  const totalSubjects = counts?.totalSubjects ?? subjects.length;
  const activeSubjectsCount = counts?.activeSubjects ?? subjects.filter((s) => s.is_active).length;

  const totalAssignments = counts?.totalAssignments ?? assignments.length;

  const totalForms = counts?.totalForms ?? feedbackForms.length;
  const publishedFormsCount = counts?.publishedForms ?? feedbackForms.filter((f) => f.status === 'PUBLISHED').length;

  const stats = [
    {
      title: 'Faculties',
      value: totalFaculties,
      subtitle: `${activeFacultiesCount} active`,
      icon: Users,
      color: 'from-blue-600 to-indigo-600',
      tab: 'academic',
    },
    {
      title: 'Subjects',
      value: totalSubjects,
      subtitle: `${activeSubjectsCount} active`,
      icon: BookOpen,
      color: 'from-violet-600 to-purple-600',
      tab: 'academic',
    },
    {
      title: 'Branches / Depts',
      value: branches.length,
      subtitle: `${activeBranchesCount} active • ${activeSemestersCount} semesters`,
      icon: Layers,
      color: 'from-emerald-600 to-teal-600',
      tab: 'academic',
    },
    {
      title: 'Academic Years',
      value: academicYears.length,
      subtitle: `${activeYearsCount} active session`,
      icon: Calendar,
      color: 'from-amber-500 to-orange-600',
      tab: 'academic',
    },
    {
      title: 'Faculty Assignments',
      value: totalAssignments,
      subtitle: 'Mapped to subjects',
      icon: GraduationCap,
      color: 'from-cyan-600 to-blue-600',
      tab: 'academic',
    },
    {
      title: 'Feedback Forms',
      value: totalForms,
      subtitle: `${publishedFormsCount} published`,
      icon: FileSpreadsheet,
      color: 'from-pink-600 to-rose-600',
      tab: 'forms',
    },
    {
      title: 'Pending Admin Requests',
      value: pendingRequestsCount,
      subtitle: pendingRequestsCount > 0 ? 'Requires attention' : 'All reviewed',
      icon: Clock,
      color: pendingRequestsCount > 0 ? 'from-amber-500 to-red-500' : 'from-slate-600 to-slate-700',
      tab: 'admins',
      alert: pendingRequestsCount > 0,
    },
    {
      title: 'Audit Logs',
      value: auditLogs.length,
      subtitle: 'Tracked administrative actions',
      icon: Activity,
      color: 'from-slate-700 to-slate-800',
      tab: 'audit',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Super Admin Alert if Pending Requests */}
      {isSuperAdmin && pendingRequestsCount > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-950">
                {pendingRequestsCount} Pending Administrator {pendingRequestsCount === 1 ? 'Request' : 'Requests'}
              </p>
              <p className="text-xs text-amber-800">
                New faculty accounts are waiting for Super Admin authorization.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('admins')}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-xs rounded-xl shadow-xs transition-colors shrink-0"
          >
            Review Requests →
          </button>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((item, idx) => {
          const Icon = item.icon;
          return (
            <button
              key={idx}
              onClick={() => onNavigateTab(item.tab)}
              className="text-left bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between group"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {item.title}
                  </p>
                  <p className="text-2xl font-extrabold text-slate-900 mt-1">
                    {item.value}
                  </p>
                </div>
                <div
                  className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${item.color} text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform`}
                >
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>{item.subtitle}</span>
                <span className="text-bce-cobalt font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                  Manage →
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Quick Launch & Recent Activity Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Launch Actions */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-bce-cobalt" />
            Quick Administration
          </h3>
          <p className="text-xs text-slate-500">
            Frequently performed Phase 1 foundation tasks.
          </p>

          <div className="space-y-2.5 pt-1">
            <button
              onClick={() => onNavigateTab('academic')}
              className="w-full text-left p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 transition-colors flex items-center justify-between"
            >
              <div>
                <p className="text-xs font-bold text-slate-800">Add Faculty Member</p>
                <p className="text-[11px] text-slate-500">Register new professors & lecturers</p>
              </div>
              <span className="text-xs text-bce-cobalt font-semibold">Open →</span>
            </button>

            <button
              onClick={() => onNavigateTab('academic')}
              className="w-full text-left p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 transition-colors flex items-center justify-between"
            >
              <div>
                <p className="text-xs font-bold text-slate-800">Assign Subject to Faculty</p>
                <p className="text-[11px] text-slate-500">Map faculty to session and branch</p>
              </div>
              <span className="text-xs text-bce-cobalt font-semibold">Open →</span>
            </button>

            <button
              onClick={() => onNavigateTab('forms')}
              className="w-full text-left p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 transition-colors flex items-center justify-between"
            >
              <div>
                <p className="text-xs font-bold text-slate-800">Prepare Feedback Forms</p>
                <p className="text-[11px] text-slate-500">View or toggle published status</p>
              </div>
              <span className="text-xs text-bce-cobalt font-semibold">Open →</span>
            </button>
          </div>
        </div>

        {/* Recent Audit Timeline Preview */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-bce-cobalt" />
              Recent Administrative Activity
            </h3>
            <button
              onClick={() => onNavigateTab('audit')}
              className="text-xs font-semibold text-bce-cobalt hover:underline"
            >
              View Full Audit Log →
            </button>
          </div>

          {auditLogs.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              No audit activities recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {auditLogs.slice(0, 5).map((log) => (
                <div key={log.id} className="py-3 flex items-start justify-between gap-4 text-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800">{log.action}</span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-mono">
                        {log.entity_type || 'system'}
                      </span>
                    </div>
                    <p className="text-slate-600">{log.details}</p>
                    <p className="text-[11px] text-slate-400 font-mono">
                      By: {log.actor_email || 'System'}
                    </p>
                  </div>
                  <span className="text-[11px] text-slate-400 whitespace-nowrap">
                    {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
