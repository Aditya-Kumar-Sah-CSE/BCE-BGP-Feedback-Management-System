'use client';

import { useState, useTransition, useMemo } from 'react';
import Link from 'next/link';
import {
  AcademicYear,
  Branch,
  Semester,
  Faculty,
  Subject,
  FacultySubjectAssignment,
  FeedbackForm,
} from '@/types/database';
import { GoogleConfigStatus } from '@/lib/google/auth';
import { createGoogleFeedbackFormAction } from '@/app/admin/forms/actions';
import { BCE_FEEDBACK_PARAMETERS } from '@/lib/google/template';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  FileCode2,
  ExternalLink,
  Sparkles,
  Loader2,
  ShieldAlert,
} from 'lucide-react';

interface Props {
  academicYears: AcademicYear[];
  branches: Branch[];
  semesters: Semester[];
  faculties: Faculty[];
  subjects: Subject[];
  assignments: FacultySubjectAssignment[];
  googleStatus: GoogleConfigStatus;
}

export function CreateGoogleFormWizard({
  academicYears,
  branches,
  semesters,
  faculties,
  subjects,
  assignments,
  googleStatus,
}: Props) {
  const [isPending, startTransition] = useTransition();

  // Step state (1 to 6)

  const [currentStep, setCurrentStep] = useState<number>(1);

  // Form selections
  const [academicYearId, setAcademicYearId] = useState<string>(
    academicYears.find(y => y.is_active)?.id || academicYears[0]?.id || ''
  );
  const [semesterId, setSemesterId] = useState<string>(semesters[0]?.id || '');
  const [branchId, setBranchId] = useState<string>(branches[0]?.id || '');
  const [facultyId, setFacultyId] = useState<string>('');
  const [subjectId, setSubjectId] = useState<string>('');
  const [formType, setFormType] = useState<'FACULTY_SPECIFIC' | 'BRANCH_SPECIFIC'>('FACULTY_SPECIFIC');

  // Creation progress & result state
  const [creationStepMsg, setCreationStepMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [createdForm, setCreatedForm] = useState<FeedbackForm | null>(null);
  const [destinationType, setDestinationType] = useState<string | null>(null);

  // Selected Entities
  const selectedYear = useMemo(
    () => academicYears.find(y => y.id === academicYearId),
    [academicYears, academicYearId]
  );
  const selectedSem = useMemo(
    () => semesters.find(s => s.id === semesterId),
    [semesters, semesterId]
  );
  const selectedBranch = useMemo(
    () => branches.find(b => b.id === branchId),
    [branches, branchId]
  );
  const selectedFaculty = useMemo(
    () => faculties.find(f => f.id === facultyId),
    [faculties, facultyId]
  );
  const selectedSubject = useMemo(
    () => subjects.find(s => s.id === subjectId),
    [subjects, subjectId]
  );

  // Filter faculties who have assignments in this session & branch/sem
  const relevantAssignments = useMemo(() => {
    return assignments.filter(a => {
      const matchYear = a.academic_year_id === academicYearId;
      const matchBranch = !a.branch_id || a.branch_id === branchId;
      const matchSem = !a.semester_id || a.semester_id === semesterId;
      return matchYear && matchBranch && matchSem && a.is_active;
    });
  }, [assignments, academicYearId, branchId, semesterId]);

  // Faculties available for assignment in this selection
  const availableFaculties = useMemo(() => {
    if (relevantAssignments.length === 0) {
      // If no assignments specifically match branch/sem, fallback to all active faculties
      return faculties.filter(f => f.is_active);
    }
    const facultyIds = new Set(relevantAssignments.map(a => a.faculty_id));
    return faculties.filter(f => f.is_active && facultyIds.has(f.id));
  }, [faculties, relevantAssignments]);

  // Subjects assigned to the selected faculty
  const availableSubjects = useMemo(() => {
    if (!facultyId) return [];
    const facultyAssignments = relevantAssignments.filter(a => a.faculty_id === facultyId);
    if (facultyAssignments.length > 0) {
      const subjectIds = new Set(facultyAssignments.map(a => a.subject_id));
      return subjects.filter(s => s.is_active && subjectIds.has(s.id));
    }
    // Fallback: subjects matching semester/branch
    return subjects.filter(s => {
      const matchSem = !s.semester_id || s.semester_id === semesterId;
      const matchBranch = !s.branch_id || s.branch_id === branchId;
      return s.is_active && matchSem && matchBranch;
    });
  }, [facultyId, relevantAssignments, subjects, semesterId, branchId]);

  // Computed Form Title Preview
  const computedTitle = useMemo(() => {
    const fac = selectedFaculty?.name || '[Faculty Name]';
    const sub = selectedSubject?.name
      ? `${selectedSubject.name}${selectedSubject.code ? ` (${selectedSubject.code})` : ''}`
      : '[Subject Name]';
    const sem = selectedSem?.name || '[Semester]';
    const yr = selectedYear?.name || '[Academic Year]';
    return `Faculty Feedback — ${fac} — ${sub} — ${sem} — ${yr}`;
  }, [selectedFaculty, selectedSubject, selectedSem, selectedYear]);

  // Validation before progressing
  const canGoToNext = () => {
    if (currentStep === 1) return Boolean(academicYearId);
    if (currentStep === 2) return Boolean(semesterId);
    if (currentStep === 3) return Boolean(branchId);
    if (currentStep === 4) return Boolean(facultyId);
    if (currentStep === 5) return Boolean(subjectId);
    if (currentStep === 6) return true;
    return false;
  };

  const handleNext = () => {
    if (canGoToNext() && currentStep < 6) {
      setErrorMsg(null);
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setErrorMsg(null);
      setCurrentStep(prev => prev - 1);
    }
  };

  // Trigger form generation
  const handleGenerateForm = () => {
    if (!googleStatus.isConfigured) {
      setErrorMsg(
        'Google API credentials are not configured in .env.local. Please configure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN before creating live forms.'
      );
      return;
    }

    setErrorMsg(null);
    setCreationStepMsg('Validating academic assignment & credentials...');

    startTransition(async () => {
      setCreationStepMsg('Creating Google Form & adding 8 BCE evaluation parameters...');

      const result = await createGoogleFeedbackFormAction({
        academicYearId,
        branchId,
        semesterId,
        facultyId,
        subjectId,
        formType,
      });

      if (!result.success) {
        setErrorMsg(result.error || 'Failed to generate Google Form.');
        setCreationStepMsg('');
      } else {
        setCreatedForm(result.form as FeedbackForm);
        setDestinationType(result.destinationType || 'APPLICATION_MANAGED');
        setCreationStepMsg('');
      }
    });
  };

  const steps = [
    { num: 1, label: 'Academic Year' },
    { num: 2, label: 'Semester' },
    { num: 3, label: 'Branch' },
    { num: 4, label: 'Faculty' },
    { num: 5, label: 'Subject' },
    { num: 6, label: 'Form Type' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/dashboard/forms"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-6 h-6 text-bce-cobalt" />
              Generate Google Feedback Form
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 ml-9">
            Step-by-step wizard to create an official BCE Google Feedback Form connected to a response Google Sheet.
          </p>
        </div>

        <Link
          href="/admin/dashboard/forms"
          className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
        >
          Cancel & Return
        </Link>
      </div>

      {/* Google Setup Warning if unconfigured */}
      {!googleStatus.isConfigured && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex items-start gap-3 text-xs text-amber-950">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-amber-900">Google API Credentials Required</p>
            <p className="text-amber-800">
              Form generation connects to live Google APIs (Google Forms API, Sheets API, and Drive API).
              Please ensure your <code className="px-1.5 py-0.5 bg-amber-100 rounded text-amber-900 font-mono">.env.local</code> has:
            </p>
            <ul className="list-disc list-inside space-y-0.5 font-mono text-[11px] text-amber-900 pt-1">
              <li>GOOGLE_CLIENT_ID</li>
              <li>GOOGLE_CLIENT_SECRET</li>
              <li>GOOGLE_REFRESH_TOKEN</li>
            </ul>
          </div>
        </div>
      )}

      {/* Success View after Creation */}
      {createdForm ? (
        <div className="bg-white p-8 rounded-2xl border border-emerald-200 shadow-sm space-y-6">
          <div className="text-center space-y-2 max-w-xl mx-auto">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Google Form Generated Successfully!</h3>
            <p className="text-xs text-slate-600">
              The Google Form and connected Google Sheet were created and saved in Supabase in{' '}
              <strong className="text-amber-600">DRAFT</strong> state.
            </p>
          </div>

          {/* Form Summary Card */}
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 max-w-2xl mx-auto space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Form Title</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                DRAFT
              </span>
            </div>
            <p className="font-bold text-sm text-slate-900">{createdForm.title}</p>

            <div className="grid grid-cols-2 gap-3 pt-2 text-xs text-slate-600">
              <div>
                <span className="text-slate-400 block text-[11px]">Response Destination:</span>
                <span className="font-semibold text-slate-800">
                  {destinationType === 'NATIVE_SHEET'
                    ? '⚡ Native Google Form Destination'
                    : '🔄 Application-Managed Response Sync'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Evaluation Parameters:</span>
                <span className="font-semibold text-slate-800">8 BCE Questions Populated</span>
              </div>
            </div>
          </div>

          {/* Direct Action Links */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {createdForm.google_form_url && (
              <a
                href={createdForm.google_form_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
              >
                <FileCode2 className="w-4 h-4" />
                <span>Open Google Form (Student View)</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}

            {createdForm.google_sheet_url && (
              <a
                href={createdForm.google_sheet_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Open Google Responses Sheet</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}

            <Link
              href={`/admin/dashboard/forms/${createdForm.id}`}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-bce-cobalt hover:bg-bce-navy text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
            >
              <span>Manage Form Details</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="text-center pt-4 border-t border-slate-100">
            <button
              onClick={() => {
                setCreatedForm(null);
                setCurrentStep(1);
                setFacultyId('');
                setSubjectId('');
              }}
              className="text-xs text-slate-500 hover:text-bce-cobalt font-semibold"
            >
              + Generate Another Feedback Form
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Wizard Form (2 Cols) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Step Stepper Header */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="grid grid-cols-6 gap-2">
                {steps.map(s => {
                  const isCompleted = s.num < currentStep;
                  const isCurrent = s.num === currentStep;

                  return (
                    <div
                      key={s.num}
                      className={`text-center p-2 rounded-xl border transition-all ${
                        isCurrent
                          ? 'bg-bce-navy text-white border-bce-cobalt shadow-xs'
                          : isCompleted
                          ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                          : 'bg-slate-50 text-slate-400 border-slate-200'
                      }`}
                    >
                      <div className="text-[10px] font-bold uppercase tracking-wider">
                        Step {s.num}
                      </div>
                      <div className="text-xs font-semibold truncate mt-0.5">
                        {s.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step Body */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
              {/* Step 1: Academic Year */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  <div className="border-b border-slate-100 pb-3">
                    <h3 className="text-base font-bold text-slate-900">Step 1: Select Academic Session</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Choose the active academic year for this feedback evaluation.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {academicYears.map(y => (
                      <button
                        key={y.id}
                        type="button"
                        onClick={() => setAcademicYearId(y.id)}
                        className={`p-4 rounded-2xl border text-left transition-all ${
                          academicYearId === y.id
                            ? 'bg-blue-50/80 border-bce-cobalt ring-2 ring-bce-cobalt/20 shadow-xs'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-slate-900">{y.name}</span>
                          {y.is_active && (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
                              Active
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 mt-1 block">
                          Academic Calendar Session
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 2: Semester */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  <div className="border-b border-slate-100 pb-3">
                    <h3 className="text-base font-bold text-slate-900">Step 2: Select Semester</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Select the semester level for the student cohort submitting feedback.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {semesters.map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSemesterId(s.id)}
                        className={`p-4 rounded-2xl border text-center transition-all ${
                          semesterId === s.id
                            ? 'bg-blue-50/80 border-bce-cobalt ring-2 ring-bce-cobalt/20 shadow-xs'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="font-bold text-base text-slate-900">{s.name}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Year {s.year_number} • Sem {s.semester_number}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 3: Branch */}
              {currentStep === 3 && (
                <div className="space-y-4">
                  <div className="border-b border-slate-100 pb-3">
                    <h3 className="text-base font-bold text-slate-900">Step 3: Select Branch / Discipline</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Choose the engineering department for this evaluation.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {branches.map(b => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setBranchId(b.id)}
                        className={`p-4 rounded-2xl border text-left transition-all ${
                          branchId === b.id
                            ? 'bg-blue-50/80 border-bce-cobalt ring-2 ring-bce-cobalt/20 shadow-xs'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-slate-900">{b.name}</span>
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-mono font-bold rounded-md">
                            {b.code}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 mt-1 block">
                          Department of {b.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 4: Faculty */}
              {currentStep === 4 && (
                <div className="space-y-4">
                  <div className="border-b border-slate-100 pb-3">
                    <h3 className="text-base font-bold text-slate-900">Step 4: Select Faculty Member</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Choose the teacher being evaluated. Shows faculty assigned to {selectedBranch?.name}, {selectedSem?.name}.
                    </p>
                  </div>

                  {availableFaculties.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                      <AlertCircle className="w-6 h-6 text-amber-500 mx-auto" />
                      <p className="text-xs font-bold text-slate-800">No Assigned Faculties Found</p>
                      <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                        There are no faculty assigned to {selectedBranch?.name} in {selectedSem?.name} for session {selectedYear?.name}.
                        Please visit Academic Structure to assign faculty members.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                      {availableFaculties.map(f => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => {
                            setFacultyId(f.id);
                            setSubjectId(''); // Reset subject when faculty changes
                          }}
                          className={`p-3.5 rounded-2xl border text-left transition-all ${
                            facultyId === f.id
                              ? 'bg-blue-50/80 border-bce-cobalt ring-2 ring-bce-cobalt/20 shadow-xs'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="font-bold text-xs text-slate-900">{f.name}</div>
                          <div className="text-[11px] text-slate-500">
                            {f.designation} • {f.department}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Step 5: Subject */}
              {currentStep === 5 && (
                <div className="space-y-4">
                  <div className="border-b border-slate-100 pb-3">
                    <h3 className="text-base font-bold text-slate-900">Step 5: Select Subject</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Choose the subject taught by {selectedFaculty?.name} in {selectedSem?.name}.
                    </p>
                  </div>

                  {availableSubjects.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                      <AlertCircle className="w-6 h-6 text-amber-500 mx-auto" />
                      <p className="text-xs font-bold text-slate-800">No Assigned Subjects</p>
                      <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                        No subject assignments found for {selectedFaculty?.name} in this session.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                      {availableSubjects.map(s => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSubjectId(s.id)}
                          className={`p-3.5 rounded-2xl border text-left transition-all ${
                            subjectId === s.id
                              ? 'bg-blue-50/80 border-bce-cobalt ring-2 ring-bce-cobalt/20 shadow-xs'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-slate-900">{s.name}</span>
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-mono font-bold rounded-md">
                              {s.code}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400 mt-1 block">Course Curriculum Subject</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Step 6: Form Type & Confirmation */}
              {currentStep === 6 && (
                <div className="space-y-4">
                  <div className="border-b border-slate-100 pb-3">
                    <h3 className="text-base font-bold text-slate-900">Step 6: Form Type & Confirmation</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Confirm form classification and review generation details.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormType('FACULTY_SPECIFIC')}
                      className={`p-4 rounded-2xl border text-left transition-all ${
                        formType === 'FACULTY_SPECIFIC'
                          ? 'bg-blue-50/80 border-bce-cobalt ring-2 ring-bce-cobalt/20 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="font-bold text-xs text-slate-900">Faculty-Specific Feedback</div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Evaluates an individual faculty member for an assigned subject. Uses standard 8 BCE evaluation parameters.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormType('BRANCH_SPECIFIC')}
                      className={`p-4 rounded-2xl border text-left transition-all ${
                        formType === 'BRANCH_SPECIFIC'
                          ? 'bg-blue-50/80 border-bce-cobalt ring-2 ring-bce-cobalt/20 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="font-bold text-xs text-slate-900">Branch-Specific Feedback</div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Discipline-focused evaluation scoped to branch courses and laboratory practicals.
                      </p>
                    </button>
                  </div>

                  {/* Summary of what will be generated */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
                    <div className="font-bold text-slate-800">Generation Pipeline Checklist:</div>
                    <ul className="space-y-1 text-slate-600">
                      <li className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Google Form container created via Google Forms API v1</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>All 8 BCE evaluation rating parameters added with 4 choices</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Dedicated response Google Sheet initialized with styled headers</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Response destination connected ({googleStatus.hasAppsScript ? 'Native Apps Script' : 'App-Managed Sync'})</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Metadata recorded in Supabase and audit logged in DRAFT state</span>
                      </li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Error Alert */}
              {errorMsg && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Pending Progress indicator */}
              {isPending && (
                <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-950 text-xs flex items-center gap-3">
                  <Loader2 className="w-4 h-4 text-bce-cobalt animate-spin shrink-0" />
                  <span className="font-semibold">{creationStepMsg || 'Generating Google Form...'}</span>
                </div>
              )}

              {/* Navigation Controls */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={currentStep === 1 || isPending}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  ← Back
                </button>

                {currentStep < 6 ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={!canGoToNext() || isPending}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-bce-cobalt hover:bg-bce-navy disabled:opacity-40 transition-colors shadow-xs"
                  >
                    <span>Next Step</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleGenerateForm}
                    disabled={!canGoToNext() || isPending || !googleStatus.isConfigured}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-bce-cobalt to-indigo-600 hover:from-bce-navy hover:to-indigo-700 disabled:opacity-40 transition-all shadow-md"
                  >
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Generate Google Feedback Form</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Live Preview Card */}
          <div className="space-y-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-bce-cobalt" />
                  Live Form Preview
                </h4>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                  Preview Only
                </span>
              </div>

              {/* Title & Metadata Card */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase text-slate-400">Generated Title</span>
                <p className="font-bold text-xs text-slate-900 leading-snug bg-slate-50 p-2.5 rounded-xl border border-slate-200 font-mono">
                  {computedTitle}
                </p>
              </div>

              <div className="space-y-1 text-xs text-slate-600">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-400">Session:</span>
                  <span className="font-semibold text-slate-800">{selectedYear?.name || '—'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-400">Semester:</span>
                  <span className="font-semibold text-slate-800">{selectedSem?.name || '—'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-400">Branch:</span>
                  <span className="font-semibold text-slate-800">{selectedBranch?.code || '—'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-400">Faculty:</span>
                  <span className="font-semibold text-slate-800">{selectedFaculty?.name || '—'}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Subject:</span>
                  <span className="font-semibold text-slate-800">{selectedSubject?.name || '—'}</span>
                </div>
              </div>

              {/* 8 BCE Questions Preview */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                  8 Standard Evaluation Parameters
                </span>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {BCE_FEEDBACK_PARAMETERS.map(p => (
                    <div key={p.id} className="p-2 bg-slate-50 rounded-lg border border-slate-100 text-[11px]">
                      <div className="font-bold text-slate-800">
                        {p.id}. {p.title}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {p.options.map(opt => (
                          <span
                            key={opt}
                            className="px-1.5 py-0.5 rounded text-[9px] bg-white border border-slate-200 text-slate-600"
                          >
                            {opt}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
