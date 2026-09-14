'use client';

import Link from 'next/link';
import { WifiOff, RefreshCw, School, ArrowLeft } from 'lucide-react';

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-slate-100 p-4">
      <div className="max-w-md w-full bg-slate-800/90 backdrop-blur-md rounded-2xl border border-slate-700 p-6 sm:p-8 shadow-2xl text-center space-y-6">
        {/* Branding Crest */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-bce-navy to-bce-cobalt text-amber-400 flex items-center justify-center shadow-lg border border-amber-400/30">
            <School className="w-9 h-9" />
          </div>
        </div>

        {/* Header */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 text-red-400 text-xs font-semibold border border-red-500/30">
            <WifiOff className="w-3.5 h-3.5" />
            <span>No Internet Connection</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            You&apos;re Offline
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            Reconnect to continue accessing live feedback forms, academic structures, and account data.
          </p>
        </div>

        {/* Guidance notice */}
        <div className="p-3.5 bg-slate-900/60 rounded-xl border border-slate-700/60 text-xs text-slate-400 text-left space-y-1">
          <p className="font-semibold text-slate-300">Notice:</p>
          <p>
            Student evaluations and Google Forms submissions require real-time network connectivity to guarantee tamper-proof audit trails.
          </p>
        </div>

        {/* Actions */}
        <div className="pt-2 flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.location.reload();
              }
            }}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-bce-cobalt hover:bg-bce-navy text-white text-xs font-bold transition-all border border-bce-cobalt shadow-md cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Retry Connection</span>
          </button>
          <Link
            href="/"
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold transition-all border border-slate-600"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Go to Home</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
