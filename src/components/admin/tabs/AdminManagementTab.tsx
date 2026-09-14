'use client';

import { useState, useTransition } from 'react';
import {
  approveAdminRequestAction,
  rejectAdminRequestAction,
  toggleAdminStatusAction
} from '@/app/admin/actions';
import {
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Check,
  X,
  Power,
  Clock,
  AlertCircle,
  Loader2
} from 'lucide-react';
import type { Admin, AdminRequest } from '@/types/database';

interface Props {
  adminRequests: AdminRequest[];
  adminsList: Admin[];
  isSuperAdmin: boolean;
  currentUserEmail: string;
}

export function AdminManagementTab({
  adminRequests,
  adminsList,
  isSuperAdmin,
  currentUserEmail,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const pendingRequests = adminRequests.filter((r) => r.status === 'PENDING');
  const pastRequests = adminRequests.filter((r) => r.status !== 'PENDING');

  const handleApprove = (requestId: string) => {
    setActiveActionId(requestId);
    setMessage(null);
    startTransition(async () => {
      const res = await approveAdminRequestAction(requestId);
      if (res.success) {
        setMessage({ type: 'success', text: 'Admin request approved successfully.' });
      } else {
        setMessage({ type: 'error', text: res.error || 'Failed to approve request.' });
      }
      setActiveActionId(null);
    });
  };

  const handleReject = (requestId: string) => {
    if (!confirm('Are you sure you want to reject this admin request?')) return;
    setActiveActionId(requestId);
    setMessage(null);
    startTransition(async () => {
      const res = await rejectAdminRequestAction(requestId);
      if (res.success) {
        setMessage({ type: 'success', text: 'Admin request rejected.' });
      } else {
        setMessage({ type: 'error', text: res.error || 'Failed to reject request.' });
      }
      setActiveActionId(null);
    });
  };

  const handleToggleStatus = (targetAdmin: Admin) => {
    const nextStatus = targetAdmin.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const confirmText = `Change status of ${targetAdmin.email} to ${nextStatus}?`;
    if (!confirm(confirmText)) return;

    setActiveActionId(targetAdmin.id);
    setMessage(null);
    startTransition(async () => {
      const res = await toggleAdminStatusAction(targetAdmin.id, nextStatus);
      if (res.success) {
        setMessage({ type: 'success', text: `Admin status changed to ${nextStatus}.` });
      } else {
        setMessage({ type: 'error', text: res.error || 'Failed to update admin status.' });
      }
      setActiveActionId(null);
    });
  };

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-bce-cobalt" />
            Administrator Access & Authorization
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage admin registration requests, role privileges, and account activation states.
          </p>
        </div>

        {!isSuperAdmin && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Read-only: Super Admin permissions required to approve or modify admins.</span>
          </div>
        )}
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

      {/* 1. PENDING REQUESTS TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />
            <h4 className="text-sm font-bold text-slate-900">
              Pending Admin Access Requests ({pendingRequests.length})
            </h4>
          </div>
          <span className="text-xs text-slate-400">
            Awaiting Super Admin Review
          </span>
        </div>

        {pendingRequests.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No pending admin registration requests at this time.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-100 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">Applicant Name</th>
                  <th className="px-5 py-3">Email Address</th>
                  <th className="px-5 py-3">Request Date</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingRequests.map((req) => {
                  const isOperating = isPending && activeActionId === req.id;
                  return (
                    <tr key={req.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3.5 font-bold text-slate-800">
                        {req.name}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-slate-600">
                        {req.email}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500">
                        {new Date(req.created_at).toLocaleDateString()} at{' '}
                        {new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800">
                          PENDING
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right space-x-2">
                        {isSuperAdmin ? (
                          <>
                            <button
                              onClick={() => handleApprove(req.id)}
                              disabled={isOperating}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-colors disabled:opacity-50"
                            >
                              {isOperating ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                              <span>Approve</span>
                            </button>

                            <button
                              onClick={() => handleReject(req.id)}
                              disabled={isOperating}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold transition-colors disabled:opacity-50"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Reject</span>
                            </button>
                          </>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Approval restricted</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 2. REGISTERED ADMINISTRATORS DIRECTORY */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-bce-cobalt" />
            <h4 className="text-sm font-bold text-slate-900">
              Authorized Administrators ({adminsList.length})
            </h4>
          </div>
          <span className="text-xs text-slate-400">
            Active and Inactive Admin Accounts
          </span>
        </div>

        {adminsList.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No administrator accounts configured yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-100 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">Admin Name</th>
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Added Date</th>
                  <th className="px-5 py-3 text-right">Status Toggle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {adminsList.map((admin) => {
                  const isOperating = isPending && activeActionId === admin.id;
                  const isPrimarySuperAdmin = admin.email.toLowerCase() === 'iambestadi@gmail.com';
                  return (
                    <tr key={admin.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3.5 font-bold text-slate-800">
                        {admin.name}
                        {admin.email.toLowerCase() === currentUserEmail.toLowerCase() && (
                          <span className="ml-2 text-[10px] text-bce-cobalt font-semibold bg-blue-50 px-1.5 py-0.5 rounded">
                            (You)
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-slate-600">
                        {admin.email}
                      </td>
                      <td className="px-5 py-3.5">
                        {admin.role === 'SUPER_ADMIN' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                            <ShieldCheck className="w-3 h-3" /> SUPER ADMIN
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-100 text-blue-800">
                            ADMIN
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        {admin.status === 'ACTIVE' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                            ACTIVE
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-200 text-slate-700">
                            INACTIVE
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500">
                        {new Date(admin.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {isSuperAdmin ? (
                          isPrimarySuperAdmin ? (
                            <span className="text-[11px] text-slate-400 italic">Primary Super Admin</span>
                          ) : (
                            <button
                              onClick={() => handleToggleStatus(admin)}
                              disabled={isOperating}
                              className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-50 ${
                                admin.status === 'ACTIVE'
                                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300'
                              }`}
                            >
                              {isOperating ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Power className="w-3 h-3" />
                              )}
                              <span>{admin.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}</span>
                            </button>
                          )
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">Protected</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. PAST REVIEWED REQUESTS HISTORY */}
      {pastRequests.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Reviewed Requests History ({pastRequests.length})
            </h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                <tr>
                  <th className="px-5 py-2.5">Name</th>
                  <th className="px-5 py-2.5">Email</th>
                  <th className="px-5 py-2.5">Decision</th>
                  <th className="px-5 py-2.5">Reviewed Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                {pastRequests.map((req) => (
                  <tr key={req.id}>
                    <td className="px-5 py-2.5">{req.name}</td>
                    <td className="px-5 py-2.5 font-mono">{req.email}</td>
                    <td className="px-5 py-2.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                          req.status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {req.status}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-slate-400">
                      {req.reviewed_at ? new Date(req.reviewed_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
