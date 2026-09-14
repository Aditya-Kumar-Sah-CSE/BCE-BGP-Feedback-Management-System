import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { StudentDiscoveryFlow } from '@/components/public/StudentDiscoveryFlow';
import { AllFeedbackFormsSection } from '@/components/public/AllFeedbackFormsSection';
import { getPublicActiveFormsAction } from '@/app/feedback/actions';
import { GraduationCap, ShieldCheck, UserCheck, School, ArrowRight } from 'lucide-react';
import type { AcademicYear, Branch, Semester } from '@/types/database';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function HomePage() {
  const supabase = await createClient();

  // Fetch public active academic data for discovery and initial active forms
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
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Government of Bihar | Department of Science, Technology & Technical Education</span>
          </div>
          <div className="flex items-center gap-4 text-slate-300">
            <span>Estd. 1960</span>
            <span>•</span>
            <span>AICTE Approved</span>
            <span>•</span>
            <Link href="/admin/login" className="hover:text-amber-300 transition-colors flex items-center gap-1 font-medium">
              Admin Portal <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-bce-navy to-bce-cobalt text-amber-400 flex items-center justify-center font-bold text-xl shadow-md border border-bce-cobalt/50">
              <School className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-bce-navy">
                Bhagalpur College of Engineering
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Faculty Feedback & Evaluation Portal (BCE BGP)
              </p>
            </div>
          </div>

          <Link
            href="/admin/login"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-bce-navy bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 transition-all hover:shadow-sm"
          >
            <UserCheck className="w-4 h-4 text-bce-cobalt" />
            <span>Faculty / Admin Login</span>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-b from-white via-slate-50 to-slate-100 border-b border-slate-200 py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-50 border border-amber-200/80 text-amber-900 text-xs font-semibold shadow-sm">
            <GraduationCap className="w-4 h-4 text-amber-600" />
            <span>Student Anonymous Evaluation System</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            Constructive Feedback Drives <span className="text-bce-cobalt">Academic Excellence</span>
          </h2>

          <p className="text-base text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Welcome to the official BCE feedback portal. Students do not need to log in. Select your academic session, branch, and semester to view faculty assignments and published feedback forms.
          </p>

          {/* Key Privacy Highlights */}
          <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto text-left">
            <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs flex items-start gap-2.5">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-slate-800">100% Anonymous</p>
                <p className="text-[11px] text-slate-500">Zero student identity or credentials recorded</p>
              </div>
            </div>
            <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs flex items-start gap-2.5">
              <GraduationCap className="w-5 h-5 text-bce-cobalt shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-slate-800">Direct Impact</p>
                <p className="text-[11px] text-slate-500">Helps improve teaching and syllabus delivery</p>
              </div>
            </div>
            <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs flex items-start gap-2.5">
              <School className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-slate-800">All Departments</p>
                <p className="text-[11px] text-slate-500">CSE, CE, ME, EE, ECE across all 8 semesters</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Discovery Flow Area */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-bce-cobalt" />
              Find Your Feedback Form
            </h3>
            <p className="text-sm text-slate-500">
              Follow the discovery path: Year → Branch → Semester → Faculty & Subject.
            </p>
          </div>
        </div>

        {/* Client-side cascading discovery component */}
        <StudentDiscoveryFlow
          academicYears={(academicYears as AcademicYear[]) || []}
          branches={(branches as Branch[]) || []}
          semesters={(semesters as Semester[]) || []}
        />

        {/* All Currently Active Feedback Forms Section */}
        <AllFeedbackFormsSection initialData={initialActiveForms} />
      </main>

      {/* Footer */}
      <footer className="bg-bce-navy text-slate-400 text-xs py-8 px-4 border-t border-bce-cobalt/30 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4 text-center sm:text-left">
          <div>
            <p className="font-semibold text-white text-sm">
              Bhagalpur College of Engineering (BCE Bhagalpur)
            </p>
            <p className="text-slate-400 mt-0.5">
              Sabour, Bhagalpur - 813210, Bihar, India
            </p>
          </div>
          <div className="flex items-center gap-6">
            <span>Official Faculty Feedback System</span>
            <Link href="/admin/login" className="text-amber-400 hover:underline">
              Administrator Login
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
