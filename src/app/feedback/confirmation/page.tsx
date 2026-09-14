'use client';

import React, { useEffect, useState, useTransition, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  CheckCircle2,
  Download,
  Mail,
  ArrowLeft,
  FileCheck2,
  Calendar,
  Building2,
  GraduationCap,
  Clock,
  Search,
  AlertCircle,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import {
  getConfirmationByTokenAction,
  verifyStudentSubmissionAction,
  resendConfirmationEmailAction,
  VerifiedConfirmationData,
} from './actions';

function ConfirmationContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [confirmationData, setConfirmationData] = useState<VerifiedConfirmationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lookupEmail, setLookupEmail] = useState('');
  const [lookupFormId, setLookupFormId] = useState('');
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [emailStatusMsg, setEmailStatusMsg] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();
  const [isEmailPending, startEmailTransition] = useTransition();

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    startTransition(async () => {
      try {
        const data = await getConfirmationByTokenAction(token);
        if (data) {
          setConfirmationData(data);
        }
      } catch (err) {
        console.error('Failed to load confirmation token data:', err);
      } finally {
        setLoading(false);
      }
    });
  }, [token]);

  const handleManualLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupEmail || !lookupFormId) {
      setLookupError('Please enter both the Feedback Form ID and your registered email address.');
      return;
    }

    setLookupError(null);
    startTransition(async () => {
      const res = await verifyStudentSubmissionAction({
        formId: lookupFormId.trim(),
        email: lookupEmail.trim(),
      });

      if (res.success && res.data) {
        setConfirmationData(res.data);
      } else {
        setLookupError(res.message);
      }
    });
  };

  const handleResendEmail = () => {
    if (!confirmationData) return;
    setEmailStatusMsg(null);

    startEmailTransition(async () => {
      const res = await resendConfirmationEmailAction({
        formId: confirmationData.formTitle, // internally resolves or uses context
        email: confirmationData.studentEmail,
      });

      setEmailStatusMsg(res.message);
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
      {/* Background radial glow */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_0%,rgba(99,102,241,0.15),transparent_50%)]" />

      <div className="w-full max-w-2xl relative z-10">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-3 group">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="font-bold text-lg tracking-wide text-white">
              BCE BHAGALPUR
            </span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Submission Confirmation
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Faculty Feedback Management System • Government of Bihar
          </p>
        </div>

        {loading ? (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-12 text-center backdrop-blur-xl shadow-2xl">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-4" />
            <p className="text-sm text-slate-300 font-medium">
              Verifying your submission record from institutional records...
            </p>
          </div>
        ) : confirmationData ? (
          /* SUCCESS STATE */
          <div className="bg-slate-900/90 border border-emerald-500/30 rounded-2xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl shadow-emerald-950/20">
            {/* Success Hero Header */}
            <div className="flex flex-col sm:flex-row items-center gap-4 pb-6 border-b border-slate-800 text-center sm:text-left">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-9 h-9 text-emerald-400" />
              </div>
              <div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-1">
                  Officially Verified Submission
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-white leading-snug">
                  Congratulations! 🎉
                </h2>
                <p className="text-sm text-slate-300 mt-1">
                  You have successfully submitted the{' '}
                  <span className="text-emerald-400 font-semibold">
                    {confirmationData.semester} {confirmationData.branch}
                  </span>{' '}
                  Faculty Feedback Form.
                </p>
              </div>
            </div>

            {/* Submission Metadata Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6 bg-slate-950/60 p-5 rounded-xl border border-slate-800/80 text-xs">
              <div className="flex items-center gap-2.5 text-slate-300">
                <Building2 className="w-4 h-4 text-indigo-400 shrink-0" />
                <div>
                  <span className="text-slate-500 block">Department / Branch</span>
                  <span className="font-semibold text-white">{confirmationData.branch}</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 text-slate-300">
                <GraduationCap className="w-4 h-4 text-indigo-400 shrink-0" />
                <div>
                  <span className="text-slate-500 block">Semester Level</span>
                  <span className="font-semibold text-white">{confirmationData.semester}</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 text-slate-300">
                <Calendar className="w-4 h-4 text-indigo-400 shrink-0" />
                <div>
                  <span className="text-slate-500 block">Academic Session</span>
                  <span className="font-semibold text-white">{confirmationData.academicYear}</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 text-slate-300">
                <Clock className="w-4 h-4 text-indigo-400 shrink-0" />
                <div>
                  <span className="text-slate-500 block">Submission Date</span>
                  <span className="font-semibold text-white">
                    {confirmationData.submittedAt
                      ? new Date(confirmationData.submittedAt).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Recorded in Google Sheet'}
                  </span>
                </div>
              </div>

              {confirmationData.studentName && (
                <div className="flex items-center gap-2.5 text-slate-300">
                  <FileCheck2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <span className="text-slate-500 block">Student Name</span>
                    <span className="font-semibold text-white">{confirmationData.studentName}</span>
                  </div>
                </div>
              )}

              {confirmationData.registrationNumber && (
                <div className="flex items-center gap-2.5 text-slate-300">
                  <FileCheck2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <span className="text-slate-500 block">University Reg No</span>
                    <span className="font-semibold text-white">{confirmationData.registrationNumber}</span>
                  </div>
                </div>
              )}

              <div className="sm:col-span-2 flex items-center gap-2.5 text-slate-300 pt-2 border-t border-slate-900">
                <Mail className="w-4 h-4 text-indigo-400 shrink-0" />
                <div>
                  <span className="text-slate-500 block">Verified Student Email</span>
                  <span className="font-semibold text-indigo-300">{confirmationData.studentEmail}</span>
                </div>
              </div>
            </div>

            {emailStatusMsg && (
              <div className="mb-4 p-3 rounded-lg bg-indigo-950/60 border border-indigo-500/30 text-xs text-indigo-300">
                {emailStatusMsg}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <a
                href={confirmationData.downloadUrl}
                download
                className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-600/30"
              >
                <Download className="w-4 h-4" />
                Download My Response (PDF)
              </a>

              <button
                type="button"
                onClick={handleResendEmail}
                disabled={isEmailPending}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm border border-slate-700 transition-colors disabled:opacity-50"
              >
                {isEmailPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Mail className="w-4 h-4 text-slate-400" />
                )}
                Email My Response
              </button>
            </div>

            <div className="text-center mt-6 pt-6 border-t border-slate-800">
              <Link
                href="/feedback"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to All Feedback Forms
              </Link>
            </div>
          </div>
        ) : (
          /* MANUAL VERIFICATION LOOKUP FORM */
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Search className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Retrieve Confirmation</h2>
                <p className="text-xs text-slate-400">
                  Verify your Google Forms submission from institutional records
                </p>
              </div>
            </div>

            {lookupError && (
              <div className="mb-5 p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-300">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                <div>{lookupError}</div>
              </div>
            )}

            <form onSubmit={handleManualLookup} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Form Identifier / Form ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. 1a2b3c4d-..."
                  value={lookupFormId}
                  onChange={e => setLookupFormId(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm text-white placeholder-slate-600 outline-none transition-all"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Find the form ID on the landing page or in your feedback URL.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Registered Student Email
                </label>
                <input
                  type="email"
                  placeholder="your.email@bce-bgp.ac.in"
                  value={lookupEmail}
                  onChange={e => setLookupEmail(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm text-white placeholder-slate-600 outline-none transition-all"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Must match the verified email you used when submitting the Google Form.
                </span>
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-600/30 disabled:opacity-50 mt-2"
              >
                {isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ShieldCheck className="w-4 h-4" />
                )}
                Verify & Retrieve Confirmation
              </button>
            </form>

            <div className="text-center mt-6 pt-6 border-t border-slate-800">
              <Link
                href="/feedback"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to All Feedback Forms
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function FeedbackConfirmationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <div className="flex items-center gap-3 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
            <span className="text-sm font-medium">Loading submission status...</span>
          </div>
        </div>
      }
    >
      <ConfirmationContent />
    </Suspense>
  );
}
