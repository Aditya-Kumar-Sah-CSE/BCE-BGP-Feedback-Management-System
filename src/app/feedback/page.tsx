import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { StudentDiscoveryFlow } from '@/components/public/StudentDiscoveryFlow';
import { AllFeedbackFormsSection } from '@/components/public/AllFeedbackFormsSection';
import { getPublicActiveFormsAction } from '@/app/feedback/actions';
import { School, ArrowLeft, ShieldCheck, GraduationCap } from 'lucide-react';

import type { AcademicYear, Branch, Semester } from '@/types/database';

export const dynamic = 'force-dynamic';

export default async function FeedbackPortalPage() {
  const supabase = await createClient();

  // Fetch active academic masters and initial active forms
  const [
    { data: academicYears },
    { data: branches },
    { data: semesters },
    initialActiveForms,
  ] = await Promise.all([
    supabase.from('academic_years').select('*').eq('is_active', true).order('name', { ascending: false }),
    supabase.from('branches').select('*').eq('is_active', true).order('name', { ascending: true }),
    supabase.from('semesters').select('*').eq('is_active', true).order('semester_number', { ascending: true }),
    getPublicActiveFormsAction({ page: 1, pageSize: 12 }),
  ]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      {/* Top Banner */}
      <div className="bg-bce-navy text-white text-xs py-2 px-4 border-b border-bce-cobalt/40">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Government of Bihar | Department of Science, Technology & Technical Education</span>
          </div>
          <Link href="/" className="text-slate-300 hover:text-white flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" /> BCE Home
          </Link>
        </div>
      </div>

      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-xs sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-bce-navy to-bce-cobalt text-amber-400 flex items-center justify-center font-bold text-lg shadow-md border border-bce-cobalt/50">
              <School className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-bce-navy">
                Bhagalpur College of Engineering
              </h1>
              <p className="text-[11px] text-slate-500 font-medium">
                Student Feedback & Faculty Evaluation Portal
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>100% Anonymous • No Login Required</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-bce-cobalt text-xs font-semibold mb-2">
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Student Feedback Portal</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Find & Submit Your Faculty Feedback
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
            Select your academic session, department, semester, faculty member, and subject below to access your real Google Feedback Form.
          </p>
        </div>

        <StudentDiscoveryFlow
          academicYears={(academicYears as AcademicYear[]) || []}
          branches={(branches as Branch[]) || []}
          semesters={(semesters as Semester[]) || []}
        />

        {/* All Currently Active Feedback Forms Section */}
        <AllFeedbackFormsSection initialData={initialActiveForms} />
      </main>

      {/* Footer */}
      <footer className="bg-bce-navy text-slate-400 text-xs py-6 px-4 border-t border-bce-cobalt/30 mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3 text-center sm:text-left">
          <span>Bhagalpur College of Engineering (BCE Bhagalpur) • Official Student Evaluation Portal</span>
          <Link href="/admin/login" className="text-amber-400 hover:underline">
            Admin Login
          </Link>
        </div>
      </footer>
    </div>
  );
}
