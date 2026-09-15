import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { HeroSection } from '@/components/public/HeroSection';
import { StudentDiscoveryFlow } from '@/components/public/StudentDiscoveryFlow';
import { AllFeedbackFormsSection } from '@/components/public/AllFeedbackFormsSection';
import { getPublicActiveFormsAction } from '@/app/feedback/actions';
import { School, UserCheck, ArrowRight } from 'lucide-react';
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
      <div className="bg-bce-navy text-white text-[11px] sm:text-xs py-1.5 sm:py-2 px-3 sm:px-4 border-b border-bce-cobalt/40">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-1 sm:gap-2 text-center sm:text-left">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="truncate">Govt. of Bihar | Dept. of Science, Technology & Technical Education</span>
          </div>
          <div className="flex items-center gap-3 sm:gap-4 text-slate-300 text-[10px] sm:text-xs">
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
        <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-2.5 sm:py-3.5 flex justify-between items-center gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-bce-navy to-bce-cobalt text-amber-400 flex items-center justify-center font-bold text-lg sm:text-xl shadow-md border border-bce-cobalt/50 shrink-0">
              <School className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-xl font-bold tracking-tight text-bce-navy truncate sm:whitespace-normal">
                Bhagalpur College of Engineering
              </h1>
              <p className="text-[10px] sm:text-xs text-slate-500 font-medium truncate sm:whitespace-normal">
                Faculty Feedback & Evaluation Portal (BCE BGP)
              </p>
            </div>
          </div>

          <Link
            href="/admin/login"
            className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 text-xs sm:text-sm font-medium text-bce-navy bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 transition-all shrink-0 active:scale-98"
          >
            <UserCheck className="w-4 h-4 text-bce-cobalt shrink-0" />
            <span className="hidden sm:inline">Faculty / Admin Login</span>
            <span className="sm:hidden font-semibold">Admin Login</span>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <HeroSection />

      {/* Discovery Flow Area */}
      <main id="discovery-section" className="flex-1 max-w-6xl mx-auto w-full px-3.5 sm:px-6 lg:px-8 py-6 sm:py-10 scroll-mt-14">
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
          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-6">
            <span>Official Faculty Feedback System</span>
            <Link href="/admin/login" className="text-amber-400 hover:underline">
              Administrator Login
            </Link>
            <a
              href="https://portfolio-two-ashen-zseywond41.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-500 hover:text-amber-400 transition-colors flex items-center gap-1.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
              <span>Developed by <span className="font-semibold text-slate-300">Aditya Kumar Sah</span></span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
