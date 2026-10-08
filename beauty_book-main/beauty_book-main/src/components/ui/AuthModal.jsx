import { useNavigate } from "react-router-dom";
import { X, LogIn, UserPlus, Shield, Zap, Gift } from "lucide-react";
import BrandLogo from "@/components/ui/BrandLogo";

export default function AuthModal({ open, onClose, message }) {
  const navigate = useNavigate();
  if (!open) return null;

  const handleClose = () => {
    onClose?.();
    navigate("/");
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center" onClick={handleClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />

      <div
        className="relative bg-white w-full sm:max-w-[370px] sm:rounded-[32px] rounded-t-[32px] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: "slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)" }}
      >
        {/* Top gradient accent bar */}
        <div className="h-1.5 w-full" style={{ background: "linear-gradient(90deg, #E8732A, #F5A623, #E84466)" }} />

        <div className="px-6 pt-6 pb-7">
          {/* Close */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 w-8 h-8 bg-gray-100/80 rounded-full flex items-center justify-center active:scale-90 transition-all z-10"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>

          {/* Logo officiel BeautyBook */}
          <div className="flex justify-center mb-5">
            <BrandLogo size={84} alt="Logo BeautyBook" className="rounded-[22px] shadow-lg" />
          </div>

          {/* Brand */}
          <h2
            className="text-[26px] font-black text-center text-gray-900 mb-1"
            style={{ fontFamily: "var(--font-display, 'Plus Jakarta Sans', sans-serif)" }}
          >
            BeautyBook
          </h2>

          {/* Gradient divider */}
          <div className="flex justify-center mb-2">
            <div className="w-12 h-[3px] rounded-full" style={{ background: "linear-gradient(90deg, #E8732A, #E84466)" }} />
          </div>

          {/* Subtitle */}
          <p className="text-[13px] text-gray-400 font-medium text-center mb-6 leading-relaxed px-1">
            {message || "Connectez-vous pour profiter de toutes les fonctionnalités."}
          </p>

          {/* CTA Se connecter */}
          <button
            onClick={() => { onClose(); navigate("/connexion"); }}
            className="w-full py-4 rounded-2xl font-black text-[13px] uppercase tracking-widest text-white active:scale-[0.98] transition-all shadow-lg shadow-[#E8732A]/25 flex items-center justify-center gap-2.5"
            style={{ background: "linear-gradient(135deg, #E8732A, #E84466)" }}
          >
            <LogIn className="w-[18px] h-[18px]" />
            Se connecter
          </button>

          {/* Créer un compte */}
          <button
            onClick={() => {
              onClose?.();
              sessionStorage.removeItem("bb_signup_data");
              sessionStorage.setItem("bb_from_login", "1");
              navigate("/onboarding");
            }}
            className="w-full py-3.5 mt-3 rounded-2xl font-black text-[12px] uppercase tracking-widest text-gray-500 active:scale-[0.98] transition-all border border-gray-200 hover:bg-gray-50 flex items-center justify-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            Créer un compte gratuit
          </button>

          {/* Feature badges */}
          <div className="flex items-center justify-center gap-5 mt-6">
            <div className="flex flex-col items-center gap-1">
              <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center">
                <Shield className="w-4 h-4 text-green-500" />
              </div>
              <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Sécurisé</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center">
                <Zap className="w-4 h-4 text-[#E8732A]" />
              </div>
              <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Gratuit</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center">
                <Gift className="w-4 h-4 text-purple-500" />
              </div>
              <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Sans engagement</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
