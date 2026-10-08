import { useNavigate } from "react-router-dom";
import { ArrowLeft, Smartphone, CheckCircle } from "lucide-react";
import { useThemeBg } from "@/hooks/useTheme";
import PaymentCardManager from "@/components/payment/PaymentCardManager";

const METHODS = [
  { id: "apple", label: "Apple Pay", sub: "Activé", icon: "🍎", active: true },
  { id: "google", label: "Google Pay", sub: "Non configuré", icon: "G", active: false },
  { id: "link", label: "Link", sub: "Disponible avec Stripe", icon: "L", active: true },
];

export default function MoyensPaiement() {
  const navigate = useNavigate();
  const themeBg = useThemeBg();

  return (
    <div className="font-display min-h-screen" style={{ background: themeBg }}>
      <div className="bg-white px-5 pt-12 pb-4 flex items-center gap-3 shadow-sm">
        <button onClick={() => navigate(-1)} className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center active:scale-95 transition-all">
          <ArrowLeft className="w-4 h-4 text-primary" />
        </button>
        <h1 className="text-[20px] font-black text-gray-900">Paiement</h1>
      </div>

      <div className="px-4 pb-20 pt-6 space-y-5">

        {/* Stripe Card Manager — cartes réelles via Stripe */}
        <PaymentCardManager />

        {/* Méthodes mobiles */}
        <div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 px-1">Méthodes de paiement</p>
          <div className="bg-white rounded-3xl overflow-hidden divide-y divide-gray-50">
            {METHODS.map(m => (
              <div key={m.id} className="px-4 py-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center shrink-0">
                  <span className="text-[16px] font-black text-blue-600">{m.icon}</span>
                </div>
                <div className="flex-1">
                  <p className="text-[15px] font-black text-gray-900">{m.label}</p>
                  <p className="text-[11px] text-gray-400 font-medium">{m.sub}</p>
                </div>
                {m.active && <CheckCircle className="w-5 h-5 text-green-500 fill-green-500" />}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
