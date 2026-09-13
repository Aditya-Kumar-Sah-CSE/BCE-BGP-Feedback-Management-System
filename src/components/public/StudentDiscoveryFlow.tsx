'use client';

import { useState, useEffect, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Calendar,
  Layers,
  BookOpen,
  User,
  ExternalLink,
  Info,
  Clock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import type { AcademicYear, Branch, Semester, FacultySubjectAssignment, FeedbackForm } from '@/types/database';

interface Props {
  academicYears: AcademicYear[];
  branches: Branch[];
  semesters: Semester[];
}

export function StudentDiscoveryFlow({ academicYears, branches, semesters }: Props) {
  const [selectedYearId, setSelectedYearId] = useState<string>(
    academicYears.find(y => y.is_active)?.id || academicYears[0]?.id || ''
  );
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    branches.find(b => b.is_active)?.id || branches[0]?.id || ''
  );
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>(
    semesters.find(s => s.is_active)?.id || semesters[0]?.id || ''
  );

  const [assignments, setAssignments] = useState<FacultySubjectAssignment[]>([]);
  const [forms, setForms] = useState<FeedbackForm[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [, startTransition] = useTransition();

  const supabase = createClient();

  useEffect(() => {
    if (!selectedYearId || !selectedBranchId || !selectedSemesterId) return;

    let isMounted = true;
    setIsLoading(true);

    async function fetchData() {
      try {
        // 1. Fetch active assignments
        const { data: assignData, error: assignErr } = await supabase
          .from('faculty_subject_assignments')
          .select(`
            id,
            faculty_id,
            subject_id,
            academic_year_id,
            branch_id,
            semester_id,
            is_active,
            created_at,
            faculty:faculties(id, name, department, designation),
            subject:subjects(id, name, code)
          `)
          .eq('academic_year_id', selectedYearId)
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (assignErr) {
          console.error('Error fetching assignments:', assignErr);
        }

        // Filter by branch & semester if specified in assignment or subject
        const filteredAssignments = (assignData || []).filter((item: any) => {
          const matchBranch = !item.branch_id || item.branch_id === selectedBranchId;
          const matchSem = !item.semester_id || item.semester_id === selectedSemesterId;
          return matchBranch && matchSem;
        });

        // 2. Fetch published feedback forms
        const { data: formData, error: formErr } = await supabase
          .from('feedback_forms')
          .select('*')
          .eq('academic_year_id', selectedYearId)
          .eq('branch_id', selectedBranchId)
          .eq('semester_id', selectedSemesterId)
          .eq('status', 'PUBLISHED');

        if (formErr) {
          console.error('Error fetching feedback forms:', formErr);
        }

        if (isMounted) {
          setAssignments(filteredAssignments as unknown as FacultySubjectAssignment[]);
          setForms((formData as FeedbackForm[]) || []);
        }
      } catch (err) {
        console.error('Failed to load discovery data:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    startTransition(() => {
      fetchData();
    });

    return () => {
      isMounted = false;
    };
  }, [selectedYearId, selectedBranchId, selectedSemesterId, supabase]);

  const selectedYear = academicYears.find(y => y.id === selectedYearId);
  const selectedBranch = branches.find(b => b.id === selectedBranchId);
  const selectedSemester = semesters.find(s => s.id === selectedSemesterId);

  return (
    <div className="space-y-8">
      {/* 3-Step Filter Panel */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Step 1: Academic Year */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-bce-cobalt" />
              1. Academic Year
            </label>
            <select
              value={selectedYearId}
              onChange={(e) => setSelectedYearId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20 focus:border-bce-cobalt transition-all"
            >
              {academicYears.length === 0 && <option value="">No active years</option>}
              {academicYears.map((yr) => (
                <option key={yr.id} value={yr.id}>
                  {yr.name} {yr.is_active ? '(Active)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Step 2: Branch / Department */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-bce-cobalt" />
              2. Branch / Department
            </label>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20 focus:border-bce-cobalt transition-all"
            >
              {branches.length === 0 && <option value="">No active branches</option>}
              {branches.map((br) => (
                <option key={br.id} value={br.id}>
                  {br.name} ({br.code})
                </option>
              ))}
            </select>
          </div>

          {/* Step 3: Semester */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-bce-cobalt" />
              3. Semester
            </label>
            <select
              value={selectedSemesterId}
              onChange={(e) => setSelectedSemesterId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20 focus:border-bce-cobalt transition-all"
            >
              {semesters.length === 0 && <option value="">No active semesters</option>}
              {semesters.map((sem) => (
                <option key={sem.id} value={sem.id}>
                  {sem.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Selected Criteria Summary Tag */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Currently Filtering:</span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-100 text-slate-800 font-medium">
              {selectedYear?.name || 'Session'}
            </span>
            <span className="text-slate-400">/</span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-100 text-slate-800 font-medium">
              {selectedBranch?.code || 'Branch'}
            </span>
            <span className="text-slate-400">/</span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-100 text-slate-800 font-medium">
              {selectedSemester?.name || 'Semester'}
            </span>
          </div>

          <div className="text-slate-400">
            {assignments.length} {assignments.length === 1 ? 'Faculty Assigned' : 'Faculties Assigned'}
          </div>
        </div>
      </div>

      {/* Results Section */}
      <div className="space-y-4">
        <h4 className="text-base font-bold text-slate-900 flex items-center justify-between">
          <span>Faculty & Subject Evaluation Forms</span>
          {isLoading && (
            <span className="text-xs font-normal text-bce-cobalt animate-pulse flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 animate-spin" /> Loading assignments...
            </span>
          )}
        </h4>

        {/* Loading Skeleton */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-xl p-5 border border-slate-200 animate-pulse space-y-3">
                <div className="h-4 bg-slate-200 rounded w-2/3" />
                <div className="h-3 bg-slate-100 rounded w-1/2" />
                <div className="h-9 bg-slate-100 rounded-lg w-full mt-4" />
              </div>
            ))}
          </div>
        ) : assignments.length > 0 ? (
          /* Cards Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {assignments.map((item) => {
              const faculty = item.faculty;
              const subject = item.subject;
              const matchingForm = forms.find(
                f => f.faculty_id === item.faculty_id && f.subject_id === item.subject_id
              );

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-xl p-5 border border-slate-200 hover:border-bce-cobalt/40 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-slate-100 text-bce-cobalt flex items-center justify-center font-bold text-sm">
                          <User className="w-4 h-4 text-bce-cobalt" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-base leading-tight">
                            {faculty?.name || 'Faculty Member'}
                          </p>
                          <p className="text-xs text-slate-500">
                            {faculty?.designation || 'Faculty'} • {faculty?.department || 'Department'}
                          </p>
                        </div>
                      </div>

                      {matchingForm ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Published
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                          <Clock className="w-3.5 h-3.5 text-slate-400" /> Pending Form
                        </span>
                      )}
                    </div>

                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">Subject:</span>
                      <span className="font-semibold text-slate-800">
                        {subject?.name || 'Subject'} {subject?.code ? `(${subject.code})` : ''}
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-100">
                    {matchingForm ? (
                      <a
                        href={matchingForm.public_url || matchingForm.google_form_url || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-bce-cobalt hover:bg-bce-navy text-white rounded-lg font-medium text-sm transition-colors shadow-xs"
                      >
                        <span>Start Feedback Evaluation</span>
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    ) : (
                      <div className="bg-amber-50/70 border border-amber-200/60 rounded-lg p-2.5 text-center text-xs text-amber-900 flex items-center justify-center gap-2">
                        <Info className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Feedback form not yet published by administration for this subject.</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Empty State */
          <div className="bg-white rounded-2xl p-10 border border-slate-200 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h5 className="text-base font-bold text-slate-800">
              No Faculty Assignments or Feedback Forms Found
            </h5>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              There are currently no active faculty assignments configured for {selectedBranch?.name || 'this branch'} in {selectedSemester?.name || 'this semester'} for session {selectedYear?.name || ''}.
            </p>
            <div className="pt-2">
              <span className="text-xs text-slate-400">
                Please check another semester or check back after the administration updates assignments.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
