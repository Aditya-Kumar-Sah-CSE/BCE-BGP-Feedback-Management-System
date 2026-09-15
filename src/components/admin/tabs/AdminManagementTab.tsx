'use client';

import { useState, useTransition } from 'react';
import {
  approveAdminRequestAction,
  rejectAdminRequestAction,
  revokeAdminAccessAction,
  reactivateAdminAccessAction,
} from '@/app/admin/actions';
import {
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserX,
  Check,
  X,
  Clock,
  AlertCircle,
  AlertTriangle,
  Loader2,
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

  // Modals for deliberate Super Admin confirmation
  const [revokingAdmin, setRevokingAdmin] = useState<Admin | null>(null);
  const [reactivatingAdmin, setReactivatingAdmin] = useState<Admin | null>(null);
  const [revokeReason, setRevokeReason] = useState<string>('');

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

  const confirmRevokeAccess = () => {
    if (!revokingAdmin) return;
    const targetId = revokingAdmin.id;
    const email = revokingAdmin.email;
    setActiveActionId(targetId);
    setMessage(null);

    startTransition(async () => {
      const res = await revokeAdminAccessAction(targetId, revokeReason.trim() || undefined);
      if (res.success) {
        setMessage({
          type: 'success',
          text: `Administrator access for ${email} has been revoked. The account is now INACTIVE.`,
        });
      } else {
        setMessage({ type: 'error', text: res.error || 'Failed to revoke administrator access.' });
      }
      setActiveActionId(null);
      setRevokingAdmin(null);
      setRevokeReason('');
    });
  };

  const confirmReactivateAccess = () => {
    if (!reactivatingAdmin) return;
    const targetId = reactivatingAdmin.id;
    const email = reactivatingAdmin.email;
    setActiveActionId(targetId);
    setMessage(null);

    startTransition(async () => {
      const res = await reactivateAdminAccessAction(targetId);
      if (res.success) {
        setMessage({
          type: 'success',
          text: `Administrator access for ${email} has been restored. The account is now ACTIVE.`,
        });
      } else {
        setMessage({ type: 'error', text: res.error || 'Failed to reactivate administrator access.' });
      }
      setActiveActionId(null);
      setReactivatingAdmin(null);
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
                  <th className="px-5 py-3 text-right">Access Control</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {adminsList.map((admin) => {
                  const isOperating = isPending && activeActionId === admin.id;
                  const isPrimarySuperAdmin = admin.email.toLowerCase() === 'iambestadi@gmail.com';
                  const isSelf = admin.email.toLowerCase() === currentUserEmail.toLowerCase();

                  return (
                    <tr key={admin.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3.5 font-bold text-slate-800">
                        {admin.name}
                        {isSelf && (
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
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800">
                            REVOKED / INACTIVE
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
                          ) : isSelf ? (
                            <span className="text-[11px] text-slate-400 italic">Current Session</span>
                          ) : admin.role === 'ADMIN' ? (
                            admin.status === 'ACTIVE' ? (
                              <button
                                onClick={() => {
                                  setRevokingAdmin(admin);
                                  setRevokeReason('');
                                }}
                                disabled={isOperating}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 shadow-2xs hover:shadow-xs disabled:opacity-50 cursor-pointer"
                              >
                                {isOperating ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <UserX className="w-3.5 h-3.5 text-rose-600" />
                                )}
                                <span>Revoke Access</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => setReactivatingAdmin(admin)}
                                disabled={isOperating}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 shadow-2xs hover:shadow-xs disabled:opacity-50 cursor-pointer"
                              >
                                {isOperating ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                                )}
                                <span>Reactivate Access</span>
                              </button>
                            )
                          ) : (
                            <span className="text-slate-400 text-[11px] italic">Protected Super Admin</span>
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

      {/* Confirmation Dialog: Revoke Admin Access */}
      {revokingAdmin && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-100 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-slate-900">
                  Revoke admin access?
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Admin access will be disabled immediately. Existing academic/content data will not be deleted.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Administrator:</span>
                <span className="font-semibold text-slate-800">{revokingAdmin.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Email:</span>
                <span className="font-mono text-slate-700">{revokingAdmin.email}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider">
                Reason for revocation (optional)
              </label>
              <input
                type="text"
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="e.g., Role reassignment, suspension"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setRevokingAdmin(null)}
                disabled={isPending}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRevokeAccess}
                disabled={isPending}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 transition-colors shadow-sm cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Revoke Access</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog: Reactivate Admin Access */}
      {reactivatingAdmin && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
                <UserCheck className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-slate-900">
                  Reactivate admin access?
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Administrator access will be restored immediately for this account.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Administrator:</span>
                <span className="font-semibold text-slate-800">{reactivatingAdmin.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Email:</span>
                <span className="font-mono text-slate-700">{reactivatingAdmin.email}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setReactivatingAdmin(null)}
                disabled={isPending}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmReactivateAccess}
                disabled={isPending}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-sm cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Reactivate Access</span>
              </button>
            </div>
          </div>
        </div>
      )}

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
