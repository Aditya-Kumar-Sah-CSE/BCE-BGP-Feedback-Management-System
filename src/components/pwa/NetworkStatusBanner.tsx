'use client';

import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';

export function NetworkStatusBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    // Initial check
    if (typeof window !== 'undefined' && !navigator.onLine) {
      setIsOffline(true);
    }

    const handleOffline = () => {
      setIsOffline(true);
      setShowReconnected(false);
    };

    const handleOnline = () => {
      setIsOffline(false);
      setShowReconnected(true);
      const timer = setTimeout(() => setShowReconnected(false), 3500);
      return () => clearTimeout(timer);
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (!isOffline && !showReconnected) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-2 left-4 right-4 sm:left-1/2 sm:-translate-x-1/2 sm:w-auto sm:max-w-md z-50 animate-fade-in pointer-events-none"
    >
      {isOffline && (
        <div className="bg-red-950/95 border border-red-500/60 text-white px-4 py-2.5 rounded-2xl shadow-xl backdrop-blur-md flex items-center justify-between gap-3 pointer-events-auto">
          <div className="flex items-center gap-2 text-xs">
            <WifiOff className="w-4 h-4 text-red-400 shrink-0 animate-pulse" />
            <span className="font-semibold text-red-200">
              You are offline. Live feedback requires internet.
            </span>
          </div>
          <button
            onClick={() => {
              if (typeof window !== 'undefined') window.location.reload();
            }}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-300 hover:text-white px-2 py-1 rounded-lg bg-red-900/60 hover:bg-red-800 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {showReconnected && !isOffline && (
        <div className="bg-emerald-950/95 border border-emerald-500/60 text-white px-4 py-2 rounded-2xl shadow-xl backdrop-blur-md flex items-center gap-2 text-xs pointer-events-auto">
          <Wifi className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-semibold text-emerald-200">
            Internet connection restored.
          </span>
        </div>
      )}
    </div>
  );
}
