'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { School, Lock, Mail, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();

      // 1. Authenticate with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (authError || !authData.user) {
        setErrorMsg(authError?.message || 'Invalid email or password.');
        setIsLoading(false);
        return;
      }

      // 2. Call server check via API route to verify admin privileges and perform auto-promotion
      const verifyRes = await fetch('/api/admin/verify-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const verifyData = await verifyRes.json();

      if (!verifyRes.ok || !verifyData.isAuthenticated) {
        setErrorMsg(verifyData.error || 'Authentication failed.');
        setIsLoading(false);
        return;
      }

      if (verifyData.isSuperAdmin || (verifyData.isApproved && verifyData.isActive)) {
        router.push('/admin/dashboard');
        router.refresh();
        return;
      }

      if (verifyData.isPending) {
        router.push('/admin/pending');
        router.refresh();
        return;
      }

      if (verifyData.isRejected) {
        setErrorMsg('Your admin access request has been rejected by the administrator.');
        await supabase.auth.signOut();
        setIsLoading(false);
        return;
      }

      if (!verifyData.isActive) {
        setErrorMsg('Your administrator account has been deactivated. Please contact the Super Admin.');
        await supabase.auth.signOut();
        setIsLoading(false);
        return;
      }

      // Default fallback
      router.push('/admin/pending');
    } catch (err: any) {
      console.error('Login error:', err);
      setErrorMsg(err.message || 'An unexpected error occurred during login.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-950 via-bce-navy to-slate-900">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-tr from-bce-cobalt to-amber-500 p-0.5 shadow-xl flex items-center justify-center">
          <div className="w-full h-full bg-bce-navy rounded-2xl flex items-center justify-center">
            <School className="w-8 h-8 text-amber-400" />
          </div>
        </div>

        <h2 className="mt-5 text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
          BCE Admin Portal
        </h2>
        <p className="mt-1.5 text-xs text-slate-400 font-medium">
          Bhagalpur College of Engineering • Faculty Feedback Management System
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-slate-800/90 backdrop-blur-md py-8 px-6 sm:px-10 shadow-2xl rounded-2xl border border-slate-700/60">
          <form className="space-y-5" onSubmit={handleLogin}>
            {errorMsg && (
              <div className="p-3.5 bg-red-950/60 border border-red-800/70 rounded-xl text-red-200 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Administrator Email
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@bce.ac.in or authorized email"
                  className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-900/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-900/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-md text-sm font-semibold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-700/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <Link
              href="/admin/signup"
              className="text-amber-400 hover:text-amber-300 transition-colors font-medium"
            >
              Request Admin Access →
            </Link>

            <Link
              href="/"
              className="text-slate-400 hover:text-slate-300 transition-colors"
            >
              ← Back to Student Portal
            </Link>
          </div>
        </div>

        <div className="mt-8 text-center text-xs text-slate-500">
          Super Admin: <span className="font-mono text-slate-400">iambestadi@gmail.com</span>
        </div>
      </div>
    </div>
  );
}
