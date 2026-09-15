'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Lock,
  Unlock,
  Gift,
  Shield,
  RefreshCw,
  Eye,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CreditCard,
  Phone,
  Save,
} from 'lucide-react';
import {
  getAdminBillingOverviewAction,
  approvePaymentAction,
  rejectPaymentAction,
  assignFreePlanAction,
  lockAdminAccessAction,
  unlockAdminAccessAction,
  revokeFormAccessAction,
  getPaymentProofUrlAction,
  updatePaymentSettingsAction,
  getPaymentSettingsAction,
} from '@/app/admin/billing/actions';
import type { PaymentSettings, Admin } from '@/types/database';

interface BillingOverviewItem {
  admin: Admin;
  billing: any;
  latestPaymentRequest: any;
  paymentRequests: any[];
}

export function BillingManagementTab({ currentUserEmail }: { currentUserEmail: string }) {
  const [data, setData] = useState<BillingOverviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [expandedAdmin, setExpandedAdmin] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: string; adminId: string; adminEmail: string; requestId?: string } | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [, setSettings] = useState<PaymentSettings | null>(null);
  const [settingsForm, setSettingsForm] = useState({
    upiId: '', accountName: '', bankName: '', accountNumber: '', ifscCode: '', supportPhone: '9470870830', paymentInstructions: '',
  });
  const [savingSettings, setSavingSettings] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const res = await getAdminBillingOverviewAction();
    if (res.success) setData(res.data as BillingOverviewItem[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    getPaymentSettingsAction().then(res => {
      if (res.success && res.settings) {
        setSettings(res.settings);
        setSettingsForm({
          upiId: res.settings.upi_id || '',
          accountName: res.settings.account_name || '',
          bankName: res.settings.bank_name || '',
          accountNumber: res.settings.account_number || '',
          ifscCode: res.settings.ifsc_code || '',
          supportPhone: res.settings.support_phone || '9470870830',
          paymentInstructions: res.settings.payment_instructions || '',
        });
      }
    });
  }, []);

  async function executeAction(action: () => Promise<{ success: boolean; message?: string; error?: string }>, successMsg?: string) {
    setActionLoading(confirmAction?.adminId || 'global');
    setConfirmAction(null);
    setRejectionReason('');
    try {
      const res = await action();
      setMessage({ text: res.success ? (res.message || successMsg || 'Done.') : (res.error || 'Action failed.'), type: res.success ? 'success' : 'error' });
      if (res.success) await loadData();
    } catch {
      setMessage({ text: 'Unexpected error.', type: 'error' });
    }
    setActionLoading(null);
    setTimeout(() => setMessage(null), 5000);
  }

  async function handleViewProof(proofPath: string) {
    const res = await getPaymentProofUrlAction(proofPath);
    if (res.success && res.url) {
      setProofUrl(res.url);
    }
  }

  async function handleSaveSettings() {
    setSavingSettings(true);
    const res = await updatePaymentSettingsAction(settingsForm);
    setMessage({ text: res.success ? 'Payment settings saved.' : (res.error || 'Save failed.'), type: res.success ? 'success' : 'error' });
    setSavingSettings(false);
    setTimeout(() => setMessage(null), 4000);
  }

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      UNLOCKED: { label: 'Unlocked', cls: 'bg-emerald-100 text-emerald-700' },
      LOCKED: { label: 'Locked', cls: 'bg-red-100 text-red-700' },
    };
    const cfg = map[status] || { label: status, cls: 'bg-slate-100 text-slate-700' };
    return <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${cfg.cls}`}>{cfg.label}</span>;
  };

  const getPlanBadge = (plan: string) => {
    const map: Record<string, string> = {
      FREE: 'bg-slate-100 text-slate-600',
      MONTHLY: 'bg-blue-100 text-blue-700',
      YEARLY: 'bg-amber-100 text-amber-700',
    };
    return <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${map[plan] || 'bg-slate-100 text-slate-600'}`}>{plan}</span>;
  };

  const getPaymentStatusBadge = (status: string) => {
    const map: Record<string, { cls: string }> = {
      PENDING: { cls: 'bg-amber-100 text-amber-700' },
      APPROVED: { cls: 'bg-emerald-100 text-emerald-700' },
      REJECTED: { cls: 'bg-red-100 text-red-700' },
    };
    const cfg = map[status] || { cls: 'bg-slate-100 text-slate-600' };
    return <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${cfg.cls}`}>{status}</span>;
  };

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4 animate-pulse">
        <div className="h-6 w-48 bg-slate-200 rounded-md" />
        <div className="h-64 bg-slate-50 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-bce-cobalt" />
            Billing & Access Management
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">{data.length} admins total</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSettings(!showSettings)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition">
            Payment Settings
          </button>
          <button onClick={loadData} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition">
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`rounded-lg p-3 text-xs flex items-center gap-2 ${message.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      {/* Payment Settings Panel */}
      {showSettings && (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-800">Payment Settings</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1 font-medium">UPI ID</label>
              <input type="text" value={settingsForm.upiId} onChange={e => setSettingsForm(s => ({ ...s, upiId: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-bce-cobalt/20" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1 font-medium">Account Holder Name</label>
              <input type="text" value={settingsForm.accountName} onChange={e => setSettingsForm(s => ({ ...s, accountName: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-bce-cobalt/20" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1 font-medium">Bank Name</label>
              <input type="text" value={settingsForm.bankName} onChange={e => setSettingsForm(s => ({ ...s, bankName: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-bce-cobalt/20" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1 font-medium">Account Number</label>
              <input type="text" value={settingsForm.accountNumber} onChange={e => setSettingsForm(s => ({ ...s, accountNumber: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-bce-cobalt/20" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1 font-medium">IFSC Code</label>
              <input type="text" value={settingsForm.ifscCode} onChange={e => setSettingsForm(s => ({ ...s, ifscCode: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-bce-cobalt/20" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1 font-medium flex items-center gap-1"><Phone className="w-3 h-3" /> Support Phone</label>
              <input type="text" value={settingsForm.supportPhone} onChange={e => setSettingsForm(s => ({ ...s, supportPhone: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-bce-cobalt/20" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1 font-medium">Payment Instructions</label>
            <textarea value={settingsForm.paymentInstructions} onChange={e => setSettingsForm(s => ({ ...s, paymentInstructions: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-bce-cobalt/20 h-20 resize-none" />
          </div>
          <button onClick={handleSaveSettings} disabled={savingSettings} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-bce-cobalt text-white text-sm font-medium hover:bg-bce-navy transition disabled:opacity-50">
            {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Settings
          </button>
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4">
            <div className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold text-sm">Confirm Action</h3>
            </div>
            <p className="text-xs text-slate-600">
              Are you sure you want to <strong>{confirmAction.type.replace(/_/g, ' ').toLowerCase()}</strong> for <strong>{confirmAction.adminEmail}</strong>?
            </p>
            {confirmAction.type === 'REJECT' && (
              <div>
                <label className="block text-xs text-slate-600 mb-1">Rejection Reason (optional)</label>
                <input type="text" value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} placeholder="e.g., Invalid UTR, wrong amount..." className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm" />
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setConfirmAction(null); setRejectionReason(''); }} className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">Cancel</button>
              <button
                onClick={() => {
                  if (confirmAction.type === 'APPROVE' && confirmAction.requestId) {
                    executeAction(() => approvePaymentAction(confirmAction.requestId!));
                  } else if (confirmAction.type === 'REJECT' && confirmAction.requestId) {
                    executeAction(() => rejectPaymentAction(confirmAction.requestId!, rejectionReason));
                  } else if (confirmAction.type === 'ASSIGN_FREE') {
                    executeAction(() => assignFreePlanAction(confirmAction.adminId));
                  } else if (confirmAction.type === 'LOCK') {
                    executeAction(() => lockAdminAccessAction(confirmAction.adminId));
                  } else if (confirmAction.type === 'UNLOCK') {
                    executeAction(() => unlockAdminAccessAction(confirmAction.adminId));
                  } else if (confirmAction.type === 'REVOKE') {
                    executeAction(() => revokeFormAccessAction(confirmAction.adminId));
                  }
                }}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-bce-cobalt text-white hover:bg-bce-navy"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Proof Viewer */}
      {proofUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setProofUrl(null)}>
          <div className="bg-white rounded-2xl p-4 max-w-lg w-full shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-semibold text-slate-800">Payment Proof</h3>
              <button onClick={() => setProofUrl(null)} className="text-xs text-slate-400 hover:text-slate-600">Close</button>
            </div>
            <Image src={proofUrl} alt="Payment proof" className="w-full rounded-lg border border-slate-200 max-h-96 object-contain" width={500} height={400} unoptimized />
          </div>
        </div>
      )}

      {/* Admin Billing Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Admin</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Access</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Plan</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Payment</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Valid Until</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map(item => {
                const isOwnRow = item.admin.email?.toLowerCase() === currentUserEmail.toLowerCase();
                const isSuperAdminRow = item.admin.role === 'SUPER_ADMIN';
                const isExpanded = expandedAdmin === item.admin.id;
                const accessStatus = item.billing?.access_status || 'LOCKED';
                const planType = item.billing?.plan_type || 'FREE';
                const latestReq = item.latestPaymentRequest;

                return (
                  <tr key={item.admin.id} className={`${isExpanded ? 'bg-slate-50/50' : 'hover:bg-slate-50/50'} transition-colors`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="font-semibold text-slate-800 flex items-center gap-1">
                            {item.admin.name}
                            {isSuperAdminRow && <Shield className="w-3 h-3 text-amber-500" />}
                          </p>
                          <p className="text-slate-400 font-mono text-[10px]">{item.admin.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {isSuperAdminRow ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-amber-100 text-amber-700">Always Unlocked</span>
                      ) : (
                        getStatusBadge(accessStatus)
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {getPlanBadge(planType)}
                    </td>
                    <td className="px-4 py-3">
                      {latestReq ? (
                        <div className="space-y-0.5">
                          {getPaymentStatusBadge(latestReq.status)}
                          <p className="text-[10px] text-slate-400">₹{latestReq.amount?.toLocaleString('en-IN')} • {latestReq.plan_type}</p>
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {item.billing?.expires_at ? (
                        <span className={`text-[11px] ${new Date(item.billing.expires_at) < new Date() ? 'text-red-500 font-semibold' : 'text-slate-600'}`}>
                          {new Date(item.billing.expires_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      ) : planType === 'FREE' && accessStatus === 'UNLOCKED' ? (
                        <span className="text-[11px] text-emerald-600">No Expiry</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isSuperAdminRow ? (
                        <span className="text-[10px] text-slate-400">Protected</span>
                      ) : (
                        <div className="flex items-center gap-1 justify-end flex-wrap">
                          {/* Approve/Reject pending requests */}
                          {latestReq?.status === 'PENDING' && (
                            <>
                              <button
                                disabled={!!actionLoading}
                                onClick={() => setConfirmAction({ type: 'APPROVE', adminId: item.admin.id, adminEmail: item.admin.email, requestId: latestReq.id })}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition disabled:opacity-50"
                              >
                                <CheckCircle2 className="w-3 h-3" /> Approve
                              </button>
                              <button
                                disabled={!!actionLoading}
                                onClick={() => setConfirmAction({ type: 'REJECT', adminId: item.admin.id, adminEmail: item.admin.email, requestId: latestReq.id })}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-red-100 text-red-700 hover:bg-red-200 transition disabled:opacity-50"
                              >
                                <XCircle className="w-3 h-3" /> Reject
                              </button>
                            </>
                          )}

                          {/* View proof */}
                          {latestReq?.payment_proof_url && (
                            <button
                              onClick={() => handleViewProof(latestReq.payment_proof_url)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
                            >
                              <Eye className="w-3 h-3" /> Proof
                            </button>
                          )}

                          {/* Quick actions */}
                          {accessStatus === 'LOCKED' && !isOwnRow && (
                            <>
                              <button
                                disabled={!!actionLoading}
                                onClick={() => setConfirmAction({ type: 'UNLOCK', adminId: item.admin.id, adminEmail: item.admin.email })}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 transition disabled:opacity-50"
                              >
                                <Unlock className="w-3 h-3" /> Unlock
                              </button>
                              <button
                                disabled={!!actionLoading}
                                onClick={() => setConfirmAction({ type: 'ASSIGN_FREE', adminId: item.admin.id, adminEmail: item.admin.email })}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition disabled:opacity-50"
                              >
                                <Gift className="w-3 h-3" /> Free
                              </button>
                            </>
                          )}

                          {accessStatus === 'UNLOCKED' && !isOwnRow && (
                            <>
                              <button
                                disabled={!!actionLoading}
                                onClick={() => setConfirmAction({ type: 'LOCK', adminId: item.admin.id, adminEmail: item.admin.email })}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-amber-100 text-amber-700 hover:bg-amber-200 transition disabled:opacity-50"
                              >
                                <Lock className="w-3 h-3" /> Lock
                              </button>
                              <button
                                disabled={!!actionLoading}
                                onClick={() => setConfirmAction({ type: 'REVOKE', adminId: item.admin.id, adminEmail: item.admin.email })}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-red-100 text-red-700 hover:bg-red-200 transition disabled:opacity-50"
                              >
                                <XCircle className="w-3 h-3" /> Revoke
                              </button>
                            </>
                          )}

                          {/* Expand history */}
                          <button
                            onClick={() => setExpandedAdmin(isExpanded ? null : item.admin.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
                          >
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            History
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Expanded Payment History */}
        {expandedAdmin && (() => {
          const item = data.find(d => d.admin.id === expandedAdmin);
          if (!item || !item.paymentRequests.length) return (
            <div className="border-t border-slate-200 p-4 text-xs text-slate-400">No payment history.</div>
          );
          return (
            <div className="border-t border-slate-200 bg-slate-50/50 p-4">
              <h4 className="text-xs font-semibold text-slate-700 mb-2">Payment History — {item.admin.email}</h4>
              <div className="space-y-2">
                {item.paymentRequests.map((req: any) => (
                  <div key={req.id} className="flex items-center justify-between bg-white rounded-lg border border-slate-100 px-3 py-2 text-[11px]">
                    <div className="flex items-center gap-3">
                      {getPaymentStatusBadge(req.status)}
                      <span className="text-slate-600">{req.plan_type} • ₹{req.amount?.toLocaleString('en-IN')}</span>
                      <span className="text-slate-400 font-mono">{req.payment_reference}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">{new Date(req.created_at).toLocaleDateString('en-IN')}</span>
                      {req.rejection_reason && <span className="text-red-500 italic">{req.rejection_reason}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
