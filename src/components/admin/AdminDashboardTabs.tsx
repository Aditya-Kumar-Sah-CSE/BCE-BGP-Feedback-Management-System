'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { OverviewTab, type DashboardCounts } from './tabs/OverviewTab';
import Link from 'next/link';
import {
  LayoutDashboard,
  ShieldCheck,
  GraduationCap,
  FileSpreadsheet,
  Activity,
  BarChart3,
} from 'lucide-react';
import type {
  AcademicYear,
  Branch,
  Semester,
  Faculty,
  Subject,
  FacultySubjectAssignment,
  Admin,
  AdminRequest,
  FeedbackForm,
  AuditLog
} from '@/types/database';

function TabLoadingSkeleton({ title: _title }: { title?: string }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-6 w-48 bg-slate-200 rounded-md" />
        <div className="h-8 w-28 bg-slate-200 rounded-xl" />
      </div>
      <div className="h-4 w-72 bg-slate-100 rounded-md" />
      <div className="pt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="h-20 bg-slate-100 rounded-xl" />
        <div className="h-20 bg-slate-100 rounded-xl" />
        <div className="h-20 bg-slate-100 rounded-xl" />
      </div>
      <div className="h-64 bg-slate-50 rounded-xl border border-slate-100" />
    </div>
  );
}

const AcademicManagementTab = dynamic(
  () => import('./tabs/AcademicManagementTab').then((mod) => mod.AcademicManagementTab),
  {
    loading: () => <TabLoadingSkeleton title="Academic Management" />,
  }
);
const FeedbackFormsTab = dynamic(
  () => import('./tabs/FeedbackFormsTab').then((mod) => mod.FeedbackFormsTab),
  {
    loading: () => <TabLoadingSkeleton title="Feedback Forms" />,
  }
);
const AdminManagementTab = dynamic(
  () => import('./tabs/AdminManagementTab').then((mod) => mod.AdminManagementTab),
  {
    loading: () => <TabLoadingSkeleton title="Admin Management" />,
  }
);
const AuditLogsTab = dynamic(
  () => import('./tabs/AuditLogsTab').then((mod) => mod.AuditLogsTab),
  {
    loading: () => <TabLoadingSkeleton title="Audit Trail" />,
  }
);

interface Props {
  academicYears: AcademicYear[];
  branches: Branch[];
  semesters: Semester[];
  faculties: Faculty[];
  subjects: Subject[];
  assignments: FacultySubjectAssignment[];
  adminRequests: AdminRequest[];
  adminsList: Admin[];
  feedbackForms: FeedbackForm[];
  auditLogs: AuditLog[];
  isSuperAdmin: boolean;
  currentUserEmail: string;
  counts?: DashboardCounts;
}

export function AdminDashboardTabs({
  academicYears,
  branches,
  semesters,
  faculties,
  subjects,
  assignments,
  adminRequests,
  adminsList,
  feedbackForms,
  auditLogs,
  isSuperAdmin,
  currentUserEmail,
  counts,
}: Props) {
  const [activeTab, setActiveTab] = useState<'overview' | 'admins' | 'academic' | 'forms' | 'audit'>('overview');

  const pendingRequestsCount = adminRequests.filter((r) => r.status === 'PENDING').length;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    {
      id: 'admins',
      label: 'Admin Management',
      icon: ShieldCheck,
      badge: pendingRequestsCount > 0 ? pendingRequestsCount : undefined,
    },
    { id: 'academic', label: 'Academic Structure', icon: GraduationCap },
    { id: 'forms', label: 'Feedback Forms', icon: FileSpreadsheet },
    { id: 'audit', label: 'Audit Trail', icon: Activity },
  ];

  return (
    <div className="space-y-6">
      {/* Primary Navigation Tabs */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-1.5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`relative inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                isActive
                  ? 'bg-bce-navy text-amber-400 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-amber-500 text-slate-950">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}

        <Link
          href="/admin/dashboard/results"
          className="relative inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-slate-700 hover:text-slate-950 hover:bg-amber-50/80 border border-amber-200/70 transition-all ml-auto"
        >
          <BarChart3 className="w-4 h-4 text-bce-cobalt" />
          <span>Results & Analytics Hub</span>
          <span className="text-[10px] font-extrabold uppercase bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded-full shadow-2xs">
            Phase 4
          </span>
        </Link>
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === 'overview' && (
          <OverviewTab
            academicYears={academicYears}
            branches={branches}
            semesters={semesters}
            faculties={faculties}
            subjects={subjects}
            assignments={assignments}
            adminRequests={adminRequests}
            feedbackForms={feedbackForms}
            auditLogs={auditLogs}
            isSuperAdmin={isSuperAdmin}
            onNavigateTab={(tab) => setActiveTab(tab as any)}
            counts={counts}
          />
        )}

        {activeTab === 'admins' && (
          <AdminManagementTab
            adminRequests={adminRequests}
            adminsList={adminsList}
            isSuperAdmin={isSuperAdmin}
            currentUserEmail={currentUserEmail}
          />
        )}

        {activeTab === 'academic' && (
          <AcademicManagementTab
            academicYears={academicYears}
            branches={branches}
            semesters={semesters}
            faculties={faculties}
            subjects={subjects}
            assignments={assignments}
            initialFacultyTotal={counts?.totalFaculties}
            initialSubjectTotal={counts?.totalSubjects}
            initialAssignmentTotal={counts?.totalAssignments}
          />
        )}

        {activeTab === 'forms' && (
          <FeedbackFormsTab
            feedbackForms={feedbackForms}
            academicYears={academicYears}
            branches={branches}
            semesters={semesters}
            faculties={faculties}
            subjects={subjects}
          />
        )}

        {activeTab === 'audit' && (
          <AuditLogsTab auditLogs={auditLogs} />
        )}
      </div>
    </div>
  );
}
