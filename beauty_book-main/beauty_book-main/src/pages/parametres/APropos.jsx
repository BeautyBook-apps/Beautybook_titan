import { useNavigate } from "react-router-dom";
import { ArrowLeft, Star, Shield, Zap, Heart } from "lucide-react";
import { useThemeBg } from "@/hooks/useTheme";
import BrandLogo from "@/components/ui/BrandLogo";


export default function APropos() {
  const navigate = useNavigate();
  const themeBg = useThemeBg();

  return (
    <div className="font-display min-h-screen" style={{ background: themeBg }}>
      <div className="bg-white px-5 pt-12 pb-4 flex items-center gap-3 shadow-sm">
        <button onClick={() => navigate(-1)} className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center active:scale-95 transition-all">
          <ArrowLeft className="w-4 h-4 text-primary" />
        </button>
        <h1 className="text-[20px] font-black text-gray-900">À propos</h1>
      </div>

      <div className="px-4 pb-20 pt-8 flex flex-col items-center">

        {/* Logo + nom */}
        <div className="flex flex-col items-center gap-4 mb-8">
          <div className="w-24 h-24 bg-white rounded-3xl shadow-xl flex items-center justify-center">
            <BrandLogo size={64} alt="Logo BeautyBook" className="rounded-2xl" />
          </div>
          <div className="text-center">
            <h2 className="text-[32px] font-black text-gray-900 uppercase tracking-widest">BeautyBook</h2>
            <p className="text-[13px] text-gray-400 font-medium">La beauté à portée de main</p>
          </div>

          {/* Badge version */}
          <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-5 py-2">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-[13px] font-black text-primary">Version 1.0</span>
          </div>
        </div>

        {/* Description */}
        <div className="bg-white rounded-3xl p-5 w-full mb-4 text-center">
          <p className="text-[14px] text-gray-500 leading-relaxed">
            BeautyBook est la première plateforme dédiée à l'excellence esthétique. Réservez vos soins, découvrez les meilleurs professionnels et révélez votre beauté.
          </p>
        </div>

        {/* Features */}
        <div className="w-full space-y-3 mb-6">
          {[
            { icon: Star, color: "bg-yellow-50", iconColor: "text-yellow-500", label: "Meilleurs professionnels", sub: "Experts certifiés et vérifiés" },
            { icon: Shield, color: "bg-green-50", iconColor: "text-green-500", label: "Paiement sécurisé", sub: "Vos données protégées RGPD" },
            { icon: Zap, color: "bg-blue-50", iconColor: "text-blue-500", label: "Réservation instantanée", sub: "Disponible 24h/24, 7j/7" },
            { icon: Heart, color: "bg-pink-50", iconColor: "text-pink-500", label: "Programme fidélité", sub: "BeautyCoins à chaque réservation" },
          ].map(({ icon: Icon, color, iconColor, label, sub }, i) => (
            <div key={i} className="bg-white rounded-2xl px-4 py-4 flex items-center gap-3">
              <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center shrink-0`}>
                <Icon className={`w-5 h-5 ${iconColor}`} />
              </div>
              <div>
                <p className="text-[14px] font-black text-gray-900">{label}</p>
                <p className="text-[11px] text-gray-400 font-medium">{sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Infos légales */}
        <div className="w-full bg-white rounded-3xl p-5 space-y-2 mb-6">
          {[
            { label: "Version", value: "1.0" },
            { label: "Build", value: "2026.05.24" },
            { label: "Plateforme", value: "iOS / Android / Web" },
            { label: "Développé par", value: "BeautyBook SAS" },
            { label: "Contact", value: "contact@beautybook.fr" },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
              <span className="text-[12px] font-black text-gray-400 uppercase tracking-widest">{label}</span>
              <span className="text-[13px] font-bold text-gray-700">{value}</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center space-y-1">
          <p className="text-[12px] text-gray-400 font-medium">© 2026 BeautyBook SAS</p>
          <p className="text-[11px] text-gray-300 font-medium">12 Avenue Montaigne, 75008 Paris</p>
          <p className="text-[11px] text-gray-300 font-medium">Tous droits réservés</p>
        </div>

      </div>
    </div>
  );
}
