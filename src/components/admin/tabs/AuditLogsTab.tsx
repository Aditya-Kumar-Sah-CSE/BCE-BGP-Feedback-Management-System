'use client';

import { useState } from 'react';
import { Activity, Search } from 'lucide-react';
import type { AuditLog } from '@/types/database';
import { useHydrated, formatDateShort, formatTime } from '@/lib/hooks/use-hydrated';

interface Props {
  auditLogs: AuditLog[];
}

export function AuditLogsTab({ auditLogs }: Props) {
  const hydrated = useHydrated();
  const [search, setSearch] = useState('');
  const [selectedAction, setSelectedAction] = useState('ALL');

  const actionTypes = Array.from(new Set(auditLogs.map((l) => l.action)));

  const filteredLogs = auditLogs.filter((log) => {
    const matchesSearch =
      (log.action?.toLowerCase() || '').includes(search.toLowerCase()) ||
      (log.details?.toLowerCase() || '').includes(search.toLowerCase()) ||
      (log.actor_email?.toLowerCase() || '').includes(search.toLowerCase()) ||
      (log.entity_type?.toLowerCase() || '').includes(search.toLowerCase());

    const matchesAction = selectedAction === 'ALL' || log.action === selectedAction;

    return matchesSearch && matchesAction;
  });

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-full min-w-0">
      {/* Header & Filters */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-bce-cobalt shrink-0" />
              Administrative Audit Trail
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Tamper-evident chronological log of all administrative modifications and approvals.
            </p>
          </div>
          <div className="text-xs font-mono text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 self-start sm:self-auto">
            {filteredLogs.length} of {auditLogs.length} entries shown
          </div>
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="sm:col-span-2 relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by admin email, action name, or details..."
              className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-xs min-h-[42px] sm:min-h-[38px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20"
            />
          </div>

          <div className="relative">
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-xs min-h-[42px] sm:min-h-[38px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20"
            >
              <option value="ALL">All Event Types</option>
              {actionTypes.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Logs Table (Desktop) & Cards (Mobile) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden w-full min-w-0">
        {filteredLogs.length === 0 ? (
          <div className="p-8 sm:p-12 text-center text-xs text-slate-400">
            No audit records match the current filter criteria.
          </div>
        ) : (
          <>
            {/* Mobile Card List */}
            <div className="divide-y divide-slate-100 md:hidden min-w-0">
              {filteredLogs.map((log) => (
                <div key={log.id} className="p-3.5 sm:p-4 space-y-2 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap min-w-0">
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-mono text-[11px] font-bold break-all">
                      {log.action}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono shrink-0 ml-auto sm:ml-0">
                      {formatDateShort(log.created_at, hydrated)}{' '}
                      {formatTime(log.created_at, hydrated)}
                    </span>
                  </div>
                  <div className="text-xs font-mono text-slate-700 font-medium truncate">
                    👤 {log.actor_email || 'System'}
                  </div>
                  {log.entity_type && (
                    <div className="text-[11px] text-slate-500 font-mono">
                      Entity: <span className="font-semibold text-slate-700">{log.entity_type}</span>
                    </div>
                  )}
                  {log.details && (
                    <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100 leading-relaxed break-words [overflow-wrap:anywhere]">
                      {log.details}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-100 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3">Timestamp</th>
                    <th className="px-5 py-3">Actor / Admin</th>
                    <th className="px-5 py-3">Action</th>
                    <th className="px-5 py-3">Entity Type</th>
                    <th className="px-5 py-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">
                        {formatDateShort(log.created_at, hydrated)}{' '}
                        <span className="text-slate-400 font-mono">
                          {formatTime(log.created_at, hydrated)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-slate-700 font-medium">
                        {log.actor_email || 'System'}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-mono text-[11px] font-bold">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 font-mono text-[11px]">
                        {log.entity_type || '—'}
                      </td>
                      <td className="px-5 py-3.5 text-slate-700 max-w-md break-words [overflow-wrap:anywhere]">
                        {log.details || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
