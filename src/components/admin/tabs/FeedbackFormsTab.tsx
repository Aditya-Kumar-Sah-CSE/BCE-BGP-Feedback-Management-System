'use client';

import { useState, useTransition } from 'react';
import {
  createFeedbackFormDraftAction,
  toggleFeedbackFormStatusAction
} from '@/app/admin/actions';
import {
  FileSpreadsheet,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  Info
} from 'lucide-react';
import type {
  FeedbackForm,
  AcademicYear,
  Branch,
  Semester,
  Faculty,
  Subject
} from '@/types/database';

interface Props {
  feedbackForms: FeedbackForm[];
  academicYears: AcademicYear[];
  branches: Branch[];
  semesters: Semester[];
  faculties: Faculty[];
  subjects: Subject[];
}

export function FeedbackFormsTab({
  feedbackForms,
  academicYears,
  branches,
  semesters,
  faculties,
  subjects,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [selectedYearId, setSelectedYearId] = useState(academicYears.find(y => y.is_active)?.id || academicYears[0]?.id || '');
  const [selectedBranchId, setSelectedBranchId] = useState(branches[0]?.id || '');
  const [selectedSemesterId, setSelectedSemesterId] = useState(semesters[0]?.id || '');
  const [selectedFacultyId, setSelectedFacultyId] = useState(faculties[0]?.id || '');
  const [selectedSubjectId, setSelectedSubjectId] = useState(subjects[0]?.id || '');

  const handleCreateDraft = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    const activeFac = faculties.find(f => f.id === selectedFacultyId);
    const activeSub = subjects.find(s => s.id === selectedSubjectId);
    const formTitle = title.trim() || `${activeFac?.name || 'Faculty'} - ${activeSub?.name || 'Subject'} Feedback`;

    startTransition(async () => {
      const res = await createFeedbackFormDraftAction({
        title: formTitle,
        academic_year_id: selectedYearId,
        branch_id: selectedBranchId,
        semester_id: selectedSemesterId,
        faculty_id: selectedFacultyId,
        subject_id: selectedSubjectId,
      });

      if (res.success) {
        setMessage({ type: 'success', text: `Feedback Form foundation record created: ${formTitle}` });
        setTitle('');
        setShowCreateModal(false);
      } else {
        setMessage({ type: 'error', text: res.error || 'Failed to create form.' });
      }
    });
  };

  const handleToggleStatus = (form: FeedbackForm) => {
    const nextStatus = form.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    startTransition(async () => {
      const res = await toggleFeedbackFormStatusAction(form.id, nextStatus);
      if (res.success) {
        setMessage({ type: 'success', text: `Form status updated to ${nextStatus}.` });
      } else {
        setMessage({ type: 'error', text: res.error || 'Failed to update status.' });
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-bce-cobalt" />
            Feedback Forms Management (Phase 1 Foundation)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Database schema & administrative publishing foundation prepared for Phase 2 Google Forms integration.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-bce-cobalt hover:bg-bce-navy text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Prepare Feedback Form</span>
        </button>
      </div>

      {/* Phase Boundary Note */}
      <div className="p-4 bg-blue-50/70 border border-blue-200/80 rounded-2xl flex items-start gap-3 text-xs text-blue-950">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold">Phase 1 Boundary Notice</p>
          <p className="text-blue-900/80 mt-0.5">
            Phase 1 provides the data foundation, discovery links, and publishing status workflow. Google Forms API, Google Sheets responses syncing, and analytics will be connected in Phase 2.
          </p>
        </div>
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

      {/* Forms List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-900">Configured Feedback Forms ({feedbackForms.length})</h4>
          <span className="text-xs text-slate-400">
            {feedbackForms.filter(f => f.status === 'PUBLISHED').length} Published
          </span>
        </div>

        {feedbackForms.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-800">No Feedback Forms Created Yet</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Click &quot;Prepare Feedback Form&quot; above to create a foundation record for any faculty member and subject.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-100 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">Form Title</th>
                  <th className="px-5 py-3">Faculty</th>
                  <th className="px-5 py-3">Subject</th>
                  <th className="px-5 py-3">Branch & Sem</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Publishing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {feedbackForms.map((form) => {
                  const faculty = faculties.find(f => f.id === form.faculty_id) || form.faculty;
                  const subject = subjects.find(s => s.id === form.subject_id) || form.subject;
                  const branch = branches.find(b => b.id === form.branch_id);
                  const semester = semesters.find(s => s.id === form.semester_id);
                  const isPublished = form.status === 'PUBLISHED';

                  return (
                    <tr key={form.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3.5 font-bold text-slate-800">
                        {form.title}
                        {form.slug && (
                          <span className="block font-mono text-[10px] text-slate-400 font-normal">
                            /{form.slug}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 font-medium text-slate-700">
                        {faculty?.name || 'Faculty'}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">
                        {subject?.name || 'Subject'} {subject?.code ? `(${subject.code})` : ''}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500">
                        {branch?.code || 'Branch'} • {semester?.name || 'Sem'}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                            isPublished
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {isPublished ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                          {form.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => handleToggleStatus(form)}
                          disabled={isPending}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                            isPublished
                              ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          }`}
                        >
                          {isPublished ? 'Unpublish' : 'Publish'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-base font-bold text-slate-900">Prepare Feedback Form (Foundation)</h4>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateDraft} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Form Title (Optional)</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Auto-generated if left blank"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Academic Session</label>
                  <select
                    value={selectedYearId}
                    onChange={(e) => setSelectedYearId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900"
                  >
                    {academicYears.map((y) => (
                      <option key={y.id} value={y.id}>{y.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Branch</label>
                  <select
                    value={selectedBranchId}
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Semester</label>
                  <select
                    value={selectedSemesterId}
                    onChange={(e) => setSelectedSemesterId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900"
                  >
                    {semesters.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Faculty</label>
                  <select
                    value={selectedFacultyId}
                    onChange={(e) => setSelectedFacultyId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900"
                  >
                    {faculties.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Subject</label>
                <select
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                  ))}
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-bce-cobalt hover:bg-bce-navy transition-colors disabled:opacity-50"
                >
                  {isPending ? 'Saving...' : 'Create Foundation Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
