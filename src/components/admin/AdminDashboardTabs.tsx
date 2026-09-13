'use client';

import { useState } from 'react';
import { OverviewTab } from './tabs/OverviewTab';
import { AdminManagementTab } from './tabs/AdminManagementTab';
import { AcademicManagementTab } from './tabs/AcademicManagementTab';
import { FeedbackFormsTab } from './tabs/FeedbackFormsTab';
import { AuditLogsTab } from './tabs/AuditLogsTab';
import {
  LayoutDashboard,
  ShieldCheck,
  GraduationCap,
  FileSpreadsheet,
  Activity
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
