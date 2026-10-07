import React from 'react';
import { Sparkles } from 'lucide-react';

export default function LoadingScreen({ message = "Chargement en cours..." }) {
  return (
    <div className="fixed inset-0 z-[99999] flex flex-col justify-between items-center bg-white text-slate-900 select-none font-display px-6 py-12">
      <style>{`
        @keyframes pulseSoft {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 10px 25px rgba(255, 107, 0, 0.25)); }
          50% { transform: scale(1.05); filter: drop-shadow(0 14px 35px rgba(255, 107, 0, 0.4)); }
        }
        @keyframes shimmerLine {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-pulse-soft { animation: pulseSoft 2.5s ease-in-out infinite; }
        .animate-shimmer-fast { animation: shimmerLine 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
      `}</style>

      {/* Top spacer for balanced vertical alignment */}
      <div className="w-full h-8" />

      {/* Center Hero Branding Block */}
      <div className="flex flex-col items-center text-center max-w-sm w-full my-auto">
        
        {/* BeautyBook Orange Logo Icon (B°) */}
        <div className="relative mb-6 animate-pulse-soft">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-[#E8651B] flex items-center justify-center text-white shadow-2xl shadow-orange-500/30 border border-orange-400/20 relative overflow-hidden">
            <span className="text-5xl sm:text-6xl font-black tracking-tight select-none translate-x-[-2px]">
              B
            </span>
            {/* Peach dot in the top right (B°) */}
            <span 
              className="absolute top-5 right-5 sm:top-6 sm:right-6 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-[#FBD0B6] shadow-sm"
              style={{ backgroundColor: '#FCD3BD' }}
            />
          </div>
        </div>

        {/* Brand Name */}
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
          Beauty<span className="text-[#E8651B]">Book</span>
        </h1>

        {/* Subtitle */}
        <p className="text-xs sm:text-sm font-medium text-slate-500 mt-2 tracking-wide">
          L'expérience beauté intelligente
        </p>
      </div>

      {/* Lower Loading Indicator Block */}
      <div className="flex flex-col items-center text-center w-full max-w-xs mb-4">
        
        {/* Sleek Minimal Progress Bar */}
        <div className="w-48 sm:w-56 h-1 bg-slate-100 rounded-full overflow-hidden relative border border-slate-200/60 mb-3">
          <div className="absolute inset-0 bg-[#FF6B00] rounded-full animate-shimmer-fast" />
        </div>

        {/* Dynamic Status Label */}
        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest animate-pulse">
          {message}
        </div>

        {/* Footer Version Tag */}
        <div className="mt-8 text-[11px] text-slate-300 font-medium tracking-wider">
          BeautyBook • v2.0
        </div>
      </div>
    </div>
  );
}
