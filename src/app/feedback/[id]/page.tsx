import Link from 'next/link';
import { getPublicFeedbackFormByIdAction } from '@/app/feedback/actions';
import { PublicFeedbackCard } from '@/components/public/PublicFeedbackCard';
import { School, ArrowLeft, ShieldCheck, AlertCircle } from 'lucide-react';


export const dynamic = 'force-dynamic';

export default async function DirectFeedbackPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getPublicFeedbackFormByIdAction(id);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      {/* Top Banner */}
      <div className="bg-bce-navy text-white text-xs py-2 px-4 border-b border-bce-cobalt/40">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Government of Bihar | Department of Science, Technology & Technical Education</span>
          </div>
          <Link href="/feedback" className="text-slate-300 hover:text-white flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" /> All Feedback Forms
          </Link>
        </div>
      </div>

      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-xs sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-bce-navy to-bce-cobalt text-amber-400 flex items-center justify-center font-bold text-lg shadow-md border border-bce-cobalt/50">
              <School className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-bce-navy">
                Bhagalpur College of Engineering
              </h1>
              <p className="text-[11px] text-slate-500 font-medium">
                Official Student Feedback Portal
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>100% Anonymous</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <div>
          <Link
            href="/feedback"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-bce-cobalt mb-3 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Feedback Discovery</span>
          </Link>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Direct Faculty Evaluation Link
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Official feedback form designated for your specific course curriculum.
          </p>
        </div>

        {!result.success || !result.form ? (
          <div className="bg-white rounded-2xl p-10 border border-slate-200 text-center space-y-4 shadow-xs">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 mx-auto flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900">Feedback Form Unavailable</h3>
              <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                {result.message || 'This feedback form is no longer available or the link is invalid.'}
              </p>
            </div>
            <div className="pt-2">
              <Link
                href="/feedback"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-bce-cobalt hover:bg-bce-navy text-white rounded-xl text-xs font-bold transition-colors"
              >
                <span>Browse Available Feedback Forms</span>
              </Link>
            </div>
          </div>
        ) : (
          <PublicFeedbackCard
            form={result.form}
            isClosed={result.status === 'CLOSED'}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-bce-navy text-slate-400 text-xs py-6 px-4 border-t border-bce-cobalt/30 mt-auto">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3 text-center sm:text-left">
          <span>Bhagalpur College of Engineering (BCE Bhagalpur) • Sabour, Bhagalpur</span>
          <Link href="/feedback" className="text-amber-400 hover:underline">
            All Feedback Forms
          </Link>
        </div>
      </footer>
    </div>
  );
}
