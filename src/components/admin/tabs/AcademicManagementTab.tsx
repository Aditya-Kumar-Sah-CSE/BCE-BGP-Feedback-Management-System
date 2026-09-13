'use client';

import { useState, useTransition } from 'react';
import {
  createAcademicYearAction,
  updateAcademicYearAction,
  createBranchAction,
  updateBranchAction,
  updateSemesterAction,
  createFacultyAction,
  updateFacultyAction,
  createSubjectAction,
  updateSubjectAction,
  createAssignmentAction,
  deleteAssignmentAction,
} from '@/app/admin/actions';
import {
  Calendar,
  Layers,
  BookOpen,
  Users,
  GraduationCap,
  Plus,
  Trash2,
  AlertCircle,
  Loader2,
  Building2
} from 'lucide-react';
import type {
  AcademicYear,
  Branch,
  Semester,
  Faculty,
  Subject,
  FacultySubjectAssignment
} from '@/types/database';

interface Props {
  academicYears: AcademicYear[];
  branches: Branch[];
  semesters: Semester[];
  faculties: Faculty[];
  subjects: Subject[];
  assignments: FacultySubjectAssignment[];
}

export function AcademicManagementTab({
  academicYears,
  branches,
  semesters,
  faculties,
  subjects,
  assignments,
}: Props) {
  const [activeSubTab, setActiveSubTab] = useState<'faculties' | 'subjects' | 'assignments' | 'years' | 'branches' | 'semesters'>('faculties');
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form states
  // 1. Faculty form
  const [facName, setFacName] = useState('');
  const [facDept, setFacDept] = useState('Computer Science & Engineering');
  const [facDesig, setFacDesig] = useState('Assistant Professor');
  const [facEmpId, setFacEmpId] = useState('');

  // 2. Subject form
  const [subName, setSubName] = useState('');
  const [subCode, setSubCode] = useState('');
  const [subBranchId, setSubBranchId] = useState(branches[0]?.id || '');
  const [subSemesterId, setSubSemesterId] = useState(semesters[0]?.id || '');

  // 3. Assignment form
  const [assignFacultyId, setAssignFacultyId] = useState(faculties[0]?.id || '');
  const [assignSubjectId, setAssignSubjectId] = useState(subjects[0]?.id || '');
  const [assignYearId, setAssignYearId] = useState(academicYears.find(y => y.is_active)?.id || academicYears[0]?.id || '');
  const [assignBranchId, setAssignBranchId] = useState(branches[0]?.id || '');
  const [assignSemesterId, setAssignSemesterId] = useState(semesters[0]?.id || '');

  // 4. Year form
  const [yearName, setYearName] = useState('');
  const [yearActive, setYearActive] = useState(true);

  // 5. Branch form
  const [branchName, setBranchName] = useState('');
  const [branchCode, setBranchCode] = useState('');

  // Handlers
  const handleCreateFaculty = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const res = await createFacultyAction({
        name: facName,
        department: facDept,
        designation: facDesig,
        employee_id: facEmpId || undefined,
        is_active: true,
      });
      if (res.success) {
        setMessage({ type: 'success', text: `Faculty ${facName} added successfully.` });
        setFacName('');
        setFacEmpId('');
      } else {
        setMessage({ type: 'error', text: res.error || 'Failed to create faculty.' });
      }
    });
  };

  const handleCreateSubject = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const res = await createSubjectAction({
        name: subName,
        code: subCode,
        branch_id: subBranchId || undefined,
        semester_id: subSemesterId || undefined,
        is_active: true,
      });
      if (res.success) {
        setMessage({ type: 'success', text: `Subject ${subName} (${subCode}) added successfully.` });
        setSubName('');
        setSubCode('');
      } else {
        setMessage({ type: 'error', text: res.error || 'Failed to create subject.' });
      }
    });
  };

  const handleCreateAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!assignFacultyId || !assignSubjectId || !assignYearId) {
      setMessage({ type: 'error', text: 'Please select faculty, subject, and session.' });
      return;
    }
    startTransition(async () => {
      const res = await createAssignmentAction({
        faculty_id: assignFacultyId,
        subject_id: assignSubjectId,
        academic_year_id: assignYearId,
        branch_id: assignBranchId || undefined,
        semester_id: assignSemesterId || undefined,
        is_active: true,
      });
      if (res.success) {
        setMessage({ type: 'success', text: 'Faculty assignment created successfully.' });
      } else {
        setMessage({ type: 'error', text: res.error || 'Failed to create assignment.' });
      }
    });
  };

  const handleDeleteAssignment = (id: string) => {
    if (!confirm('Are you sure you want to remove this faculty assignment?')) return;
    setMessage(null);
    startTransition(async () => {
      const res = await deleteAssignmentAction(id);
      if (res.success) {
        setMessage({ type: 'success', text: 'Assignment removed.' });
      } else {
        setMessage({ type: 'error', text: res.error || 'Failed to remove assignment.' });
      }
    });
  };

  const handleCreateYear = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const res = await createAcademicYearAction({ name: yearName, is_active: yearActive });
      if (res.success) {
        setMessage({ type: 'success', text: `Academic Year ${yearName} added.` });
        setYearName('');
      } else {
        setMessage({ type: 'error', text: res.error || 'Failed to add year.' });
      }
    });
  };

  const handleCreateBranch = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const res = await createBranchAction({ name: branchName, code: branchCode, is_active: true });
      if (res.success) {
        setMessage({ type: 'success', text: `Branch ${branchName} (${branchCode}) created.` });
        setBranchName('');
        setBranchCode('');
      } else {
        setMessage({ type: 'error', text: res.error || 'Failed to add branch.' });
      }
    });
  };

  const handleToggleFacultyActive = (f: Faculty) => {
    startTransition(async () => {
      await updateFacultyAction(f.id, {
        name: f.name,
        department: f.department,
        designation: f.designation,
        employee_id: f.employee_id || undefined,
        is_active: !f.is_active,
      });
    });
  };

  const handleToggleSubjectActive = (s: Subject) => {
    startTransition(async () => {
      await updateSubjectAction(s.id, {
        name: s.name,
        code: s.code,
        branch_id: s.branch_id || undefined,
        semester_id: s.semester_id || undefined,
        is_active: !s.is_active,
      });
    });
  };

  return (
    <div className="space-y-6">
      {/* Sub-Navigation Tabs */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap gap-1.5">
        {[
          { id: 'faculties', label: `Faculties (${faculties.length})`, icon: Users },
          { id: 'subjects', label: `Subjects (${subjects.length})`, icon: BookOpen },
          { id: 'assignments', label: `Assignments (${assignments.length})`, icon: GraduationCap },
          { id: 'years', label: `Academic Years (${academicYears.length})`, icon: Calendar },
          { id: 'branches', label: `Branches (${branches.length})`, icon: Layers },
          { id: 'semesters', label: `Semesters (${semesters.length})`, icon: Building2 },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                isActive
                  ? 'bg-bce-navy text-amber-400 shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
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

      {/* 1. FACULTIES SUBTAB */}
      {activeSubTab === 'faculties' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add Faculty Form */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Plus className="w-4 h-4 text-bce-cobalt" />
              Add New Faculty
            </h4>
            <form onSubmit={handleCreateFaculty} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Faculty Name</label>
                <input
                  type="text"
                  required
                  value={facName}
                  onChange={(e) => setFacName(e.target.value)}
                  placeholder="e.g. Dr. Anil Kumar"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Department</label>
                <select
                  value={facDept}
                  onChange={(e) => setFacDept(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.name}>{b.name}</option>
                  ))}
                  <option value="Applied Science & Humanities">Applied Science & Humanities</option>
                  <option value="General">General</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Designation</label>
                <input
                  type="text"
                  required
                  value={facDesig}
                  onChange={(e) => setFacDesig(e.target.value)}
                  placeholder="e.g. Assistant Professor / HOD"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Employee ID (Optional)</label>
                <input
                  type="text"
                  value={facEmpId}
                  onChange={(e) => setFacEmpId(e.target.value)}
                  placeholder="e.g. BCE-CSE-01"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20"
                />
              </div>

              <button
                type="submit"
                disabled={isPending}
                className={`w-full py-2.5 px-4 rounded-xl bg-bce-cobalt hover:bg-bce-navy text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 ${
                  isPending
                    ? 'btn-request-active'
                    : message?.type === 'success'
                    ? 'btn-response-success'
                    : message?.type === 'error'
                    ? 'btn-response-error'
                    : ''
                }`}
              >
                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                <span>{isPending ? 'Adding Faculty...' : 'Add Faculty'}</span>
              </button>
            </form>
          </div>

          {/* Faculty List */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900">Faculty Directory ({faculties.length})</h4>
              <span className="text-xs text-slate-400">Click status to toggle active</span>
            </div>
            {faculties.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">No faculty members added yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-100 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-2.5">Name</th>
                      <th className="px-4 py-2.5">Department</th>
                      <th className="px-4 py-2.5">Designation</th>
                      <th className="px-4 py-2.5">Emp ID</th>
                      <th className="px-4 py-2.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {faculties.map((f) => (
                      <tr key={f.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-bold text-slate-800">{f.name}</td>
                        <td className="px-4 py-2.5 text-slate-600">{f.department}</td>
                        <td className="px-4 py-2.5 text-slate-500">{f.designation}</td>
                        <td className="px-4 py-2.5 font-mono text-slate-400">{f.employee_id || '—'}</td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            onClick={() => handleToggleFacultyActive(f)}
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                              f.is_active
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                            }`}
                          >
                            {f.is_active ? 'ACTIVE' : 'INACTIVE'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. SUBJECTS SUBTAB */}
      {activeSubTab === 'subjects' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add Subject Form */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Plus className="w-4 h-4 text-bce-cobalt" />
              Add New Subject
            </h4>
            <form onSubmit={handleCreateSubject} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Subject Name</label>
                <input
                  type="text"
                  required
                  value={subName}
                  onChange={(e) => setSubName(e.target.value)}
                  placeholder="e.g. Data Structures & Algorithms"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Subject Code</label>
                <input
                  type="text"
                  required
                  value={subCode}
                  onChange={(e) => setSubCode(e.target.value)}
                  placeholder="e.g. CS-401"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 uppercase focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Branch</label>
                <select
                  value={subBranchId}
                  onChange={(e) => setSubBranchId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20"
                >
                  <option value="">Common / All Branches</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Semester</label>
                <select
                  value={subSemesterId}
                  onChange={(e) => setSubSemesterId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20"
                >
                  <option value="">Any Semester</option>
                  {semesters.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={isPending}
                className={`w-full py-2.5 px-4 rounded-xl bg-bce-cobalt hover:bg-bce-navy text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 ${
                  isPending
                    ? 'btn-request-active'
                    : message?.type === 'success'
                    ? 'btn-response-success'
                    : message?.type === 'error'
                    ? 'btn-response-error'
                    : ''
                }`}
              >
                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                <span>{isPending ? 'Adding Subject...' : 'Add Subject'}</span>
              </button>
            </form>
          </div>

          {/* Subjects List */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900">Registered Subjects ({subjects.length})</h4>
              <span className="text-xs text-slate-400">Curriculum Catalog</span>
            </div>
            {subjects.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">No subjects registered yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-100 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-2.5">Code</th>
                      <th className="px-4 py-2.5">Subject Name</th>
                      <th className="px-4 py-2.5">Branch</th>
                      <th className="px-4 py-2.5">Semester</th>
                      <th className="px-4 py-2.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {subjects.map((s) => {
                      const branch = branches.find(b => b.id === s.branch_id);
                      const sem = semesters.find(sm => sm.id === s.semester_id);
                      return (
                        <tr key={s.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-mono font-bold text-slate-800">{s.code}</td>
                          <td className="px-4 py-2.5 font-semibold text-slate-800">{s.name}</td>
                          <td className="px-4 py-2.5 text-slate-600">{branch?.code || 'All'}</td>
                          <td className="px-4 py-2.5 text-slate-500">{sem?.name || '—'}</td>
                          <td className="px-4 py-2.5 text-right">
                            <button
                              onClick={() => handleToggleSubjectActive(s)}
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                                s.is_active
                                  ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                              }`}
                            >
                              {s.is_active ? 'ACTIVE' : 'INACTIVE'}
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
        </div>
      )}

      {/* 3. ASSIGNMENTS SUBTAB */}
      {activeSubTab === 'assignments' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add Assignment Form */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Plus className="w-4 h-4 text-bce-cobalt" />
              Assign Faculty to Subject
            </h4>
            <form onSubmit={handleCreateAssignment} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Faculty Member</label>
                <select
                  value={assignFacultyId}
                  onChange={(e) => setAssignFacultyId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20"
                >
                  {faculties.length === 0 && <option value="">No faculties available</option>}
                  {faculties.map((f) => (
                    <option key={f.id} value={f.id}>{f.name} ({f.department})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Subject</label>
                <select
                  value={assignSubjectId}
                  onChange={(e) => setAssignSubjectId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20"
                >
                  {subjects.length === 0 && <option value="">No subjects available</option>}
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Academic Session</label>
                <select
                  value={assignYearId}
                  onChange={(e) => setAssignYearId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20"
                >
                  {academicYears.map((y) => (
                    <option key={y.id} value={y.id}>{y.name} {y.is_active ? '(Active)' : ''}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Branch</label>
                <select
                  value={assignBranchId}
                  onChange={(e) => setAssignBranchId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Semester</label>
                <select
                  value={assignSemesterId}
                  onChange={(e) => setAssignSemesterId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20"
                >
                  {semesters.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={isPending}
                className={`w-full py-2.5 px-4 rounded-xl bg-bce-cobalt hover:bg-bce-navy text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 ${
                  isPending
                    ? 'btn-request-active'
                    : message?.type === 'success'
                    ? 'btn-response-success'
                    : message?.type === 'error'
                    ? 'btn-response-error'
                    : ''
                }`}
              >
                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                <span>{isPending ? 'Assigning Faculty...' : 'Assign Faculty'}</span>
              </button>
            </form>
          </div>

          {/* Assignments List */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900">Current Faculty Assignments ({assignments.length})</h4>
              <span className="text-xs text-slate-400">Maps Faculty to Subject & Semester</span>
            </div>
            {assignments.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">No faculty assignments configured yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-100 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-2.5">Faculty</th>
                      <th className="px-4 py-2.5">Subject</th>
                      <th className="px-4 py-2.5">Session</th>
                      <th className="px-4 py-2.5">Branch</th>
                      <th className="px-4 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {assignments.map((a) => {
                      const faculty = faculties.find(f => f.id === a.faculty_id) || a.faculty;
                      const subject = subjects.find(s => s.id === a.subject_id) || a.subject;
                      const year = academicYears.find(y => y.id === a.academic_year_id);
                      const branch = branches.find(b => b.id === a.branch_id);
                      return (
                        <tr key={a.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-bold text-slate-800">{faculty?.name || 'Faculty'}</td>
                          <td className="px-4 py-2.5 text-slate-700">{subject?.name || 'Subject'}</td>
                          <td className="px-4 py-2.5 text-slate-500 font-mono">{year?.name || '—'}</td>
                          <td className="px-4 py-2.5 text-slate-500">{branch?.code || 'All'}</td>
                          <td className="px-4 py-2.5 text-right">
                            <button
                              onClick={() => handleDeleteAssignment(a.id)}
                              className="p-1 rounded text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Delete Assignment"
                            >
                              <Trash2 className="w-4 h-4" />
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
        </div>
      )}

      {/* 4. ACADEMIC YEARS SUBTAB */}
      {activeSubTab === 'years' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Plus className="w-4 h-4 text-bce-cobalt" />
              Add Academic Year
            </h4>
            <form onSubmit={handleCreateYear} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Session Name</label>
                <input
                  type="text"
                  required
                  value={yearName}
                  onChange={(e) => setYearName(e.target.value)}
                  placeholder="e.g. 2026-2027"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="yrActive"
                  checked={yearActive}
                  onChange={(e) => setYearActive(e.target.checked)}
                  className="rounded border-slate-300 text-bce-cobalt focus:ring-bce-cobalt"
                />
                <label htmlFor="yrActive" className="text-xs text-slate-700 font-medium">Set as Active Session</label>
              </div>

              <button
                type="submit"
                disabled={isPending}
                className={`w-full py-2.5 px-4 rounded-xl bg-bce-cobalt hover:bg-bce-navy text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 ${
                  isPending
                    ? 'btn-request-active'
                    : message?.type === 'success'
                    ? 'btn-response-success'
                    : message?.type === 'error'
                    ? 'btn-response-error'
                    : ''
                }`}
              >
                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                <span>{isPending ? 'Adding Year...' : 'Add Year'}</span>
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900">Academic Sessions ({academicYears.length})</h4>
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3">Session Name</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Toggle Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {academicYears.map((y) => (
                  <tr key={y.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-bold text-slate-800">{y.name}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                        y.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {y.is_active ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => {
                          startTransition(async () => {
                            await updateAcademicYearAction(y.id, { name: y.name, is_active: !y.is_active });
                          });
                        }}
                        className="text-bce-cobalt hover:underline text-xs font-semibold"
                      >
                        {y.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. BRANCHES SUBTAB */}
      {activeSubTab === 'branches' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Plus className="w-4 h-4 text-bce-cobalt" />
              Add Engineering Branch
            </h4>
            <form onSubmit={handleCreateBranch} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Branch Name</label>
                <input
                  type="text"
                  required
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  placeholder="e.g. Artificial Intelligence & Data Science"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Branch Code</label>
                <input
                  type="text"
                  required
                  value={branchCode}
                  onChange={(e) => setBranchCode(e.target.value)}
                  placeholder="e.g. AI-DS"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 uppercase focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20"
                />
              </div>

              <button
                type="submit"
                disabled={isPending}
                className={`w-full py-2.5 px-4 rounded-xl bg-bce-cobalt hover:bg-bce-navy text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 ${
                  isPending
                    ? 'btn-request-active'
                    : message?.type === 'success'
                    ? 'btn-response-success'
                    : message?.type === 'error'
                    ? 'btn-response-error'
                    : ''
                }`}
              >
                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                <span>{isPending ? 'Adding Branch...' : 'Add Branch'}</span>
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900">Engineering Branches ({branches.length})</h4>
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3">Code</th>
                  <th className="px-5 py-3">Branch Name</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Toggle Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {branches.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-mono font-bold text-slate-800">{b.code}</td>
                    <td className="px-5 py-3 font-semibold text-slate-800">{b.name}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                        b.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {b.is_active ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => {
                          startTransition(async () => {
                            await updateBranchAction(b.id, { name: b.name, code: b.code, is_active: !b.is_active });
                          });
                        }}
                        className="text-bce-cobalt hover:underline text-xs font-semibold"
                      >
                        {b.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. SEMESTERS SUBTAB */}
      {activeSubTab === 'semesters' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-900">Configured Semesters ({semesters.length})</h4>
            <span className="text-xs text-slate-400">8 Semester Curriculum Structure</span>
          </div>
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-100 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">Semester</th>
                <th className="px-5 py-3">Year Level</th>
                <th className="px-5 py-3">Semester #</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Toggle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {semesters.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-bold text-slate-800">{s.name}</td>
                  <td className="px-5 py-3 text-slate-600">Year {s.year_number}</td>
                  <td className="px-5 py-3 text-slate-600">Semester {s.semester_number}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                      s.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {s.is_active ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => {
                        startTransition(async () => {
                          await updateSemesterAction(s.id, {
                            name: s.name,
                            year_number: s.year_number,
                            semester_number: s.semester_number,
                            is_active: !s.is_active,
                          });
                        });
                      }}
                      className="text-bce-cobalt hover:underline text-xs font-semibold"
                    >
                      {s.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
